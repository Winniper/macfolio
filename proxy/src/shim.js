// Runs first inside every proxied page (injected by worker.js). It keeps
// script-made requests and links on the proxy and tells the portfolio's Safari
// which real URL and title the frame is showing. It only ever sends that URL
// and title to the parent, never page data.

// Source of the script; __P is defined by a preceding inline script:
// { origin: <proxy origin>, base: <real page URL> }.
export const SHIM_SOURCE = `(() => {
  const P = window.__P;
  if (!P || window.__shimmed) return;
  window.__shimmed = true;

  const SKIP = /^(data:|blob:|javascript:|mailto:|tel:|about:|#)/i;
  const prox = (value, base = P.base) => {
    if (typeof value !== 'string' && !(value instanceof URL)) return value;
    const text = String(value).trim();
    if (!text || SKIP.test(text)) return value;
    try {
      const url = new URL(text, base);
      if (!/^https?:$/.test(url.protocol) || url.origin === P.origin) return value;
      return P.origin + '/' + url.href;
    } catch { return value; }
  };
  const real = (href) => {
    const prefix = P.origin + '/';
    return href.startsWith(prefix) ? href.slice(prefix.length) : href;
  };

  const nativeFetch = window.fetch;
  window.fetch = (input, init) => {
    if (input instanceof Request) return nativeFetch(new Request(prox(input.url), input), init);
    return nativeFetch(prox(input), init);
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    return nativeOpen.call(this, method, prox(url), ...rest);
  };

  const nativeWindowOpen = window.open;
  window.open = (url, ...rest) => nativeWindowOpen.call(window, url ? prox(url) : url, ...rest);

  const report = () => {
    try {
      parent.postMessage({ type: 'safari:page', url: P.base, title: document.title || '' }, '*');
    } catch { /* not framed */ }
  };

  for (const method of ['pushState', 'replaceState']) {
    const native = history[method];
    history[method] = function (state, title, url) {
      if (url != null) {
        // Resolve like the page does (against the proxied address), then map back to the real URL.
        const resolved = new URL(String(url), location.href);
        const target = new URL(resolved.origin === P.origin ? real(resolved.href) : resolved.href);
        P.base = target.href;
        return native.call(this, state, title, P.origin + '/' + target.href);
      }
      return native.call(this, state, title);
    };
  }
  window.addEventListener('popstate', () => { P.base = real(location.href); report(); });

  const ATTRS = { A: 'href', AREA: 'href', LINK: 'href', IMG: 'src', SCRIPT: 'src', IFRAME: 'src', SOURCE: 'src', VIDEO: 'src', AUDIO: 'src', FORM: 'action' };
  const fix = (el) => {
    const attr = ATTRS[el.tagName];
    if (!attr) return;
    const value = el.getAttribute(attr);
    const next = value && prox(value);
    if (next && next !== value) el.setAttribute(attr, next);
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') fix(record.target);
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        fix(node);
        node.querySelectorAll?.('a[href],area[href],link[href],img[src],script[src],iframe[src],source[src],form[action]').forEach(fix);
      }
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'src', 'action'] });

  window.addEventListener('load', report);
  document.addEventListener('DOMContentLoaded', () => {
    report();
    const title = document.querySelector('title');
    if (title) new MutationObserver(report).observe(title, { childList: true });
  });
  report();
})();`;
