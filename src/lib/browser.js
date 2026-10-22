// Safari window logic: address parsing and a reducer over tabs, each with its
// own history. Only navigations made through the address bar or Favorites are
// tracked — links clicked inside a cross-origin iframe can't be observed.

const WEB_PROTOCOLS = ['http:', 'https:'];

// Turns address-bar text into an absolute http(s) URL, or null when it isn't
// one (spaces, bare words, javascript:, data:, ftp:, …).
export const normalizeAddress = (input) => {
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

export const hostnameOf = (url) => new URL(url).hostname.replace(/^www\./, '');

export const FAVORITES_ENTRY = { url: null, title: 'Favorites' };

export const pageEntry = (url, title = hostnameOf(url)) => ({ url, title });

export const errorEntry = (input) => ({ url: null, error: input, title: 'Failed to open page' });

export const favoritesFromProjects = (projects) =>
    projects
        .map((project) => ({ project, url: normalizeAddress(project.website ?? '') }))
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
            return updateTab(state, state.activeTabId, (tab) => ({
                reloadKey: tab.reloadKey + 1,
                loading: Boolean(currentEntry(tab).url),
            }));

        case 'loaded':
            return state.tabs.some((tab) => tab.id === action.id)
                ? updateTab(state, action.id, () => ({ loading: false }))
                : state;

        default:
            return state;
    }
};
