// Pure helpers for the Safari proxy Worker: target parsing, SSRF blocking,
// URL rewriting and header filtering. No Worker globals, so Vitest can run them.

export const MAX_BODY_BYTES = 10 * 1024 * 1024;

const PRIVATE_V4 = [[0, 0], [10, 10], [127, 127]]; // first octet ranges

const isPrivateV4 = (host) => {
    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);

    if (!match) return false;

    const [a, b] = match.slice(1).map(Number);

    if (PRIVATE_V4.some(([from, to]) => a >= from && a <= to)) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;

    return a >= 224;
};

const isPrivateV6 = (host) => {
    const bare = host.replace(/^\[|\]$/g, '').toLowerCase();

    if (!bare.includes(':')) return false;

    // IPv4-mapped (::ffff:a.b.c.d) is judged by its IPv4 part.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(bare);

    if (mapped) return isPrivateV4(mapped[1]);

    return bare === '::' || bare === '::1' || /^f[cd]/.test(bare) || /^fe[89ab]/.test(bare) || bare.startsWith('::ffff:');
};

// Hosts the proxy must never fetch: internal names, private/loopback/link-local
// ranges (incl. cloud metadata) and the proxy and portfolio themselves.
export const isBlockedHost = (hostname, selfHosts = []) => {
    const host = hostname.toLowerCase().replace(/\.$/, '');

    if (!host) return true;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (/\.(local|internal|lan|home|corp)$/.test(host)) return true;
    if (selfHosts.some((self) => host === self.toLowerCase())) return true;
    // Decimal/hex/octal IPv4 forms (http://2130706433/) are normalised by URL, but be strict about pure numbers.
    if (/^\d+$/.test(host) || /^0x[\da-f]+$/i.test(host)) return true;

    return isPrivateV4(host) || isPrivateV6(host);
};

// Request path "/https://example.com/a?b=1" (plus the query string) -> target URL, or null.
export const targetFromRequest = (requestUrl, selfHosts = []) => {
    const url = new URL(requestUrl);
    const raw = url.pathname.slice(1) + url.search;

    if (!/^https?:\/\//i.test(raw)) return null;

    // Browsers collapse "//" in paths in some contexts: "https:/host" -> repair it.
    let target;

    try {
        target = new URL(raw);
    } catch {
        return null;
    }

    if (!['http:', 'https:'].includes(target.protocol)) return null;
    if (target.username || target.password) return null;
    if (target.port && !['80', '443'].includes(target.port)) return null;
    if (isBlockedHost(target.hostname, selfHosts)) return null;

    return target;
};

// A request for a bare path ("/results?q=x", built by a script from
// location.pathname) resolved against the real URL of the proxied page that
// sent it (the Referer), or null when the referer isn't such a page.
export const targetFromReferer = (requestUrl, referer, workerOrigin, selfHosts = []) => {
    if (!referer) return null;

    try {
        const from = new URL(referer);

        if (from.origin !== workerOrigin) return null;

        const base = targetFromRequest(from.href, selfHosts);

        if (!base) return null;

        const request = new URL(requestUrl);
        const target = new URL(request.pathname + request.search, base);

        return isBlockedHost(target.hostname, selfHosts) ? null : target.href;
    } catch {
        return null;
    }
};

const SKIPPED = /^(data:|blob:|javascript:|mailto:|tel:|about:|#)/i;

// Resolves href against the page URL and points it at the proxy. Leaves
// non-fetchable and fragment-only values as they were.
export const toProxied = (href, base, workerOrigin) => {
    if (typeof href !== 'string') return href;

    const value = href.trim();

    if (!value || SKIPPED.test(value)) return href;

    try {
        const absolute = new URL(value, base);

        if (!['http:', 'https:'].includes(absolute.protocol)) return href;
        if (absolute.origin === workerOrigin) return href;

        return `${workerOrigin}/${absolute.href}`;
    } catch {
        return href;
    }
};

// srcset: "a.png 1x, b.png 2x" -> each candidate URL proxied.
export const proxySrcset = (srcset, base, workerOrigin) =>
    srcset
        .split(',')
        .map((part) => {
            const [url, ...descriptor] = part.trim().split(/\s+/);

            return url ? [toProxied(url, base, workerOrigin), ...descriptor].join(' ') : '';
        })
        .filter(Boolean)
        .join(', ');

// CSS url(...) and @import "..." references.
export const proxyCss = (css, base, workerOrigin) =>
    css
        .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_, quote, url) => `url(${quote}${toProxied(url, base, workerOrigin)}${quote})`)
        .replace(/@import\s+(['"])([^'"]+)\1/gi, (_, quote, url) => `@import ${quote}${toProxied(url, base, workerOrigin)}${quote}`);

const FORWARDED_REQUEST_HEADERS = ['user-agent', 'accept', 'accept-language', 'range', 'content-type'];

// Only these reach the target: never Cookie, Authorization or Referer.
export const requestHeadersFor = (headers) => {
    const out = new Headers();

    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = headers.get(name);

        if (value) out.set(name, value);
    }

    return out;
};

const DROPPED_RESPONSE_HEADERS = [
    'x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'set-cookie',
    'strict-transport-security', 'cross-origin-opener-policy', 'cross-origin-embedder-policy',
    'cross-origin-resource-policy', 'permissions-policy', 'report-to', 'nel', 'public-key-pins',
    'clear-site-data', 'content-encoding-hint', 'alt-svc',
];

export const parentsList = (value = '') =>
    value.split(',').map((item) => item.trim()).filter(Boolean);

// Returns response headers with framing/cookie headers removed and the page
// locked to the portfolio as its only possible parent.
export const responseHeadersFor = (headers, { parents, rewritten, workerOrigin, base }) => {
    const out = new Headers(headers);

    for (const name of DROPPED_RESPONSE_HEADERS) out.delete(name);

    // Rewritten bodies change length (and are re-encoded by the runtime).
    if (rewritten) out.delete('content-length');

    const location = out.get('location');

    if (location) out.set('location', toProxied(location, base, workerOrigin));

    // The portfolio, plus the proxy itself so proxied pages can embed proxied frames.
    out.set('content-security-policy', `frame-ancestors ${[...parents, workerOrigin].filter(Boolean).join(' ')}`);
    out.set('x-robots-tag', 'noindex, nofollow');
    // Proxy-to-proxy requests carry the proxied page as Referer (never forwarded
    // upstream), so a bare path a script built can be resolved against it.
    out.set('referrer-policy', 'same-origin');
    out.set('access-control-allow-origin', '*');

    return out;
};

// Bing result links go to /ck/a, a page whose script sets location.href to the
// real destination (carried base64url-encoded in `u`, after "a1"). Script
// navigation can't be kept on the proxy, so the Worker resolves it itself.
export const bingClickTarget = (target) => {
    if (!/(^|\.)bing\.com$/.test(target.hostname) || target.pathname !== '/ck/a') return null;

    const encoded = target.searchParams.get('u') ?? '';

    if (!encoded.startsWith('a1')) return null;

    try {
        const bytes = atob(encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/'));
        const url = new URL(new TextDecoder().decode(Uint8Array.from(bytes, (char) => char.charCodeAt(0))));

        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
};

export const isRefusedType = (contentType = '', contentLength = null) => {
    if (/^video\//i.test(contentType)) return true;

    return Number(contentLength) > MAX_BODY_BYTES;
};

export const kindOf = (contentType = '') => {
    if (/text\/html|application\/xhtml/i.test(contentType)) return 'html';
    if (/text\/css/i.test(contentType)) return 'css';

    return 'other';
};
