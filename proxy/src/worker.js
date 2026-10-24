// Cloudflare Worker behind Safari's browsing. URL scheme: /<absolute target URL>.
// It strips anti-framing headers, never forwards cookies and locks proxied
// pages so they can only be framed by the portfolio (ALLOWED_PARENTS).

import {
    isRefusedType, kindOf, parentsList, proxyCss, proxySrcset, requestHeadersFor,
    responseHeadersFor, targetFromRequest, toProxied,
} from './proxyUrl';
import { SHIM_SOURCE } from './shim';

const BODY_METHODS = ['POST', 'PUT', 'PATCH'];
const MAX_REQUEST_BODY = 1024 * 1024;
const RATE_LIMIT = 300; // requests per minute per client, per isolate
const buckets = new Map();

const rateLimited = (ip) => {
    const minute = Math.floor(Date.now() / 60000);
    const entry = buckets.get(ip);

    if (!entry || entry.minute !== minute) {
        if (buckets.size > 5000) buckets.clear();
        buckets.set(ip, { minute, count: 1 });
        return false;
    }

    entry.count += 1;
    return entry.count > RATE_LIMIT;
};

const text = (body, status, type = 'text/plain; charset=utf-8') =>
    new Response(body, { status, headers: { 'content-type': type, 'x-robots-tag': 'noindex', 'cache-control': 'no-store' } });

const notFramedPage = `<!doctype html><meta charset="utf-8"><title>Safari proxy</title>
<body style="font:16px system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#333">
<h1>Safari proxy</h1><p>This address only works inside the Safari window of the portfolio.</p></body>`;

const inlineScript = (source) => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;

const rewriteHtml = (response, target, workerOrigin) => {
    const base = target.href;
    const fix = (attr) => ({
        element(element) {
            const value = element.getAttribute(attr);

            if (value) element.setAttribute(attr, toProxied(value, base, workerOrigin));
        },
    });
    const srcset = {
        element(element) {
            const value = element.getAttribute('srcset');

            if (value) element.setAttribute('srcset', proxySrcset(value, base, workerOrigin));
        },
    };

    return new HTMLRewriter()
        .on('head', {
            element(element) {
                element.prepend(
                    inlineScript(`window.__P=${JSON.stringify({ origin: workerOrigin, base })};`) + inlineScript(SHIM_SOURCE),
                    { html: true },
                );
            },
        })
        .on('base', { element: (element) => element.remove() })
        .on('a[href], area[href], link[href]', fix('href'))
        .on('img[src], script[src], iframe[src], source[src], video[src], audio[src], embed[src], track[src]', fix('src'))
        .on('form[action]', fix('action'))
        .on('img[srcset], source[srcset]', srcset)
        .on('[integrity]', { element: (element) => element.removeAttribute('integrity') })
        .on('[nonce]', { element: (element) => element.removeAttribute('nonce') })
        .on('meta[http-equiv]', {
            element(element) {
                const content = element.getAttribute('content');

                if (element.getAttribute('http-equiv')?.toLowerCase() !== 'refresh' || !content) return;
                element.setAttribute('content', content.replace(/(url=)(.+)$/i, (_, key, url) => key + toProxied(url.trim(), base, workerOrigin)));
            },
        })
        .on('[style]', {
            element(element) {
                element.setAttribute('style', proxyCss(element.getAttribute('style'), base, workerOrigin));
            },
        })
        .transform(response);
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const parents = parentsList(env.ALLOWED_PARENTS);

        if (url.pathname === '/robots.txt') return text('User-agent: *\nDisallow: /\n', 200);
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, POST', 'access-control-allow-headers': '*' } });
        }
        if (!['GET', 'HEAD', ...BODY_METHODS].includes(request.method)) return text('Method not allowed', 405);

        const selfHosts = [url.hostname, ...parents.map((parent) => { try { return new URL(parent).hostname; } catch { return ''; } })];
        const target = targetFromRequest(request.url, selfHosts);

        if (!target) return text(notFramedPage, url.pathname === '/' ? 200 : 400, 'text/html; charset=utf-8');

        const dest = request.headers.get('sec-fetch-dest');

        // Opening the proxy address directly (not from a frame) shows a notice instead.
        if (dest === 'document') return text(notFramedPage, 403, 'text/html; charset=utf-8');

        if (rateLimited(request.headers.get('cf-connecting-ip') ?? 'unknown')) return text('Too many requests', 429);

        let body;

        if (BODY_METHODS.includes(request.method)) {
            body = await request.arrayBuffer();
            if (body.byteLength > MAX_REQUEST_BODY) return text('Request too large', 413);
        }

        let upstream;

        try {
            upstream = await fetch(target.href, {
                method: request.method,
                headers: requestHeadersFor(request.headers),
                body,
                redirect: 'manual',
            });
        } catch {
            return text('Could not reach that site', 502);
        }

        const type = upstream.headers.get('content-type') ?? '';

        if (isRefusedType(type, upstream.headers.get('content-length'))) {
            return text('This content is too large to show in Safari', 413);
        }

        const kind = kindOf(type);
        const workerOrigin = url.origin;
        const headers = responseHeadersFor(upstream.headers, { parents, rewritten: kind !== 'other', workerOrigin, base: target.href });
        const response = new Response(upstream.body, { status: upstream.status, headers });

        if (kind === 'html') return rewriteHtml(response, target, workerOrigin);
        if (kind === 'css') return new Response(proxyCss(await upstream.text(), target.href, workerOrigin), { status: upstream.status, headers });

        return response;
    },
};
