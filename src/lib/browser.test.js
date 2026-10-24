import { describe, it, expect } from 'vitest';
import {
    FAVORITES_ENTRY,
    addressOrSearch,
    frameSrc,
    youtubeEmbed,
    activeTab,
    browserReducer,
    createBrowserState,
    currentEntry,
    errorEntry,
    favoritesFromProjects,
    hostnameOf,
    normalizeAddress,
    pageEntry,
} from './browser';

describe('normalizeAddress', () => {
    it('adds https:// to a bare domain', () => {
        expect(normalizeAddress('example.com')).toBe('https://example.com/');
        expect(normalizeAddress('  my-app.vercel.app/about  ')).toBe('https://my-app.vercel.app/about');
    });

    it('keeps an explicit http or https scheme', () => {
        expect(normalizeAddress('http://example.com/x')).toBe('http://example.com/x');
        expect(normalizeAddress('HTTPS://Example.com')).toBe('https://example.com/');
    });

    it('accepts localhost with a port', () => {
        expect(normalizeAddress('localhost:5173')).toBe('https://localhost:5173/');
    });

    it('rejects text that is not a web address', () => {
        expect(normalizeAddress('')).toBeNull();
        expect(normalizeAddress('   ')).toBeNull();
        expect(normalizeAddress('hello world')).toBeNull();
        expect(normalizeAddress('portfolio')).toBeNull();
    });

    it('never loads non-web schemes', () => {
        expect(normalizeAddress('javascript:alert(1)')).toBeNull();
        expect(normalizeAddress('data:text/html,hi')).toBeNull();
        expect(normalizeAddress('ftp://example.com')).toBeNull();
        expect(normalizeAddress('file:///etc/passwd')).toBeNull();
    });
});

describe('non-string input', () => {
    it('never throws and yields null', () => {
        for (const value of [42, null, undefined, {}, true]) {
            expect(() => normalizeAddress(value)).not.toThrow();
            expect(normalizeAddress(value)).toBeNull();
        }
    });

    it('skips projects whose website is not a string', () => {
        expect(favoritesFromProjects([{ id: 'x', title: 'X', website: 42 }])).toEqual([]);
    });
});

describe('entries and favorites', () => {
    it('names a page after its host', () => {
        expect(hostnameOf('https://www.example.com/a')).toBe('example.com');
        expect(pageEntry('https://app.dev/')).toEqual({ url: 'https://app.dev/', title: 'app.dev' });
        expect(pageEntry('https://app.dev/', 'My App')).toEqual({ url: 'https://app.dev/', title: 'My App' });
    });

    it('describes an address that could not be opened', () => {
        expect(errorEntry('hello world')).toEqual({ url: null, error: 'hello world', title: 'Failed to open page' });
    });

    it('builds favorites from projects with a usable website', () => {
        expect(favoritesFromProjects([
            { id: 'a', title: 'Shop', website: 'shop.example.com' },
            { id: 'b', title: 'No site', website: '' },
            { id: 'c', title: 'Missing' },
            { id: 'd', title: 'Bad', website: 'not a url' },
        ])).toEqual([{ id: 'a', title: 'Shop', url: 'https://shop.example.com/' }]);
    });
});

describe('browserReducer', () => {
    const a = pageEntry('https://a.dev/');
    const b = pageEntry('https://b.dev/');
    const c = pageEntry('https://c.dev/');
    const run = (actions, state = createBrowserState()) => actions.reduce(browserReducer, state);

    it('starts with one Favorites tab', () => {
        const state = createBrowserState();
        expect(state.tabs).toHaveLength(1);
        expect(currentEntry(activeTab(state))).toEqual(FAVORITES_ENTRY);
    });

    it('navigates the active tab and shows loading until loaded', () => {
        const state = run([{ type: 'navigate', entry: a }]);
        const tab = activeTab(state);
        expect(currentEntry(tab)).toEqual(a);
        expect(tab.loading).toBe(true);
        expect(activeTab(browserReducer(state, { type: 'loaded', id: tab.id })).loading).toBe(false);
    });

    it('goes back and forward through its own history', () => {
        const state = run([{ type: 'navigate', entry: a }, { type: 'navigate', entry: b }, { type: 'back' }]);
        expect(currentEntry(activeTab(state))).toEqual(a);
        expect(currentEntry(activeTab(browserReducer(state, { type: 'forward' })))).toEqual(b);
    });

    it('stops at the ends of history', () => {
        const state = run([{ type: 'back' }, { type: 'forward' }]);
        expect(currentEntry(activeTab(state))).toEqual(FAVORITES_ENTRY);
        expect(activeTab(state).index).toBe(0);
    });

    it('drops forward history when navigating after going back', () => {
        const state = run([
            { type: 'navigate', entry: a },
            { type: 'navigate', entry: b },
            { type: 'back' },
            { type: 'navigate', entry: c },
            { type: 'forward' },
        ]);
        expect(activeTab(state).history).toEqual([FAVORITES_ENTRY, a, c]);
        expect(currentEntry(activeTab(state))).toEqual(c);
    });

    it('reloads by bumping the reload key', () => {
        const state = run([{ type: 'navigate', entry: a }, { type: 'loaded', id: 1 }, { type: 'reload' }]);
        expect(activeTab(state)).toMatchObject({ reloadKey: 1, loading: true });
    });

    it('opens new tabs, focused, on Favorites or a given page', () => {
        const state = run([{ type: 'newTab' }, { type: 'newTab', entry: a }]);
        expect(state.tabs.map((tab) => tab.id)).toEqual([1, 2, 3]);
        expect(state.activeTabId).toBe(3);
        expect(currentEntry(activeTab(state))).toEqual(a);
        expect(state.tabs[1].history).toEqual([FAVORITES_ENTRY]);
    });

    it('selects a tab', () => {
        const state = run([{ type: 'newTab' }, { type: 'selectTab', id: 1 }]);
        expect(state.activeTabId).toBe(1);
    });

    it('activates the right-hand neighbor when closing the active tab, else the left', () => {
        const three = run([{ type: 'newTab' }, { type: 'newTab' }, { type: 'selectTab', id: 2 }]);
        expect(browserReducer(three, { type: 'closeTab', id: 2 }).activeTabId).toBe(3);
        expect(browserReducer(three, { type: 'closeTab', id: 3 }).activeTabId).toBe(2);
        const lastActive = run([{ type: 'newTab' }]);
        expect(browserReducer(lastActive, { type: 'closeTab', id: 2 }).activeTabId).toBe(1);
    });

    it('replaces the last tab with a fresh Favorites tab instead of leaving none', () => {
        const state = run([{ type: 'navigate', entry: a }, { type: 'closeTab', id: 1 }]);
        expect(state.tabs).toHaveLength(1);
        expect(state.activeTabId).toBe(2);
        expect(currentEntry(activeTab(state))).toEqual(FAVORITES_ENTRY);
    });

    it('ignores actions for tabs that do not exist', () => {
        const state = createBrowserState();
        expect(browserReducer(state, { type: 'closeTab', id: 99 })).toBe(state);
        expect(browserReducer(state, { type: 'selectTab', id: 99 })).toBe(state);
        expect(browserReducer(state, { type: 'loaded', id: 99 })).toBe(state);
    });
});

describe('addressOrSearch', () => {
    it('keeps web addresses', () => {
        expect(addressOrSearch('example.com')).toBe('https://example.com/');
    });

    it('turns plain words into a DuckDuckGo search', () => {
        expect(addressOrSearch('react hooks')).toBe('https://html.duckduckgo.com/html/?q=react%20hooks');
        expect(addressOrSearch('react')).toBe('https://html.duckduckgo.com/html/?q=react');
        expect(addressOrSearch('c++ & rust?')).toBe('https://html.duckduckgo.com/html/?q=c%2B%2B%20%26%20rust%3F');
    });

    it('rejects empty input and other schemes', () => {
        for (const bad of ['', '   ', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://x.com', null, 42]) {
            expect(addressOrSearch(bad)).toBeNull();
        }
    });
});

describe('youtubeEmbed', () => {
    it('maps watch, short and youtu.be links to the privacy embed', () => {
        const embed = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
        expect(youtubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5')).toBe(embed);
        expect(youtubeEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe(embed);
        expect(youtubeEmbed('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe(embed);
    });

    it('ignores other YouTube pages and other sites', () => {
        expect(youtubeEmbed('https://www.youtube.com/')).toBeNull();
        expect(youtubeEmbed('https://www.youtube.com/watch?v=')).toBeNull();
        expect(youtubeEmbed('https://example.com/watch?v=abcdefgh')).toBeNull();
        expect(youtubeEmbed('nope')).toBeNull();
    });
});

describe('frameSrc', () => {
    const proxy = 'https://p.workers.dev/';

    it('frames directly without a proxy', () => {
        expect(frameSrc('https://www.google.com/', '')).toBe('https://www.google.com/');
    });

    it('routes other sites through the proxy', () => {
        expect(frameSrc('https://www.google.com/', proxy)).toBe('https://p.workers.dev/https://www.google.com/');
    });

    it('loads known framable hosts and extra direct hosts directly', () => {
        expect(frameSrc('https://en.wikipedia.org/wiki/X', proxy)).toBe('https://en.wikipedia.org/wiki/X');
        expect(frameSrc('https://my.app/', proxy, ['my.app'])).toBe('https://my.app/');
    });

    it('uses the YouTube embed directly', () => {
        expect(frameSrc('https://youtu.be/dQw4w9WgXcQ', proxy)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });
});

describe('framed and reload', () => {
    it('records the address the frame navigated to without changing the iframe url', () => {
        let state = browserReducer(createBrowserState(), { type: 'navigate', entry: pageEntry('https://a.com/') });
        state = browserReducer(state, { type: 'framed', id: 1, url: 'https://a.com/next', title: 'Next' });
        const entry = currentEntry(activeTab(state));
        expect(entry).toMatchObject({ url: 'https://a.com/', location: 'https://a.com/next', title: 'Next' });
    });

    it('ignores framed reports for the Favorites page and unknown tabs', () => {
        const state = createBrowserState();
        expect(currentEntry(activeTab(browserReducer(state, { type: 'framed', id: 1, url: 'https://a.com/' }))).location).toBeUndefined();
        expect(browserReducer(state, { type: 'framed', id: 9, url: 'https://a.com/' })).toBe(state);
    });

    it('reloads the page the visitor navigated to', () => {
        let state = browserReducer(createBrowserState(), { type: 'navigate', entry: pageEntry('https://a.com/') });
        state = browserReducer(state, { type: 'framed', id: 1, url: 'https://a.com/next', title: 'Next' });
        state = browserReducer(state, { type: 'reload' });
        expect(currentEntry(activeTab(state))).toMatchObject({ url: 'https://a.com/next', location: undefined });
    });
});
