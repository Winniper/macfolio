import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, RotateCw, X } from 'lucide-react';

import BlockedPage from '../../components/browser/BlockedPage';
import CantOpenPage from '../../components/browser/CantOpenPage';
import FavoritesPage from '../../components/browser/FavoritesPage';
import useBrowserTabs from '../../hooks/useBrowserTabs';
import { addressOrSearch, currentEntry, errorEntry, resolveEntry } from '../../lib/browser';
import AppScreen from '../AppScreen';

// The grid of open tabs: tap a card to switch, x to close, + for a new tab.
const TabGrid = ({ browser, dispatch, onDone }) => (
    <div className="phone-safari-tabs" role="dialog" aria-label="Tabs">
        <div className="phone-safari-tabs-grid phone-scroll">
            {browser.tabs.map((item) => (
                <div
                    key={item.id}
                    className={`phone-safari-card${item.id === browser.activeTabId ? ' is-active' : ''}`}
                >
                    <button
                        type="button"
                        className="phone-safari-card-open"
                        onClick={() => {
                            dispatch({ type: 'selectTab', id: item.id });
                            onDone();
                        }}
                    >
                        <span className="phone-safari-card-title">{currentEntry(item).title}</span>
                    </button>
                    <button
                        type="button"
                        className="phone-safari-card-close"
                        aria-label={`Close ${currentEntry(item).title}`}
                        onClick={() => dispatch({ type: 'closeTab', id: item.id })}
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            ))}
        </div>
        <div className="phone-safari-tabs-bar">
            <button type="button" aria-label="New tab" onClick={() => { dispatch({ type: 'newTab' }); onDone(); }}>
                <Plus size={26} aria-hidden="true" />
            </button>
            <button type="button" className="phone-safari-done" onClick={onDone}>Done</button>
        </div>
    </div>
);

const SafariApp = () => {
    const { browser, tab, entry, dispatch, open: openEntry, go, frames } = useBrowserTabs();
    const [draft, setDraft] = useState(null);
    const [gridOpen, setGridOpen] = useState(false);

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

    const toolbar = (
        <div className="phone-safari-toolbar">
            <button
                type="button"
                aria-label="Back"
                disabled={tab.index === 0}
                onClick={() => dispatch({ type: 'back' })}
            >
                <ChevronLeft size={24} aria-hidden="true" />
            </button>
            <button
                type="button"
                aria-label="Forward"
                disabled={tab.index === tab.history.length - 1}
                onClick={() => dispatch({ type: 'forward' })}
            >
                <ChevronRight size={24} aria-hidden="true" />
            </button>

            <form className="phone-safari-address" onSubmit={submitAddress}>
                <input
                    aria-label="Address"
                    placeholder="Search or enter website name"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={draft ?? entry.url ?? ''}
                    onFocus={(event) => {
                        setDraft(entry.url ?? '');
                        event.target.select();
                    }}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => setDraft(null)}
                />
                {entry.url && (
                    <button type="button" aria-label="Reload" onClick={() => dispatch({ type: 'reload' })}>
                        <RotateCw size={16} aria-hidden="true" />
                    </button>
                )}
            </form>

            <button type="button" className="phone-safari-tabs-button" aria-label="Tabs" onClick={() => setGridOpen(true)}>
                <span>{browser.tabs.length}</span>
            </button>
        </div>
    );

    return (
        <div className="phone-safari">
            <AppScreen title="Safari" flush toolbar={toolbar}>
                <div className="phone-safari-page">
                    {tab.loading && <div className="browser-progress" />}

                    {frames.map((frame) => (
                        <iframe key={frame.key} {...frame.props} className="phone-safari-frame" hidden={frame.hidden} />
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
            </AppScreen>
            {gridOpen && <TabGrid browser={browser} dispatch={dispatch} onDone={() => setGridOpen(false)} />}
        </div>
    );
};

export default SafariApp;
