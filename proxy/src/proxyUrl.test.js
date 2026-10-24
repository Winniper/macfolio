import { describe, expect, it } from 'vitest';

import {
    isBlockedHost, isRefusedType, kindOf, proxyCss, proxySrcset, requestHeadersFor,
    responseHeadersFor, targetFromRequest, toProxied,
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
        expect(out.get('content-security-policy')).toBe('frame-ancestors https://me.dev');
        expect(out.get('location')).toBe(`${W}/https://a.com/next`);
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
