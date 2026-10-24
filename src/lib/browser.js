// Safari window logic: address parsing and a reducer over tabs, each with its
// own history. Only navigations made through the address bar or Favorites are
// tracked — links clicked inside a cross-origin iframe can't be observed.

const WEB_PROTOCOLS = ['http:', 'https:'];

// Turns address-bar text into an absolute http(s) URL, or null when it isn't
// one (spaces, bare words, javascript:, data:, ftp:, …).
export const normalizeAddress = (input) => {
    // Firestore data is untyped: anything but a string is simply not an address
    // (String(42) would even parse as the IP 0.0.0.42).
    if (typeof input !== 'string') return null;

    const value = input.trim();

    if (!value || /\s/.test(value)) return null;

    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;

    try {
        const url = new URL(candidate);

        if (!WEB_PROTOCOLS.includes(url.protocol)) return null;
        if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;

        return url.href;
    } catch {
        return null;
    }
};

const SEARCH_URL = 'https://html.duckduckgo.com/html/?q=';

// Address-bar text -> URL: a web address, else a DuckDuckGo search for the
// words. Only things that can't be either (javascript:, data:, …) return null.
export const addressOrSearch = (input) => {
    if (typeof input !== 'string') return null;

    const url = normalizeAddress(input);

    if (url) return url;

    const value = input.trim();

    // Anything with a scheme is a (rejected) address, not search words.
    if (!value || /^[a-z][a-z\d+.-]*:/i.test(value) && !/\s/.test(value)) return null;

    return `${SEARCH_URL}${encodeURIComponent(value)}`;
};

// Watch pages can't be framed, but the same video has an official embed player.
export const youtubeEmbed = (input) => {
    try {
        const url = new URL(input);
        const host = url.hostname.replace(/^(www|m)\./, '');
        let id = null;

        if (host === 'youtu.be') id = url.pathname.slice(1);
        else if (host === 'youtube.com') {
            if (url.pathname === '/watch') id = url.searchParams.get('v');
            else id = /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(url.pathname)?.[1] ?? null;
        }

        return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    } catch {
        return null;
    }
};

// Sites that already allow framing load directly: no proxy bandwidth needed.
const DIRECT_HOSTS = ['youtube-nocookie.com', 'wikipedia.org', 'wikimedia.org'];

// What the tab's iframe loads. Without a proxy configured every site is
// framed directly (blank for the ones that refuse).
export const frameSrc = (url, proxyBase, directHosts = []) => {
    if (!proxyBase) return url;

    const embed = youtubeEmbed(url);
    const target = embed ?? url;
    const host = new URL(target).hostname.replace(/^www\./, '');

    if ([...DIRECT_HOSTS, ...directHosts].some((direct) => host === direct || host.endsWith(`.${direct}`))) return target;

    return `${proxyBase.replace(/\/+$/, '')}/${target}`;
};

export const hostnameOf = (url) => new URL(url).hostname.replace(/^www\./, '');

export const FAVORITES_ENTRY = { url: null, title: 'Favorites' };

export const pageEntry = (url, title = hostnameOf(url)) => ({ url, title });

export const errorEntry = (input) => ({ url: null, error: input, title: 'Failed to open page' });

export const favoritesFromProjects = (projects) =>
    projects
        .map((project) => ({ project, url: normalizeAddress(project.website) }))
        .filter(({ url }) => url)
        .map(({ project, url }) => ({ id: project.id, title: project.title, url }));

const createTab = (id, entry = FAVORITES_ENTRY) => ({
    id,
    history: [entry],
    index: 0,
    reloadKey: 0,
    loading: Boolean(entry.url),
});

export const createBrowserState = () => ({
    tabs: [createTab(1)],
    activeTabId: 1,
    nextTabId: 2,
});

export const activeTab = (state) => state.tabs.find((tab) => tab.id === state.activeTabId);

export const currentEntry = (tab) => tab.history[tab.index];

const updateTab = (state, id, update) => ({
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...update(tab) } : tab)),
});

const moveIndex = (tab, step) => {
    const index = Math.min(Math.max(tab.index + step, 0), tab.history.length - 1);
    return { index, loading: index !== tab.index ? Boolean(tab.history[index].url) : tab.loading };
};

export const browserReducer = (state, action) => {
    switch (action.type) {
        case 'newTab': {
            const tab = createTab(state.nextTabId, action.entry);
            return { tabs: [...state.tabs, tab], activeTabId: tab.id, nextTabId: state.nextTabId + 1 };
        }

        case 'closeTab': {
            const position = state.tabs.findIndex((tab) => tab.id === action.id);

            if (position === -1) return state;

            const tabs = state.tabs.filter((tab) => tab.id !== action.id);

            if (tabs.length === 0) {
                const fresh = createTab(state.nextTabId);
                return { tabs: [fresh], activeTabId: fresh.id, nextTabId: state.nextTabId + 1 };
            }

            const activeTabId = action.id === state.activeTabId
                ? (tabs[position] ?? tabs[position - 1]).id
                : state.activeTabId;

            return { ...state, tabs, activeTabId };
        }

        case 'selectTab':
            return state.tabs.some((tab) => tab.id === action.id) ? { ...state, activeTabId: action.id } : state;

        case 'navigate':
            return updateTab(state, state.activeTabId, (tab) => ({
                history: [...tab.history.slice(0, tab.index + 1), action.entry],
                index: tab.index + 1,
                loading: Boolean(action.entry.url),
            }));

        case 'back':
            return updateTab(state, state.activeTabId, (tab) => moveIndex(tab, -1));

        case 'forward':
            return updateTab(state, state.activeTabId, (tab) => moveIndex(tab, 1));

        case 'reload':
            // Reloading a page the visitor navigated to inside the frame reloads that page.
            return updateTab(state, state.activeTabId, (tab) => ({
                reloadKey: tab.reloadKey + 1,
                loading: Boolean(currentEntry(tab).url),
                history: tab.history.map((entry, index) => (index === tab.index && entry.location
                    ? { ...entry, url: entry.location, location: undefined }
                    : entry)),
            }));

        // The proxied page reported the real address it is showing (after a link
        // click inside the frame). Shown in the address bar; the iframe is left alone.
        case 'framed':
            return state.tabs.some((tab) => tab.id === action.id)
                ? updateTab(state, action.id, (tab) => ({
                    history: tab.history.map((entry, index) => (index === tab.index && entry.url
                        ? { ...entry, location: action.url, title: action.title || entry.title }
                        : entry)),
                }))
                : state;

        case 'loaded':
            return state.tabs.some((tab) => tab.id === action.id)
                ? updateTab(state, action.id, () => ({ loading: false }))
                : state;

        default:
            return state;
    }
};
