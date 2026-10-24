import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, RotateCw, X } from 'lucide-react';

import CantOpenPage from '../components/browser/CantOpenPage';
import FavoritesPage from '../components/browser/FavoritesPage';
import WindowControls from '../components/WindowControl';
import WindowWrapper from '../hoc/WindowWrapper';
import useProjects from '../hooks/useProjects';
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
    pageEntry,
} from '../lib/browser';
import useWindowStore from '../store/window';

// Worker that lets sites which refuse framing (Google, GitHub…) show inside
// Safari; see proxy/. Unset, every site is framed directly.
const PROXY_URL = import.meta.env.VITE_SAFARI_PROXY_URL ?? '';
const PROXY_ORIGIN = PROXY_URL ? new URL(PROXY_URL).origin : null;

// Embedded sites may run scripts, submit forms and open popups, but never
// navigate the portfolio itself (no allow-top-navigation).
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox';

const Browser = () => {
    const [browser, dispatch] = useReducer(browserReducer, undefined, createBrowserState);
    const [draft, setDraft] = useState(null);
    const isOpen = useWindowStore((state) => state.windows.safari.isOpen);
    const request = useWindowStore((state) => state.windows.safari.data);

    const frames = useRef(new Map());
    const { projects } = useProjects();

    // The portfolio's own projects are known to allow framing: skip the proxy for them.
    const directHosts = useMemo(
        () => favoritesFromProjects(projects).map((favorite) => hostnameOf(favorite.url)),
        [projects],
    );

    const tab = activeTab(browser);
    const entry = currentEntry(tab);

    // A proxied page reports the real address and title it is showing, so the
    // address bar and tab follow links clicked inside the frame.
    useEffect(() => {
        if (!PROXY_ORIGIN) return undefined;

        const onMessage = (event) => {
            if (event.origin !== PROXY_ORIGIN || event.data?.type !== 'safari:page') return;

            const id = [...frames.current].find(([, frame]) => frame?.contentWindow === event.source)?.[0];
            const url = normalizeAddress(event.data.url);

            if (id && url) dispatch({ type: 'framed', id, url, title: String(event.data.title ?? '').slice(0, 120) });
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
            entry: url ? pageEntry(url, request.title) : errorEntry(String(request.url)),
        });
    }, [request]);

    const open = (entryToOpen) => {
        dispatch({ type: 'navigate', entry: entryToOpen });
        setDraft(null);
    };

    const submitAddress = (event) => {
        event.preventDefault();

        const text = draft ?? '';
        const input = event.currentTarget.querySelector('input');

        // An empty address bar is not an error: just leave it.
        if (text.trim() !== '') {
            const url = addressOrSearch(text);

            open(url ? pageEntry(url, url === normalizeAddress(text) ? undefined : text.trim()) : errorEntry(text));
        }
        input?.blur();
    };

    return (
        <div className="browser">
            <div className="browser-toolbar" data-titlebar>
                <WindowControls target="safari" />

                <div className="browser-nav">
                    <button
                        type="button"
                        aria-label="Back"
                        disabled={tab.index === 0}
                        onClick={() => dispatch({ type: 'back' })}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        aria-label="Forward"
                        disabled={tab.index === tab.history.length - 1}
                        onClick={() => dispatch({ type: 'forward' })}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <form className="browser-address" onSubmit={submitAddress}>
                    <input
                        aria-label="Address"
                        placeholder="Search or enter website name"
                        spellCheck={false}
                        value={draft ?? entry.location ?? entry.url ?? ''}
                        onFocus={(event) => {
                            setDraft(entry.location ?? entry.url ?? '');
                            event.target.select();
                        }}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => setDraft(null)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') event.currentTarget.blur();
                        }}
                    />
                    {entry.url && (
                        <button type="button" aria-label="Reload" onClick={() => dispatch({ type: 'reload' })}>
                            <RotateCw size={13} />
                        </button>
                    )}
                </form>

                <button
                    type="button"
                    className="browser-new-tab"
                    aria-label="New tab"
                    onClick={() => dispatch({ type: 'newTab' })}
                >
                    <Plus size={18} />
                </button>
            </div>

            <div className="browser-tabs" role="tablist">
                {browser.tabs.map((item) => (
                    <div
                        key={item.id}
                        role="tab"
                        aria-selected={item.id === browser.activeTabId}
                        className={`browser-tab${item.id === browser.activeTabId ? ' is-active' : ''}`}
                        onClick={() => dispatch({ type: 'selectTab', id: item.id })}
                    >
                        <span className="browser-tab-title">{currentEntry(item).title}</span>
                        <button
                            type="button"
                            aria-label="Close tab"
                            onClick={(event) => {
                                event.stopPropagation();
                                dispatch({ type: 'closeTab', id: item.id });
                            }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="browser-content">
                {tab.loading && <div className="browser-progress" />}

                {browser.tabs.map((item) => {
                    const itemEntry = currentEntry(item);

                    // Closed Safari stops its sites; tabs and history stay in the reducer.
                    if (!itemEntry.url || !isOpen) return null;

                    return (
                        <iframe
                            key={`${item.id}:${item.index}:${item.reloadKey}`}
                            title={itemEntry.title}
                            ref={(node) => {
                                if (node) frames.current.set(item.id, node);
                                else frames.current.delete(item.id);
                            }}
                            src={frameSrc(itemEntry.url, PROXY_URL, directHosts)}
                            sandbox={IFRAME_SANDBOX}
                            allow="fullscreen"
                            referrerPolicy="strict-origin-when-cross-origin"
                            className="browser-frame"
                            hidden={item.id !== browser.activeTabId}
                            onLoad={() => dispatch({ type: 'loaded', id: item.id })}
                        />
                    );
                })}

                {!entry.url && entry.error === undefined && (
                    <FavoritesPage onOpen={(favorite) => open(pageEntry(favorite.url, favorite.title))} />
                )}
                {!entry.url && entry.error !== undefined && <CantOpenPage input={entry.error} />}
            </div>
        </div>
    );
};

const BrowserWindow = WindowWrapper(Browser, 'safari');
export default BrowserWindow;
