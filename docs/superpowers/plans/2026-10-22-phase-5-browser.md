# Phase 5 — Browser (Safari) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Safari-style browser window on the desktop that shows the owner's deployed projects live: tabs, back/forward/reload, an editable address bar, and a Favorites start page built from the `projects` collection. Finder's "Website" items open in it.

**Architecture:** All browser behavior is a pure reducer over tabs and per-tab history (`src/lib/browser.js`), plus a pure address normalizer, both unit-tested. Project data moves out of `Finder.jsx` into one shared, deduplicated store (`createProjectsStore` in `src/lib/projectsStore.js`, wired to Firestore in `src/store/projects.js`, read through `useProjects()`), so Finder and the browser fetch once. The window component (`src/windows/Browser.jsx`, registry id `safari`) is thin: it renders the toolbar, tab strip, Favorites/error pages and one sandboxed iframe per tab.

**Tech Stack:** React 19, Zustand 5, lucide-react, Firebase Firestore (unchanged query), Tailwind 4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md` — section 4 "Browser", build-order phase 5.

**Decisions:**
- *Iframes are sandboxed* (`allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`, no `allow-top-navigation`): an embedded site's frame-busting script (`top.location = …`) would otherwise navigate the whole portfolio away. Links that open new windows still work.
- *Only `http:`/`https:` addresses load.* `javascript:`, `data:`, `ftp:` and anything that doesn't parse becomes the "can't open" page.
- *Closing the last tab leaves a fresh Favorites tab* instead of closing the window (the red light closes the window).
- *Favorites tiles use a letter avatar*, not fetched favicons — a favicon service would send every project domain to a third party.
- *Finder's GitHub items still open a new browser tab*: GitHub refuses to be framed, so it would show blank in the in-app browser. Only "Website" items open in Safari.
- *Inactive tabs keep their iframe mounted (hidden)* so switching tabs doesn't reload a site; going back to Favorites unmounts that tab's iframe.
- *No fallback for frame-blocking sites* — spec decision; they show blank.

## Global Constraints

- Registry id **`safari`**, title "Safari", `placement: ['desktop']` (new apps go on the desktop, never the dock).
- Address normalization: prepend `https://` when missing; non-URL input shows an inline "Safari can't open this page".
- Back/forward history covers only address-bar/Favorites navigations (cross-origin iframe URLs are unreadable — accepted).
- Loading bar until the iframe's `onLoad`. No fallback for frame-blocking sites.
- Finder project website items call `openWindow('safari', { url })` → opens a new tab.
- Window components: header has `data-titlebar`; root fills the section (`flex-1 min-h-0 w-full`); the `<section>` must not clip (`overflow-hidden`/rounding go on the inner root, never the section) and must not set position/size in CSS — `bounds` owns them.
- Data hooks use the AGENTS.md idiom (`try/catch/finally`, `Loader2`/`AlertTriangle`/`RefreshCw`).
- Vitest covers pure logic only; never import a window component or `src/lib/firebase.js` from a test. UI is verified in Chrome.
- `npx eslint . --ignore-pattern .superpowers` stays at 10 errors / 0 warnings. Export windows Terminal-style (`const XWindow = WindowWrapper(X, 'key'); export default XWindow;`) — an anonymous `export default WindowWrapper(...)` adds lint errors.
- Never edit or commit `._*` files. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `feature/browser`.

## Review Focus

1. Typing a `javascript:`/`data:` URL, a bare word, or text with spaces into the address bar must never load anything — it shows the "can't open" page (pinned in Task 2: `normalizeAddress` tests).
2. Back after visiting several pages, then navigating somewhere new, must drop the forward history like a real browser (pinned in Task 2: reducer tests).
3. Closing the active tab must activate a neighbor, and closing the last one must leave a usable Favorites tab, never zero tabs (pinned in Task 2).
4. Opening Finder and Safari must fetch projects once, and a failed fetch must be retryable from either (pinned in Task 1: store tests for dedupe and retry).
5. Clicking the same project's "Website" twice in Finder must open two tabs, and reopening Safari from its desktop icon must not re-open the last project (verified in Chrome in Task 3).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/projectsStore.js` + test (create) | Store factory: status, dedupe, retry (no Firebase import) |
| `src/lib/projectsApi.js` (create) | Firestore query for `projects` (moved from Finder) |
| `src/store/projects.js` (create) | The app's projects store |
| `src/hooks/useProjects.js` (create) | Loads once, exposes `{ projects, loading, error, retry }` |
| `src/windows/Finder.jsx` (modify) | Use `useProjects`; Website items open Safari (Task 3) |
| `src/lib/browser.js` + test (create) | `normalizeAddress`, `hostnameOf`, entries, `favoritesFromProjects`, `browserReducer` |
| `src/windows/Browser.jsx` (create) | The Safari window |
| `src/components/browser/FavoritesPage.jsx`, `CantOpenPage.jsx` (create) | Start page and error page |
| `src/constants/apps.js` + test, `src/windows/index.js`, `src/App.jsx`, `src/index.css`, `CLAUDE.md` (modify) | Registry, export, render, styles, docs |

---

### Task 1: Shared projects store

**Files:**
- Create: `src/lib/projectsStore.js`, `src/lib/projectsStore.test.js`, `src/lib/projectsApi.js`, `src/store/projects.js`, `src/hooks/useProjects.js`
- Modify: `src/windows/Finder.jsx`, `CLAUDE.md`

**Interfaces:**
- Produces:
  - `createProjectsStore(fetchProjects: () => Promise<Project[]>)` → a Zustand store hook with state `{ status: 'idle' | 'loading' | 'success' | 'error', projects: Project[], error: string | null }` and `load({ force = false } = {}) => Promise<void>` (no-op while loading, and when already loaded unless `force`)
  - `fetchProjects()` in `src/lib/projectsApi.js` (Firestore `projects` ordered by `order` asc → `[{ id, ...data }]`)
  - default export of `src/store/projects.js`: `useProjectsStore`
  - `useProjects() => { projects, loading: boolean, error: string | null, retry: () => Promise<void> }` (triggers `load()` on mount)

- [ ] **Step 1: Write the failing test** — `src/lib/projectsStore.test.js`

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createProjectsStore } from './projectsStore';

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createProjectsStore', () => {
    it('starts idle and empty', () => {
        const store = createProjectsStore(vi.fn());
        expect(store.getState()).toMatchObject({ status: 'idle', projects: [], error: null });
    });

    it('loads projects', async () => {
        const projects = [{ id: 'a', title: 'A' }];
        const store = createProjectsStore(vi.fn().mockResolvedValue(projects));
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', projects, error: null });
    });

    it('fetches once when several windows ask at the same time', async () => {
        const pending = deferred();
        const fetchProjects = vi.fn(() => pending.promise);
        const store = createProjectsStore(fetchProjects);
        const first = store.getState().load();
        store.getState().load();
        expect(store.getState().status).toBe('loading');
        pending.resolve([]);
        await first;
        expect(fetchProjects).toHaveBeenCalledTimes(1);
    });

    it('does not refetch once loaded unless forced', async () => {
        const fetchProjects = vi.fn().mockResolvedValue([]);
        const store = createProjectsStore(fetchProjects);
        await store.getState().load();
        await store.getState().load();
        expect(fetchProjects).toHaveBeenCalledTimes(1);
        await store.getState().load({ force: true });
        expect(fetchProjects).toHaveBeenCalledTimes(2);
    });

    it('reports a friendly error and can retry', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchProjects = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce([{ id: 'a' }]);
        const store = createProjectsStore(fetchProjects);
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'error', error: 'Unable to load projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', projects: [{ id: 'a' }], error: null });
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/projectsStore.test.js`
Expected: FAIL — `Cannot find module './projectsStore'`.

- [ ] **Step 3: Implement**

`src/lib/projectsStore.js`:

```js
import { create } from 'zustand';

// Shared project list for every window that shows projects (Finder, Safari).
// The fetcher is injected so this stays testable without Firebase.
export const createProjectsStore = (fetchProjects) =>
    create((set, get) => ({
        status: 'idle',
        projects: [],
        error: null,

        load: async ({ force = false } = {}) => {
            const { status } = get();

            if (status === 'loading') return;
            if (status === 'success' && !force) return;

            set({ status: 'loading', error: null });

            try {
                const projects = await fetchProjects();
                set({ status: 'success', projects });
            } catch (err) {
                console.error('Error fetching projects:', err);
                set({ status: 'error', error: 'Unable to load projects' });
            }
        },
    }));
```

`src/lib/projectsApi.js`:

```js
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { db } from './firebase';

// Written by components/admin/ProjectsManager.jsx; read here for Finder and Safari.
export const fetchProjects = async () => {
    const snapshot = await getDocs(query(collection(db, 'projects'), orderBy('order', 'asc')));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
```

`src/store/projects.js`:

```js
import { createProjectsStore } from '../lib/projectsStore';
import { fetchProjects } from '../lib/projectsApi';

const useProjectsStore = createProjectsStore(fetchProjects);

export default useProjectsStore;
```

`src/hooks/useProjects.js`:

```js
import { useEffect } from 'react';

import useProjectsStore from '../store/projects';

// Project list shared by every window; the first caller triggers the fetch.
const useProjects = () => {
    const status = useProjectsStore((state) => state.status);
    const projects = useProjectsStore((state) => state.projects);
    const error = useProjectsStore((state) => state.error);
    const load = useProjectsStore((state) => state.load);

    useEffect(() => {
        load();
    }, [load]);

    return {
        projects,
        loading: status === 'idle' || status === 'loading',
        error,
        retry: load,
    };
};

export default useProjects;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS — 13 files, 121 tests (116 + 5).

- [ ] **Step 5: Move Finder onto the shared store** — in `src/windows/Finder.jsx`:
- Remove the `collection, getDocs, query, orderBy` import, the `db` import, the `projects`/`loading`/`error` `useState`s, the `fetchProjects` `useCallback` and its `useEffect`.
- Add `import useProjects from '../hooks/useProjects';` after the `WindowControls` import, and inside `Finder`, after the remaining `useState`s: `const { projects, loading, error, retry } = useProjects();`
- In the error state's Retry button, replace the `fetchProjects()` call with `retry()`.
- Drop now-unused names from the `react` import (`useEffect`, `useCallback`) only if nothing else uses them.

Nothing else in Finder changes in this task.

- [ ] **Step 6: Document** — in `CLAUDE.md`'s data-flow table, change the `projects` row's "Read by" cell from `` `windows/Finder.jsx` `` to `` `lib/projectsApi.js` → `store/projects.js` (shared by Finder and Safari via `hooks/useProjects.js`) ``.

- [ ] **Step 7: Verify and commit**

Run: `npm test` — Expected: 121 passing.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: ≤ 10 errors, 0 warnings (Finder's unused-import errors may drop).
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

```bash
git add src/lib/projectsStore.js src/lib/projectsStore.test.js src/lib/projectsApi.js src/store/projects.js src/hooks/useProjects.js src/windows/Finder.jsx CLAUDE.md
git commit -m "refactor: share the projects fetch through one store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Browser logic

**Files:**
- Create: `src/lib/browser.js`, `src/lib/browser.test.js`

**Interfaces:**
- Produces:
  - `normalizeAddress(input: string) => string | null` — an absolute `http(s)` href, or `null`
  - `hostnameOf(url: string) => string` — hostname without a leading `www.`
  - `pageEntry(url, title = hostnameOf(url)) => { url, title }`, `FAVORITES_ENTRY = { url: null, title: 'Favorites' }`, `errorEntry(input) => { url: null, error: input, title: 'Failed to open page' }`
  - `favoritesFromProjects(projects) => Array<{ id, title, url }>` — projects whose `website` normalizes
  - `createBrowserState() => { tabs: Tab[], activeTabId: number, nextTabId: number }` where `Tab = { id, history: Entry[], index, reloadKey, loading }`
  - `activeTab(state) => Tab`, `currentEntry(tab) => Entry`
  - `browserReducer(state, action)` with actions `{ type: 'newTab', entry? }`, `{ type: 'closeTab', id }`, `{ type: 'selectTab', id }`, `{ type: 'navigate', entry }`, `{ type: 'back' }`, `{ type: 'forward' }`, `{ type: 'reload' }`, `{ type: 'loaded', id }`

- [ ] **Step 1: Write the failing test** — `src/lib/browser.test.js`

```js
import { describe, it, expect } from 'vitest';
import {
    FAVORITES_ENTRY,
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/browser.test.js`
Expected: FAIL — `Cannot find module './browser'`.

- [ ] **Step 3: Implement** — `src/lib/browser.js`

```js
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test`
Expected: PASS — 14 files, 140 tests (121 + 19).

- [ ] **Step 5: Commit**

```bash
git add src/lib/browser.js src/lib/browser.test.js
git commit -m "feat: browser address parsing and tab/history reducer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Safari window

**Files:**
- Create: `src/windows/Browser.jsx`, `src/components/browser/FavoritesPage.jsx`, `src/components/browser/CantOpenPage.jsx`
- Modify: `src/constants/apps.js`, `src/constants/apps.test.js`, `src/windows/index.js`, `src/App.jsx`, `src/windows/Finder.jsx`, `src/index.css`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything Task 2 produces; `useProjects()` (Task 1); `useWindowStore` (`windows.safari.data`, `openWindow`); `WindowWrapper`, `WindowControls`.
- Produces: registry entry `safari`; `openWindow('safari', { url, title? })` opens `url` in a new tab.

- [ ] **Step 1: Update the registry tests** — in `src/constants/apps.test.js`:

Replace the expectation in `'derives desktop items using label and desktopIcon overrides'` with:

```js
        expect(desktopItems).toEqual([
            { id: 'finder', title: 'Projects', icon: '/images/folder.png', position: { top: 60, left: 20 } },
            { id: 'resume', title: 'Resume.pdf', icon: '/images/pdf.png', position: { top: 160, left: 20 } },
            { id: 'safari', title: 'Safari', icon: '/images/safari.png', position: { top: 260, left: 20 } },
        ]);
```

and in `'builds a closed window entry for every windowed app only'` change the key list to `['contact', 'finder', 'resume', 'safari', 'terminal']`.

Run: `npm test -- src/constants/apps.test.js` — Expected: FAIL on those two tests.

- [ ] **Step 2: Registry entry** — in `src/constants/apps.js`, add after the `resume` entry:

```js
    {
        id: 'safari',
        title: 'Safari',
        icon: '/images/safari.png',
        placement: ['desktop'],
        desktopPosition: { top: 260, left: 20 },
        defaultBounds: { x: 200, y: 70, w: 1000, h: 680 },
        minSize: { w: 480, h: 360 },
    },
```

Run: `npm test` — Expected: PASS, 140 tests.

- [ ] **Step 3: Pages** — `src/components/browser/FavoritesPage.jsx`:

```jsx
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { favoritesFromProjects, hostnameOf } from '../../lib/browser';
import useProjects from '../../hooks/useProjects';

// Start page: one tile per project that has a deployed website.
const FavoritesPage = ({ onOpen }) => {
    const { projects, loading, error, retry } = useProjects();
    const favorites = favoritesFromProjects(projects);

    return (
        <div className="browser-page">
            <h2 className="browser-page-title">Favorites</h2>

            {loading && (
                <div className="browser-page-status">
                    <Loader2 size={28} className="animate-spin text-blue-400" />
                    <span>Loading projects…</span>
                </div>
            )}

            {!loading && error && (
                <div className="browser-page-status">
                    <span className="flex items-center gap-2 text-red-400">
                        <AlertTriangle size={20} />
                        {error}
                    </span>
                    <button type="button" className="browser-retry" onClick={retry}>
                        <RefreshCw size={14} />
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && favorites.length === 0 && (
                <p className="browser-page-status">No live projects yet.</p>
            )}

            {!loading && !error && favorites.length > 0 && (
                <div className="browser-favorites">
                    {favorites.map((favorite) => (
                        <button
                            key={favorite.id}
                            type="button"
                            className="browser-favorite"
                            onClick={() => onOpen(favorite)}
                        >
                            <span className="browser-favorite-icon">
                                {favorite.title.charAt(0).toUpperCase()}
                            </span>
                            <span className="browser-favorite-title">{favorite.title}</span>
                            <span className="browser-favorite-host">{hostnameOf(favorite.url)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FavoritesPage;
```

`src/components/browser/CantOpenPage.jsx`:

```jsx
// Shown when address-bar text isn't a loadable web address.
const CantOpenPage = ({ input }) => (
    <div className="browser-page browser-cant-open">
        <h2 className="browser-page-title">Safari Can’t Open the Page</h2>
        <p>
            Safari can’t open “{input}” because it isn’t a valid web address.
        </p>
    </div>
);

export default CantOpenPage;
```

- [ ] **Step 4: The window** — `src/windows/Browser.jsx`:

```jsx
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

        const url = normalizeAddress(draft ?? '');

        open(url ? pageEntry(url) : errorEntry(draft ?? ''));
        event.currentTarget.querySelector('input')?.blur();
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

                {!entry.url && !entry.error && (
                    <FavoritesPage onOpen={(favorite) => open(pageEntry(favorite.url, favorite.title))} />
                )}
                {!entry.url && entry.error !== undefined && <CantOpenPage input={entry.error} />}
            </div>
        </div>
    );
};

const BrowserWindow = WindowWrapper(Browser, 'safari');
export default BrowserWindow;
```

- [ ] **Step 5: Export and render** — `src/windows/index.js`:

```js
import Terminal from "./Terminal";
import Resume from "./Resume";
import Finder from "./Finder";
import Contact from "./Contact";
import Browser from "./Browser";

export { Terminal, Resume, Finder, Contact, Browser }
```

In `src/App.jsx`, import `Browser` alongside the other windows from `"@windows"` and render `<Browser />` right after `<Contact />`.

- [ ] **Step 6: Finder's Website items open Safari** — in `src/windows/Finder.jsx`:
- Add `import useWindowStore from '../store/window';` after the `useProjects` import, and inside `Finder`: `const openWindow = useWindowStore((state) => state.openWindow);`
- In `handleItemDoubleClick`, replace the `else if (item.type === 'link' && item.url)` branch with:

```js
        } else if (item.type === 'link' && item.url) {
            if (item.id === 'website') {
                openWindow('safari', { url: item.url, title: currentPath[currentPath.length - 1] });
            } else {
                // GitHub refuses to be framed, so it opens in a real browser tab.
                window.open(item.url, '_blank', 'noopener,noreferrer');
            }
```

- [ ] **Step 7: Styles** — in `src/index.css`, replace the whole `#safari { … }` block (inside `@layer components`, including its unused `.search` and `.blog` rules) with:

```css
  #safari {
    @apply shadow-2xl drop-shadow-2xl rounded-xl;
  }
```

Append at the end of the file (outside every layer):

```css
/* Safari window. Rounding/clipping live on .browser, never on the section. */
.browser {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border-radius: 0.75rem;
  background: #1e1e1e;
  color: #e5e5e5;
}
.browser-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #2d2d2d;
  border-bottom: 1px solid #1a1a1a;
  user-select: none;
}
.browser-nav {
  display: flex;
  gap: 2px;
}
.browser-nav button,
.browser-new-tab {
  display: grid;
  place-items: center;
  width: 28px;
  height: 26px;
  border-radius: 6px;
  color: #c7c7c7;
}
.browser-nav button:hover:not(:disabled),
.browser-new-tab:hover {
  background: rgb(255 255 255 / 0.08);
}
.browser-nav button:disabled {
  color: #5c5c5c;
}
.browser-address {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 560px;
  margin: 0 auto;
  padding: 5px 10px;
  border-radius: 8px;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
}
.browser-address input {
  flex: 1;
  min-width: 0;
  background: transparent;
  color: #f0f0f0;
  font-size: 13px;
  text-align: center;
  outline: none;
}
.browser-address input:focus {
  text-align: left;
}
.browser-address button {
  color: #9a9a9a;
}
.browser-tabs {
  display: flex;
  gap: 1px;
  background: #242424;
  border-bottom: 1px solid #1a1a1a;
}
.browser-tab {
  flex: 1;
  min-width: 0;
  max-width: 240px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #9a9a9a;
  cursor: default;
}
.browser-tab.is-active {
  background: #1e1e1e;
  color: #f0f0f0;
}
.browser-tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.browser-tab button {
  opacity: 0;
  border-radius: 4px;
}
.browser-tab:hover button,
.browser-tab.is-active button {
  opacity: 1;
}
.browser-content {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #1e1e1e;
}
.browser-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: white;
}
.browser-progress {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  height: 2px;
  width: 40%;
  background: #3b82f6;
  animation: browser-progress 1.2s ease-in-out infinite;
}
@keyframes browser-progress {
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
}
.browser-page {
  height: 100%;
  overflow: auto;
  padding: 40px 48px;
}
.browser-page-title {
  margin-bottom: 20px;
  font-size: 20px;
  font-weight: 700;
}
.browser-page-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: #9a9a9a;
  font-size: 14px;
}
.browser-retry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  background: #333;
  color: #d4d4d4;
}
.browser-favorites {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 20px;
}
.browser-favorite {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: 12px;
  text-align: center;
}
.browser-favorite:hover {
  background: rgb(255 255 255 / 0.06);
}
.browser-favorite-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  font-size: 26px;
  font-weight: 700;
}
.browser-favorite-title {
  font-size: 13px;
  color: #e5e5e5;
}
.browser-favorite-host {
  font-size: 11px;
  color: #8a8a8a;
}
.browser-cant-open {
  text-align: center;
  padding-top: 15%;
  color: #9a9a9a;
  font-size: 14px;
}
```

- [ ] **Step 8: Document** — in `CLAUDE.md`, after the boot-sequence bullet, add:

```markdown
- **Safari (`windows/Browser.jsx`, id `safari`):** tabs and per-tab history live in the pure `browserReducer` (`src/lib/browser.js`); `normalizeAddress` only ever yields `http(s)` URLs. Each tab's page is a sandboxed iframe without `allow-top-navigation`, so a frame-busting site can't navigate the portfolio away. `openWindow('safari', { url, title })` opens a new tab (Finder's Website items use it). Sites that refuse framing show blank — accepted.
```

- [ ] **Step 9: Verify**

Run: `npm test` — Expected: PASS, 140 tests.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: ≤ 10 errors, 0 warnings.
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

In Chrome (`npm run dev`; skip the boot with a key and unlock):
- A Safari icon sits on the desktop under Resume.pdf; it opens the window on Favorites with one tile per project that has a website (or the loading/error/empty state).
- Clicking a tile loads the site in the tab, with the progress bar until it loads; back returns to Favorites; forward returns to the site.
- Typing `example.com` + Enter loads `https://example.com/`; typing `hello world` shows "Safari Can’t Open the Page"; `javascript:alert(1)` shows the same page and runs nothing.
- `+` opens a Favorites tab; tabs switch without reloading their sites; closing the active tab activates its neighbor; closing the last leaves Favorites.
- In Finder → Projects → a project → "Website.pages" opens Safari with that site in a new tab; doing it again opens another tab; "Github.pages" opens a real browser tab.
- Close Safari and reopen from the desktop icon: tabs are as they were, and no extra tab opens.
- Drag and resize the window across the iframe (it doesn't stick), maximize it, and minimize it to the dock.

- [ ] **Step 10: Commit**

```bash
git add src/windows/Browser.jsx src/components/browser/FavoritesPage.jsx src/components/browser/CantOpenPage.jsx src/constants/apps.js src/constants/apps.test.js src/windows/index.js src/App.jsx src/windows/Finder.jsx src/index.css CLAUDE.md
git commit -m "feat: Safari window with tabs, history and live project favorites

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
