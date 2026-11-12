import { useEffect, useMemo, useReducer, useRef } from 'react';

import useProjects from './useProjects';
import {
    activeTab,
    addressOrSearch,
    browserReducer,
    createBrowserState,
    currentEntry,
    errorEntry,
    favoritesFromProjects,
    frameSrc,
    hostnameOf,
    normalizeAddress,
    portfolioHosts,
    resolveEntry,
} from '../lib/browser';
import useWindowStore from '../store/window';

// Worker that lets sites which refuse framing (Google, GitHub…) show inside
// Safari; see proxy/. Unset, every site is framed directly.
const PROXY_URL = import.meta.env.VITE_SAFARI_PROXY_URL ?? '';
const PROXY_ORIGIN = PROXY_URL ? new URL(PROXY_URL).origin : null;

// Embedded sites may run scripts, submit forms and open popups, but never
// navigate the portfolio itself (no allow-top-navigation).
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox';

// Safari's tabs, history and iframes, shared by the desktop window and the
// phone app. Each item of `frames` is one tab's iframe: render
// <iframe key={frame.key} {...frame.props} />.
const useBrowserTabs = () => {
    const [browser, dispatch] = useReducer(browserReducer, undefined, createBrowserState);
    const isOpen = useWindowStore((state) => state.windows.safari.isOpen);
    const request = useWindowStore((state) => state.windows.safari.data);

    const frames = useRef(new Map());
    const { projects } = useProjects();

    // The portfolio itself and its projects are known to allow framing: skip the proxy for them.
    const directHosts = useMemo(
        () => [...portfolioHosts(window.location.href), ...favoritesFromProjects(projects).map((favorite) => hostnameOf(favorite.url))],
        [projects],
    );

    const tab = activeTab(browser);
    const entry = currentEntry(tab);

    // A proxied page reports the real address and title it is showing, so the
    // address bar and history follow links clicked inside the frame; popups
    // and target="_blank" links ask for a new tab.
    useEffect(() => {
        if (!PROXY_ORIGIN) return undefined;

        const onMessage = (event) => {
            if (event.origin !== PROXY_ORIGIN) return;

            const id = [...frames.current].find(([, frame]) => frame?.contentWindow === event.source)?.[0];
            const url = normalizeAddress(event.data?.url);

            if (!id || !url) return;

            if (event.data.type === 'safari:page') {
                dispatch({ type: 'framed', id, url, title: String(event.data.title ?? '').slice(0, 120) });
            } else if (event.data.type === 'safari:open') {
                dispatch({ type: 'newTab', entry: resolveEntry(url) });
            }
        };

        window.addEventListener('message', onMessage);

        return () => window.removeEventListener('message', onMessage);
    }, []);

    // openWindow('safari', { url, title }) — e.g. from Finder — opens a new tab.
    // Each call passes a new object, so the same project twice opens twice.
    useEffect(() => {
        // File → New Tab
        if (request?.newTab) {
            dispatch({ type: 'newTab' });
            return;
        }

        if (!request?.url) return;

        const url = normalizeAddress(request.url);

        dispatch({
            type: 'newTab',
            entry: url ? resolveEntry(url, request.title) : errorEntry(String(request.url)),
        });
    }, [request]);

    const open = (entryToOpen) => {
        dispatch({ type: 'navigate', entry: entryToOpen });
    };

    // The address-bar submit: a URL, a search, or the "can't open" page.
    const go = (text) => {
        // An empty address bar is not an error: just leave it.
        if (text.trim() === '') return;

        const url = addressOrSearch(text);

        open(url ? resolveEntry(url, url === normalizeAddress(text) ? undefined : text.trim()) : errorEntry(text));
    };

    // Closed Safari stops its sites; tabs and history stay in the reducer.
    const frameList = !isOpen ? [] : browser.tabs
        .filter((item) => currentEntry(item).url)
        .map((item) => ({
            id: item.id,
            key: `${item.id}:${item.frame.key}`,
            hidden: item.id !== browser.activeTabId,
            props: {
                title: currentEntry(item).title,
                ref: (node) => {
                    if (node) frames.current.set(item.id, node);
                    else frames.current.delete(item.id);
                },
                src: frameSrc(item.frame.url, PROXY_URL, directHosts),
                sandbox: IFRAME_SANDBOX,
                allow: 'fullscreen',
                referrerPolicy: 'strict-origin-when-cross-origin',
                onLoad: () => dispatch({ type: 'loaded', id: item.id }),
            },
        }));

    return { browser, tab, entry, dispatch, open, go, frames: frameList };
};

export default useBrowserTabs;
