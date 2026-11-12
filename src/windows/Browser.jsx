import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, RotateCw, X } from 'lucide-react';

import BlockedPage from '../components/browser/BlockedPage';
import CantOpenPage from '../components/browser/CantOpenPage';
import FavoritesPage from '../components/browser/FavoritesPage';
import WindowControls from '../components/WindowControl';
import WindowWrapper from '../hoc/WindowWrapper';
import useBrowserTabs from '../hooks/useBrowserTabs';
import { addressOrSearch, currentEntry, errorEntry, resolveEntry } from '../lib/browser';

const Browser = () => {
    const { browser, tab, entry, dispatch, open: openEntry, go, frames } = useBrowserTabs();
    const [draft, setDraft] = useState(null);

    const open = (entryToOpen) => {
        openEntry(entryToOpen);
        setDraft(null);
    };

    const submitAddress = (event) => {
        event.preventDefault();

        const input = event.currentTarget.querySelector('input');

        go(draft ?? '');
        setDraft(null);
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

                {frames.map((frame) => (
                    <iframe key={frame.key} {...frame.props} className="browser-frame" hidden={frame.hidden} />
                ))}

                {!entry.url && entry.error === undefined && entry.blocked === undefined && (
                    <FavoritesPage onOpen={(favorite) => open(resolveEntry(favorite.url, favorite.title))} />
                )}
                {!entry.url && entry.error !== undefined && <CantOpenPage input={entry.error} />}
                {!entry.url && entry.blocked !== undefined && (
                    <BlockedPage
                        url={entry.blocked}
                        onSearch={(text) => {
                            const url = addressOrSearch(text);

                            open(url ? resolveEntry(url, text) : errorEntry(text));
                        }}
                    />
                )}
            </div>
        </div>
    );
};

const BrowserWindow = WindowWrapper(Browser, 'safari');
export default BrowserWindow;
