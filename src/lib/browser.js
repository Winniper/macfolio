// Safari window logic: address parsing and a reducer over tabs, each with its
// own history. Proxied pages report every address they show (shim.js), so links
// clicked inside the frame become history entries too; directly framed sites
// only report what the address bar asked for.

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

// Bing is the one big engine that answers the proxy without a bot check.
const SEARCH_URL = 'https://www.bing.com/search?q=';

// Address-bar text -> URL: a web address, else a Bing search for the
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

const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/;

// Search engines that answer the proxy with a captcha or a block. Google and
// DuckDuckGo searches are sent to Bing instead; other pages on these hosts
// get Safari's own blocked page.
export const isBlockedHost = (input) => {
    try {
        const host = new URL(input).hostname;

        return GOOGLE_HOST.test(host) || /(^|\.)(duckduckgo\.com|search\.brave\.com|startpage\.com)$/.test(host);
    } catch {
        return false;
    }
};

// A Google or DuckDuckGo search (or their home page) -> the same on Bing, else null.
export const rerouteSearch = (input) => {
    try {
        const url = new URL(input);
        const host = url.hostname.replace(/^www\./, '');
        const query = url.searchParams.get('q');
        const isGoogle = /^google\.[a-z.]+$/.test(host);
        const isDdg = ['duckduckgo.com', 'html.duckduckgo.com', 'lite.duckduckgo.com'].includes(host);
        const searchPath = isGoogle ? url.pathname === '/search' : isDdg && ['/', '/html/', '/lite/'].includes(url.pathname);

        if (searchPath && query) return `${SEARCH_URL}${encodeURIComponent(query)}`;
        if (isGoogle && ['/', '/webhp'].includes(url.pathname)) return 'https://www.bing.com/';

        return null;
    } catch {
        return null;
    }
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

// The portfolio itself can be framed (same origin, our own code) and the proxy
// refuses to fetch it anyway: its production domain (keep in sync with
// ALLOWED_PARENTS in proxy/wrangler.toml) plus wherever it is running now.
const PORTFOLIO_DOMAIN = 'devbarman.xyz';

export const portfolioHosts = (location) => [...new Set([PORTFOLIO_DOMAIN, hostnameOf(location)])];

export const FAVORITES_ENTRY = { url: null, title: 'Favorites' };

export const pageEntry = (url, title = hostnameOf(url)) => ({ url, title });

export const errorEntry = (input) => ({ url: null, error: input, title: 'Failed to open page' });

export const blockedEntry = (url) => ({ url: null, blocked: url, title: hostnameOf(url) });

// Every address Safari is asked to show goes through here: searches on engines
// that block the proxy move to Bing, their other pages get the blocked page.
export const resolveEntry = (url, title) => {
    const rerouted = rerouteSearch(url);

    if (rerouted) return pageEntry(rerouted);
    if (isBlockedHost(url)) return blockedEntry(url);

    return pageEntry(url, title);
};

export const favoritesFromProjects = (projects) =>
    projects
        .map((project) => ({ project, url: normalizeAddress(project.website) }))
        .filter(({ url }) => url)
        .map(({ project, url }) => ({ id: project.id, title: project.title, url }));

// `frame` is the only thing the tab's iframe is keyed and sourced from: a new
// key mounts a fresh frame on `url`; in-frame navigations leave it alone.
// `settled` turns true once the frame has reported its first page.
const loadFrame = (frame, url) => ({ key: frame.key + 1, url, settled: false });

const createTab = (id, entry = FAVORITES_ENTRY) => ({
    id,
    history: [entry],
    index: 0,
    frame: { key: 0, url: entry.url, settled: false },
    loading: Boolean(entry.url),
});

export const createBrowserState = () => ({
    tabs: [createTab(1)],
    activeTabId: 1,
    nextTabId: 2,
});

export const activeTab = (state) => state.tabs.find((tab) => tab.id === state.activeTabId);

export const currentEntry = (tab) => tab.history[tab.index];

const replaceAt = (tab, entry) => tab.history.map((item, index) => (index === tab.index ? entry : item));

const updateTab = (state, id, update) => ({
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...update(tab) } : tab)),
});

const moveIndex = (tab, step) => {
    const index = Math.min(Math.max(tab.index + step, 0), tab.history.length - 1);

    if (index === tab.index) return {};

    const { url } = tab.history[index];

    return { index, loading: Boolean(url), frame: loadFrame(tab.frame, url) };
};

const pushEntry = (tab, entry) => ({
    history: [...tab.history.slice(0, tab.index + 1), entry],
    index: tab.index + 1,
    loading: Boolean(entry.url),
    frame: loadFrame(tab.frame, entry.url),
});

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
            return updateTab(state, state.activeTabId, (tab) => pushEntry(tab, action.entry));

        case 'back':
            return updateTab(state, state.activeTabId, (tab) => moveIndex(tab, -1));

        case 'forward':
            return updateTab(state, state.activeTabId, (tab) => moveIndex(tab, 1));

        case 'reload':
            return updateTab(state, state.activeTabId, (tab) => {
                const { url } = currentEntry(tab);

                return { loading: Boolean(url), frame: url ? loadFrame(tab.frame, url) : tab.frame };
            });

        // The proxied page reported the real address and title it is showing.
        case 'framed': {
            const target = state.tabs.find((tab) => tab.id === action.id);

            if (!target || !currentEntry(target).url) return state;

            return updateTab(state, action.id, (tab) => {
                const current = currentEntry(tab);
                const title = action.title || current.title;
                const settled = { ...tab.frame, settled: true };

                if (action.url === current.url) return { history: replaceAt(tab, { ...current, title }), frame: settled };

                const entry = resolveEntry(action.url, title);

                // Blocked or YouTube watch addresses need a different frame than the
                // page is showing (named after the host: the embed never reports a title).
                if (!entry.url || entry.url !== action.url || youtubeEmbed(action.url)) return pushEntry(tab, resolveEntry(action.url));

                // The first report after a load is a server redirect: replace, so Back is never stuck.
                if (!tab.frame.settled) return { history: replaceAt(tab, entry), frame: settled };

                // A link clicked inside the frame: the page is already showing it.
                return { history: [...tab.history.slice(0, tab.index + 1), entry], index: tab.index + 1, frame: settled };
            });
        }

        case 'loaded':
            return state.tabs.some((tab) => tab.id === action.id)
                ? updateTab(state, action.id, () => ({ loading: false }))
                : state;

        default:
            return state;
    }
};
