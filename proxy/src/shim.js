// Runs first inside every proxied page (injected by worker.js). It keeps
// script-made requests and links on the proxy, tells the portfolio's Safari
// which real URL and title the frame is showing ('safari:page') and asks it
// for a new tab when the page opens a popup or a target="_blank" link
// ('safari:open'). It only ever sends URLs and the title to the parent, never
// page data.

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

  const send = (message) => {
    try {
      parent.postMessage(message, '*');
    } catch { /* not framed */ }
  };
  const report = () => send({ type: 'safari:page', url: P.base, title: document.title || '' });

  // Popups would open the proxy address at top level, which the worker refuses:
  // ask Safari for a new tab instead.
  const openInTab = (value) => {
    try {
      const url = new URL(String(value), P.base);
      if (!/^https?:$/.test(url.protocol)) return false;
      send({ type: 'safari:open', url: url.origin === P.origin ? real(url.href) : url.href });
      return true;
    } catch { return false; }
  };
  window.open = (url) => { if (url) openInTab(url); return null; };
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.target !== '_blank') return;
    if (openInTab(anchor.href)) event.preventDefault();
  }, true);

  // A URL the page hands to history/navigation -> the real URL it means: a
  // proxied absolute URL maps back, anything else (relative paths included)
  // resolves against the real page URL. Browsers refuse a cross-origin
  // same-document entry; so does the shim (Bing's redirect page tries
  // document.referrer, the portfolio).
  const realTarget = (url) => {
    const text = String(url);
    const asProxied = new URL(text, location.href);
    const target = asProxied.href.startsWith(P.origin + '/http') ? new URL(real(asProxied.href)) : new URL(text, P.base);
    if (target.origin !== new URL(P.base).origin) throw new DOMException('Cross-origin history entry', 'SecurityError');
    return target.href;
  };
  const entered = (href) => { P.base = href; report(); };

  // Patched on the prototype: sites call History.prototype.pushState directly.
  for (const method of ['pushState', 'replaceState']) {
    const native = History.prototype[method];
    History.prototype[method] = function (state, title, url) {
      if (url == null) return native.call(this, state, title);
      const href = realTarget(url);
      const result = native.call(this, state, title, P.origin + '/' + href);
      entered(href);
      return result;
    };
  }
  window.addEventListener('popstate', () => { P.base = real(location.href); report(); });

  // Navigation API (Chromium). location.href = ... and location.assign()
  // can't be wrapped, but a navigation to another site can be cancelled here
  // (this listener runs first) and re-issued on the proxy. A path on the proxy
  // origin is left alone: a same-document router (YouTube) intercepts it and
  // the address is repaired below; otherwise the worker resolves it from the
  // Referer.
  if (window.navigation) {
    navigation.addEventListener('navigate', (event) => {
      if (!event.cancelable || !['push', 'replace'].includes(event.navigationType)) return;
      let target;
      try { target = new URL(event.destination.url); } catch { return; }
      if (!/^https?:$/.test(target.protocol) || target.origin === P.origin) return;
      event.preventDefault();
      navigation.navigate(P.origin + '/' + target.href, { history: event.navigationType });
    });
    navigation.addEventListener('currententrychange', () => {
      const href = location.href;
      if (href.startsWith(P.origin + '/http')) {
        const current = real(href);
        if (current !== P.base) entered(current);
        return;
      }
      // Same-document navigation to a bare path: show it as the proxied address.
      try {
        const fixed = new URL(location.pathname + location.search + location.hash, P.base).href;
        History.prototype.replaceState.call(history, history.state, '', fixed);
      } catch { /* leave it */ }
    });
  }

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
