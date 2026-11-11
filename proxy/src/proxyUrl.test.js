import { describe, expect, it } from 'vitest';

import {
    bingClickTarget, isBlockedHost, isRefusedType, kindOf, proxyCss, proxySrcset, requestHeadersFor,
    responseHeadersFor, targetFromReferer, targetFromRequest, toProxied,
} from './proxyUrl';

const W = 'https://p.workers.dev';

describe('isBlockedHost', () => {
    it.each([
        'localhost', 'a.localhost', 'printer.local', 'db.internal', '127.0.0.1', '10.1.2.3', '172.16.0.1',
        '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1',
        '[::1]', '[fe80::1]', '[fd00::1]', '[::ffff:127.0.0.1]', '2130706433', '0x7f000001', '',
    ])('blocks %s', (host) => expect(isBlockedHost(host)).toBe(true));

    it.each(['example.com', 'en.wikipedia.org', '8.8.8.8', '172.32.0.1', '172.15.0.1', '100.63.0.1'])(
        'allows %s', (host) => expect(isBlockedHost(host)).toBe(false),
    );

    it('blocks the proxy and portfolio hosts', () => {
        expect(isBlockedHost('p.workers.dev', ['p.workers.dev'])).toBe(true);
    });
});

describe('targetFromRequest', () => {
    it('reads the target from the path and keeps the query', () => {
        expect(targetFromRequest(`${W}/https://example.com/a?b=1`).href).toBe('https://example.com/a?b=1');
    });

    it('rejects non-http(s), credentials, odd ports and blocked hosts', () => {
        expect(targetFromRequest(`${W}/ftp://example.com/`)).toBeNull();
        expect(targetFromRequest(`${W}/`)).toBeNull();
        expect(targetFromRequest(`${W}/https://user:pw@example.com/`)).toBeNull();
        expect(targetFromRequest(`${W}/https://example.com:8080/`)).toBeNull();
        expect(targetFromRequest(`${W}/http://169.254.169.254/latest`)).toBeNull();
        expect(targetFromRequest(`${W}/http://localhost:5173/`)).toBeNull();
    });
});

describe('toProxied', () => {
    it('resolves relative URLs against the page', () => {
        expect(toProxied('../x.png', 'https://a.com/b/c/', W)).toBe(`${W}/https://a.com/b/x.png`);
        expect(toProxied('//cdn.com/x.js', 'https://a.com/', W)).toBe(`${W}/https://cdn.com/x.js`);
    });

    it('leaves non-fetchable and already proxied values alone', () => {
        for (const value of ['#top', 'data:image/png;base64,AA', 'javascript:void(0)', 'mailto:a@b.c', '']) {
            expect(toProxied(value, 'https://a.com/', W)).toBe(value);
        }
        expect(toProxied(`${W}/https://a.com/x`, 'https://a.com/', W)).toBe(`${W}/https://a.com/x`);
    });
});

describe('proxySrcset and proxyCss', () => {
    it('rewrites each srcset candidate and keeps descriptors', () => {
        expect(proxySrcset('a.png 1x, b.png 2x', 'https://a.com/', W))
            .toBe(`${W}/https://a.com/a.png 1x, ${W}/https://a.com/b.png 2x`);
    });

    it('rewrites url() and @import', () => {
        expect(proxyCss('a{background:url("/i.png")} @import "x.css";', 'https://a.com/s/', W))
            .toBe(`a{background:url("${W}/https://a.com/i.png")} @import "${W}/https://a.com/s/x.css";`);
    });
});

describe('headers', () => {
    it('forwards only safe request headers', () => {
        const out = requestHeadersFor(new Headers({ cookie: 'a=1', authorization: 'x', referer: 'y', accept: 'text/html', 'user-agent': 'ua' }));

        expect([...out.keys()].sort()).toEqual(['accept', 'user-agent']);
    });

    it('strips framing/cookie headers, locks the parent and rewrites Location', () => {
        const out = responseHeadersFor(
            new Headers({ 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'", 'set-cookie': 'a=1', location: '/next', 'content-length': '5' }),
            { parents: ['https://me.dev'], rewritten: true, workerOrigin: W, base: 'https://a.com/x' },
        );

        expect(out.get('x-frame-options')).toBeNull();
        expect(out.get('set-cookie')).toBeNull();
        expect(out.get('content-length')).toBeNull();
        expect(out.get('content-security-policy')).toBe(`frame-ancestors https://me.dev ${W}`);
        expect(out.get('referrer-policy')).toBe('same-origin');
        expect(out.get('location')).toBe(`${W}/https://a.com/next`);
    });
});

describe('targetFromReferer', () => {
    it('resolves a path a script built against the proxied page that requested it', () => {
        expect(targetFromReferer(`${W}/results?q=x`, `${W}/https://www.youtube.com/feed/a?b=1`, W)).toBe('https://www.youtube.com/results?q=x');
        expect(targetFromReferer(`${W}/static/app.js`, `${W}/https://a.com/dir/page`, W)).toBe('https://a.com/static/app.js');
    });

    it('needs a proxied page on the proxy as the referer', () => {
        expect(targetFromReferer(`${W}/results`, null, W)).toBeNull();
        expect(targetFromReferer(`${W}/results`, 'https://me.dev/', W)).toBeNull();
        expect(targetFromReferer(`${W}/results`, `${W}/`, W)).toBeNull();
        expect(targetFromReferer(`${W}/results`, `${W}/https://localhost/x`, W)).toBeNull();
        expect(targetFromReferer(`${W}/`, `${W}/https://a.com/x`, W)).toBe('https://a.com/');
    });
});

describe('bingClickTarget', () => {
    it('decodes the destination of a Bing result link', () => {
        // u = "a1" + base64url("https://react.dev/")
        const url = new URL('https://www.bing.com/ck/a?!&&p=abc&ptn=3&u=a1aHR0cHM6Ly9yZWFjdC5kZXYv&ntb=1');

        expect(bingClickTarget(url)).toBe('https://react.dev/');
    });

    it('ignores other links and malformed or non-web destinations', () => {
        expect(bingClickTarget(new URL('https://www.bing.com/search?q=x'))).toBeNull();
        expect(bingClickTarget(new URL('https://example.com/ck/a?u=a1aHR0cHM6Ly9yZWFjdC5kZXYv'))).toBeNull();
        expect(bingClickTarget(new URL('https://www.bing.com/ck/a?u=a1amF2YXNjcmlwdDphbGVydCgxKQ'))).toBeNull(); // javascript:alert(1)
        expect(bingClickTarget(new URL('https://www.bing.com/ck/a?u=zz'))).toBeNull();
        expect(bingClickTarget(new URL('https://www.bing.com/ck/a'))).toBeNull();
    });
});

describe('isRefusedType / kindOf', () => {
    it('refuses video and oversize bodies', () => {
        expect(isRefusedType('video/mp4')).toBe(true);
        expect(isRefusedType('image/png', '20000000')).toBe(true);
        expect(isRefusedType('text/html', '1000')).toBe(false);
    });

    it('classifies content', () => {
        expect(kindOf('text/html; charset=utf-8')).toBe('html');
        expect(kindOf('text/css')).toBe('css');
        expect(kindOf('image/png')).toBe('other');
    });
});
