import { useEffect, useReducer, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, RotateCw, X } from 'lucide-react';

import CantOpenPage from '../components/browser/CantOpenPage';
import FavoritesPage from '../components/browser/FavoritesPage';
import WindowControls from '../components/WindowControl';
import WindowWrapper from '../hoc/WindowWrapper';
import {
    activeTab,
    browserReducer,
    createBrowserState,
    currentEntry,
    errorEntry,
    normalizeAddress,
    pageEntry,
} from '../lib/browser';
import useWindowStore from '../store/window';

// Embedded sites may run scripts, submit forms and open popups, but never
// navigate the portfolio itself (no allow-top-navigation).
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';

const Browser = () => {
    const [browser, dispatch] = useReducer(browserReducer, undefined, createBrowserState);
    const [draft, setDraft] = useState(null);
    const request = useWindowStore((state) => state.windows.safari.data);

    const tab = activeTab(browser);
    const entry = currentEntry(tab);

    // openWindow('safari', { url, title }) — e.g. from Finder — opens a new tab.
    // Each call passes a new object, so the same project twice opens twice.
    useEffect(() => {
        const url = request?.url ? normalizeAddress(request.url) : null;

        if (url) dispatch({ type: 'newTab', entry: pageEntry(url, request.title) });
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
            const url = normalizeAddress(text);

            open(url ? pageEntry(url) : errorEntry(text));
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
                        value={draft ?? entry.url ?? ''}
                        onFocus={(event) => {
                            setDraft(entry.url ?? '');
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

                    if (!itemEntry.url) return null;

                    return (
                        <iframe
                            key={`${item.id}:${item.index}:${item.reloadKey}`}
                            title={itemEntry.title}
                            src={itemEntry.url}
                            sandbox={IFRAME_SANDBOX}
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
