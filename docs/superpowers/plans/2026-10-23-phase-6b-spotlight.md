# Phase 6b — Spotlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add macOS-style Spotlight. It opens with Cmd+K (macOS) / Ctrl+K (elsewhere), from the menu-bar magnifier, or from Help → Spotlight. It searches apps, projects and skills, groups the results by type, and is driven with ↑/↓, Enter and Esc. Picking a result opens the app, opens the project's site in a Safari tab (or its GitHub page in a real tab), or opens the Skills terminal.

**Architecture:** The search is pure and lives in `src/lib/spotlight.js`, which is unit-tested:
- `buildSpotlightIndex` turns the registry, the project list and the skill list into flat entries. Each entry carries a plain action object.
- `searchSpotlight` ranks the entries and groups them.

Actions reuse `runMenuAction` (Phase 6a), which gains `openUrl` and `spotlight`. The Firestore fetch-once store that projects use becomes a generic `createFetchStore`, so skills get the same shared store and hook (`useSkills`). Terminal and Spotlight then read one fetch. Open/closed state is `spotlightOpen` in the system store. One `Spotlight` component owns the global shortcut and renders the panel only while open, so every open starts with an empty query.

**Tech Stack:** React 19, Zustand 5, Tailwind 4, lucide-react, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md`. The relevant parts are:
- Section 5, Spotlight.
- Section 1, "Shared data hooks" (`useSkills`).
- Section 6, "Spotlight still returns apps on fetch failure".
- Build-order phase 6. This plan is 6b; 6a (menus) is merged, and 6c is notifications and sounds.

**Decisions:**
- *Index now: apps, projects, skills.* Notes and tracks join the index when their apps exist (Phases 8 and 7). `SPOTLIGHT_GROUPS` and `buildSpotlightIndex` are the extension points.
- *Shortcut:* Cmd+K on macOS and Ctrl+K elsewhere, plus Meta+Space off-Mac, as the spec says.
  - Ctrl+K on a Mac is left alone, because it is "delete to end of line" in text fields.
  - Cmd+Space can't be bound on a Mac, because macOS takes it before the page.
- *Project result action:*
  - A project with a `website` opens it in a Safari tab, the same as Finder's Website item.
  - A project with only `github` opens GitHub in a real browser tab, because GitHub refuses framing.
  - A project with neither opens Finder.
  - The subtitle tells the visitor which of these will happen.
- *Skill results are the individual technologies.* For example "React" carries the subtitle "Frontend" (its category), and its action opens the Skills terminal.
- *Archive (trash) is not indexed*, because it does nothing. Mission Control is indexed and toggles Mission Control.
- *Opening Spotlight closes Mission Control, and opening Mission Control closes Spotlight.* The two overlays never stack, and Esc means one thing at a time.
- *Ranking* (case-insensitive, whitespace collapsed), with ties keeping index order (registry order, then project `order`). Highest first:
  1. Exact title.
  2. Title prefix.
  3. A word in the title starts with the query.
  4. A keyword starts with the query.
  5. The title contains the query.
  6. A keyword contains the query.
- Groups always appear in the order Applications, Projects, Skills, with at most 5 results each.
- *Sounds* (the "Spotlight tick") arrive in 6c.

## Global Constraints

- Spotlight: **Cmd/Ctrl+K** primary (macOS swallows Cmd+Space before the page sees it; Cmd+Space still bound for non-Mac) + menu-bar magnifier. Results are grouped by type, and ↑/↓, Enter and Esc work.
- Data hooks use the AGENTS.md idiom. Spotlight degrades gracefully: it still returns apps when a fetch fails.
- `useSkills()` is extracted from `Terminal.jsx` and fetches once, shared by every caller.
- Desktop shortcuts and global listeners check `isDesktopPhase(useSystemStore.getState())`.
- Vitest covers pure logic and stores only. Never import a window or component, or `src/lib/firebase.js`, from a test. UI is verified in Chrome by the controller.
- `npx eslint . --ignore-pattern .superpowers` stays at 10 errors and 0 warnings.
- Never edit or commit `._*` files or the untracked `plan.md`, `page-render-check.png` and `website-screenshot.png`. Stage files by path.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The branch is `feature/spotlight`.

## Review Focus

1. **Odd queries.** Typing regex metacharacters (`(`, `.*`, `+`), leading or trailing spaces, repeated spaces or mixed case must neither throw nor miss obvious matches. Pinned in Task 2: `searchSpotlight` tests.
2. **Untyped Firestore data.** A project with a missing or blank title must be skipped rather than crash the index. A website that isn't a string must count as no website, and a `javascript:` "github" URL must never be opened. Skill `items` may be an array or a comma-separated string, and non-string items are skipped. Pinned in Task 2: `buildSpotlightIndex` and `runMenuAction` tests.
3. **Keyboard selection.** It must stay valid as results change: it resets to the first result on each keystroke, wraps at both ends, and Enter with no results does nothing. Pinned in Task 2 (`moveSelection`); the reset and Enter behavior are verified in Chrome (Task 3).
4. **When the shortcut fires.** It must work while a text field such as Safari's address bar is focused. It must not open during the boot or lock screens, and must not combine with Shift or Alt. Pinned in Task 2 (`isSpotlightKey`, `openSpotlight` phase guard); verified in Chrome (Task 3).
5. **Other overlays.** Spotlight must never stack with Mission Control, and lock/restart must close it. Pinned in Task 2: system store tests.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/fetchStore.js` + test (create) | `createFetchStore(fetchItems, { what })`: a fetch-once shared list store |
| `src/lib/projectsStore.js` + test (delete) | Replaced by `fetchStore` |
| `src/store/projects.js`, `src/hooks/useProjects.js` (modify) | Use `createFetchStore` |
| `src/lib/skillsApi.js`, `src/store/skills.js`, `src/hooks/useSkills.js` (create) | Skills fetch, store, hook |
| `src/windows/Terminal.jsx` (modify) | Uses `useSkills` |
| `src/constants/apps.js` + test (modify) | `keywords` per app |
| `src/lib/spotlight.js` + test (create) | `SPOTLIGHT_GROUPS`, `buildSpotlightIndex`, `searchSpotlight`, `flattenResults`, `moveSelection` |
| `src/lib/shortcuts.js` + test (modify) | `isSpotlightKey` |
| `src/store/system.js` + test (modify) | `spotlightOpen`, `openSpotlight`, `closeSpotlight`, `toggleSpotlight` |
| `src/lib/menuActions.js` + test, `src/lib/menus.js` + test (modify) | `openUrl` and `spotlight` actions; Help → Spotlight |
| `src/components/system/Spotlight.jsx` (create) | Shortcut and panel |
| `src/components/Navbar.jsx`, `src/constants/index.js` (modify) | Magnifier button |
| `src/App.jsx`, `src/index.css`, `src/components/system/DesktopContextMenu.jsx`, `CLAUDE.md`, spec (modify) | Mount, styles, native-menu area, docs |

---

### Task 1: Shared fetch store and `useSkills`

**Files:**
- Create: `src/lib/fetchStore.js`, `src/lib/fetchStore.test.js`, `src/lib/skillsApi.js`, `src/store/skills.js`, `src/hooks/useSkills.js`
- Delete: `src/lib/projectsStore.js`, `src/lib/projectsStore.test.js`
- Modify: `src/store/projects.js`, `src/hooks/useProjects.js`, `src/windows/Terminal.jsx`, `CLAUDE.md` (Data flow table)

**Interfaces:**
- Consumes: `fetchProjects` (`src/lib/projectsApi.js`), `db` (`src/lib/firebase.js`).
- Produces:
  - `createFetchStore(fetchItems, { what }) =>` a zustand store with `{ status: 'idle' | 'loading' | 'success' | 'error', items: any[], error: string | null, load({ force }?) }`. On failure the error is `` `Unable to load ${what}` ``.
  - `useProjects() => { projects, loading, error, retry }`. This is unchanged for callers.
  - `useSkills() => { skills, loading, error, retry }`. `skills` is the Firestore docs `{ id, category, items }`.

- [ ] **Step 1: Write the failing test.** Create `src/lib/fetchStore.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFetchStore } from './fetchStore';

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createFetchStore', () => {
    it('starts idle and empty', () => {
        const store = createFetchStore(vi.fn(), { what: 'projects' });
        expect(store.getState()).toMatchObject({ status: 'idle', items: [], error: null });
    });

    it('loads items', async () => {
        const items = [{ id: 'a', title: 'A' }];
        const store = createFetchStore(vi.fn().mockResolvedValue(items), { what: 'projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', items, error: null });
    });

    it('fetches once when several windows ask at the same time', async () => {
        const pending = deferred();
        const fetchItems = vi.fn(() => pending.promise);
        const store = createFetchStore(fetchItems, { what: 'projects' });
        const first = store.getState().load();
        store.getState().load();
        expect(store.getState().status).toBe('loading');
        pending.resolve([]);
        await first;
        expect(fetchItems).toHaveBeenCalledTimes(1);
    });

    it('does not refetch once loaded unless forced', async () => {
        const fetchItems = vi.fn().mockResolvedValue([]);
        const store = createFetchStore(fetchItems, { what: 'projects' });
        await store.getState().load();
        await store.getState().load();
        expect(fetchItems).toHaveBeenCalledTimes(1);
        await store.getState().load({ force: true });
        expect(fetchItems).toHaveBeenCalledTimes(2);
    });

    it('reports a friendly error and can retry', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchItems = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce([{ id: 'a' }]);
        const store = createFetchStore(fetchItems, { what: 'projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'error', error: 'Unable to load projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', items: [{ id: 'a' }], error: null });
    });

    it('names what failed to load', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const store = createFetchStore(vi.fn().mockRejectedValue(new Error('denied')), { what: 'skills' });
        await store.getState().load();
        expect(store.getState().error).toBe('Unable to load skills');
        expect(consoleError).toHaveBeenCalledWith('Error fetching skills:', expect.any(Error));
    });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run `npm test -- src/lib/fetchStore.test.js`. Expected: FAIL, because `./fetchStore` doesn't exist.

- [ ] **Step 3: Write the implementation.** Create `src/lib/fetchStore.js`:

```js
import { create } from 'zustand';

// A Firestore list shared by every window that shows it (projects: Finder,
// Safari, About, Spotlight; skills: Terminal, Spotlight). The first caller
// fetches; later callers reuse it. The fetcher is injected so this stays
// testable without Firebase.
export const createFetchStore = (fetchItems, { what }) =>
    create((set, get) => ({
        status: 'idle',
        items: [],
        error: null,

        load: async ({ force = false } = {}) => {
            const { status } = get();

            if (status === 'loading') return;
            if (status === 'success' && !force) return;

            set({ status: 'loading', error: null });

            try {
                const items = await fetchItems();
                set({ status: 'success', items });
            } catch (err) {
                console.error(`Error fetching ${what}:`, err);
                set({ status: 'error', error: `Unable to load ${what}` });
            }
        },
    }));
```

Then delete `src/lib/projectsStore.js` and `src/lib/projectsStore.test.js` with `git rm`. Their tests now live in `fetchStore.test.js`.

- [ ] **Step 4: Point projects at the generic store.**

`src/store/projects.js`:

```js
import { createFetchStore } from '../lib/fetchStore';
import { fetchProjects } from '../lib/projectsApi';

const useProjectsStore = createFetchStore(fetchProjects, { what: 'projects' });

export default useProjectsStore;
```

`src/hooks/useProjects.js`: change the `projects` selector line to read `items` (callers keep receiving `projects`):

```js
    const projects = useProjectsStore((state) => state.items);
```

- [ ] **Step 5: Add skills.**

`src/lib/skillsApi.js`:

```js
import { collection, getDocs } from 'firebase/firestore';

import { db } from './firebase';

// Written by components/admin/SkillsManager.jsx; read here for Terminal and Spotlight.
export const fetchSkills = async () => {
    const snapshot = await getDocs(collection(db, 'skills'));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
```

`src/store/skills.js`:

```js
import { createFetchStore } from '../lib/fetchStore';
import { fetchSkills } from '../lib/skillsApi';

const useSkillsStore = createFetchStore(fetchSkills, { what: 'skills' });

export default useSkillsStore;
```

`src/hooks/useSkills.js`:

```js
import { useEffect } from 'react';

import useSkillsStore from '../store/skills';

// Skill list shared by Terminal and Spotlight; the first caller triggers the fetch.
const useSkills = () => {
    const status = useSkillsStore((state) => state.status);
    const skills = useSkillsStore((state) => state.items);
    const error = useSkillsStore((state) => state.error);
    const load = useSkillsStore((state) => state.load);

    useEffect(() => {
        load();
    }, [load]);

    return {
        skills,
        loading: status === 'idle' || status === 'loading',
        error,
        retry: load,
    };
};

export default useSkills;
```

- [ ] **Step 6: Switch Terminal to the hook.** In `src/windows/Terminal.jsx`:
- Replace the first five import lines with:

```js
import React from 'react';
import { Check, MessageSquare, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import useSkills from '../hooks/useSkills';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';
```

- Replace everything from `const [skills, setSkills] = useState([]);` through the closing `}, [fetchSkills]);` of the `useEffect` with:

```js
    const { skills, loading, error, retry } = useSkills();
```

- Change the Retry button's `onClick={fetchSkills}` to `onClick={retry}`.

The markup is otherwise unchanged.

- [ ] **Step 7: Update the docs.** In the `CLAUDE.md` Data flow table:
- Replace the `projects` row's "Read by" cell with: `` `lib/projectsApi.js` → `store/projects.js` (shared by Finder, Safari, About This Mac and Spotlight via `hooks/useProjects.js`) ``.
- Replace the `skills` row's "Read by" cell with: `` `lib/skillsApi.js` → `store/skills.js` (shared by Terminal and Spotlight via `hooks/useSkills.js`) ``.
- Add after the table: `Both stores come from `createFetchStore` (`src/lib/fetchStore.js`): the first caller fetches, a failed load retries on the next call.`

- [ ] **Step 8: Run the checks.**
- `npm test`: expect 174 passing. That's 173, minus the 5 deleted projectsStore tests, plus the 6 fetchStore tests.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.
- `grep -rn "projectsStore" src`: no matches outside `._*` files.

- [ ] **Step 9: Commit.**

```bash
git rm src/lib/projectsStore.js src/lib/projectsStore.test.js
git add src/lib/fetchStore.js src/lib/fetchStore.test.js src/lib/skillsApi.js src/store/skills.js src/hooks/useSkills.js src/store/projects.js src/hooks/useProjects.js src/windows/Terminal.jsx CLAUDE.md
git commit -m "refactor: shared fetch-once store for projects and skills, useSkills hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Spotlight search, shortcut, state and actions

**Files:**
- Create: `src/lib/spotlight.js`, `src/lib/spotlight.test.js`
- Modify: `src/constants/apps.js`, `src/constants/apps.test.js`, `src/lib/shortcuts.js`, `src/lib/shortcuts.test.js`, `src/store/system.js`, `src/store/system.test.js`, `src/lib/menuActions.js`, `src/lib/menuActions.test.js`, `src/lib/menus.js`, `src/lib/menus.test.js`

**Interfaces:**
- Consumes:
  - `APPS` (registry).
  - `normalizeAddress(input) => string | null` from `src/lib/browser.js`, which yields only http(s) URLs and returns null for non-strings.
  - `runMenuAction` (Phase 6a).
- Produces:
  - **Registry:** every app gets `keywords: string[]` (lowercase).
  - **Entry shape:** `{ id: string, group: 'apps' | 'projects' | 'skills', title: string, subtitle: string, icon: string, keywords: string[], action }`.
  - **Groups:** `SPOTLIGHT_GROUPS = [{ id: 'apps', label: 'Applications' }, { id: 'projects', label: 'Projects' }, { id: 'skills', label: 'Skills' }]`.
  - **Index:** `buildSpotlightIndex({ apps?, projects?, skills? }) => Entry[]`.
  - **Search:** `searchSpotlight(index, query, { perGroup = 5 }?) => Array<{ id, label, results: Entry[] }>`. It returns `[]` for a blank query and leaves out empty groups.
  - **Flatten:** `flattenResults(groups) => Entry[]`.
  - **Selection:** `moveSelection(index, delta, count) => number`. It wraps, and returns 0 when `count` is 0.
  - **Shortcut:** `isSpotlightKey(event, isMac) => boolean`.
  - **System store:** `spotlightOpen: boolean`, plus `openSpotlight()` (desktop phase only; closes Mission Control), `closeSpotlight()` and `toggleSpotlight()`. `openMissionControl`, `lock` and `restart` all close Spotlight.
  - **Actions:** `{ type: 'openUrl', url }` opens a normalized http(s) URL in a new browser tab. `{ type: 'spotlight' }` opens Spotlight.
  - **Help menu:** gains `{ label: 'Spotlight', shortcut: isMac ? '⌘K' : '⌃K', action: { type: 'spotlight' } }` as its second item, before the separator.

- [ ] **Step 1: Write the failing tests.**

Create `src/lib/spotlight.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSpotlightIndex, flattenResults, moveSelection, searchSpotlight } from './spotlight';

const titles = (groups) => groups.map((group) => [group.id, group.results.map((entry) => entry.title)]);

describe('buildSpotlightIndex', () => {
    it('indexes every app that does something, but not the Archive', () => {
        const ids = buildSpotlightIndex().filter((entry) => entry.group === 'apps').map((entry) => entry.id);
        expect(ids).toEqual(['app:finder', 'app:contact', 'app:terminal', 'app:resume', 'app:safari', 'app:missionControl', 'app:about']);
    });

    it('opens windowed apps and runs launchers', () => {
        const index = buildSpotlightIndex();
        expect(index.find((entry) => entry.id === 'app:resume')).toMatchObject({
            title: 'Resume',
            subtitle: 'Application',
            icon: '/images/pdf.png',
            action: { type: 'openApp', id: 'resume' },
        });
        expect(index.find((entry) => entry.id === 'app:missionControl').action).toEqual({ type: 'missionControl' });
    });

    it('opens a project site in Safari, else its GitHub page, else Finder', () => {
        const index = buildSpotlightIndex({
            projects: [
                { id: 'a', title: 'askSudo', website: 'ask-sudo.vercel.app', github: 'https://github.com/x/a' },
                { id: 'b', title: 'Bot', github: 'https://github.com/x/b' },
                { id: 'c', title: 'Draft' },
            ],
        }).filter((entry) => entry.group === 'projects');

        expect(index.map((entry) => [entry.id, entry.subtitle, entry.action])).toEqual([
            ['project:a', 'Open in Safari', { type: 'openApp', id: 'safari', data: { url: 'ask-sudo.vercel.app', title: 'askSudo' } }],
            ['project:b', 'Open on GitHub', { type: 'openUrl', url: 'https://github.com/x/b' }],
            ['project:c', 'Show in Finder', { type: 'openApp', id: 'finder' }],
        ]);
    });

    it('skips untitled projects and ignores websites that are not text', () => {
        const index = buildSpotlightIndex({
            projects: [
                { id: 'a' },
                { id: 'b', title: '   ' },
                { id: 'c', title: 42 },
                { id: 'd', title: ' Tidy ', website: 42 },
            ],
        }).filter((entry) => entry.group === 'projects');

        expect(index.map((entry) => [entry.title, entry.action])).toEqual([
            ['Tidy', { type: 'openApp', id: 'finder' }],
        ]);
    });

    it('lists each technology under its category and opens the Skills terminal', () => {
        const index = buildSpotlightIndex({
            skills: [
                { id: 'fe', category: 'Frontend', items: ['React', ' Tailwind ', 7, ''] },
                { id: 'be', category: 'Backend', items: 'Node.js, Firebase' },
                { id: 'x', category: 'Empty' },
            ],
        }).filter((entry) => entry.group === 'skills');

        expect(index.map((entry) => [entry.title, entry.subtitle])).toEqual([
            ['React', 'Frontend'],
            ['Tailwind', 'Frontend'],
            ['Node.js', 'Backend'],
            ['Firebase', 'Backend'],
        ]);
        expect(index.every((entry) => entry.action.type === 'openApp' && entry.action.id === 'terminal')).toBe(true);
        expect(new Set(index.map((entry) => entry.id)).size).toBe(index.length);
    });
});

describe('searchSpotlight', () => {
    const index = buildSpotlightIndex({
        projects: [
            { id: 'p1', title: 'Portfolio OS' },
            { id: 'p2', title: 'Resume Parser' },
            { id: 'p3', title: 'Pricing Page' },
        ],
        skills: [{ id: 's', category: 'Frontend', items: ['React', 'Preact'] }],
    });

    it('returns nothing for an empty or blank query', () => {
        expect(searchSpotlight(index, '')).toEqual([]);
        expect(searchSpotlight(index, '   ')).toEqual([]);
        expect(searchSpotlight(index, undefined)).toEqual([]);
    });

    it('ignores case and extra spaces', () => {
        expect(titles(searchSpotlight(index, '  PORTFOLIO   os '))).toEqual([['projects', ['Portfolio OS']]]);
    });

    it('ranks exact, prefix, word-prefix, keyword, then substring matches', () => {
        const ranked = buildSpotlightIndex({
            apps: [],
            projects: [
                { id: '1', title: 'Spare Parts' },
                { id: '2', title: 'Parse' },
                { id: '3', title: 'Parser' },
                { id: '4', title: 'Comparse' },
                { id: '5', title: 'Big Parse Job' },
            ],
        });
        expect(titles(searchSpotlight(ranked, 'parse'))).toEqual([
            ['projects', ['Parse', 'Parser', 'Big Parse Job', 'Comparse']],
        ]);
    });

    it('finds apps by keyword', () => {
        expect(titles(searchSpotlight(index, 'cv'))).toEqual([['apps', ['Resume']]]);
    });

    it('keeps ties in index order and groups in a fixed order', () => {
        expect(titles(searchSpotlight(index, 'res'))).toEqual([
            ['apps', ['Resume']],
            ['projects', ['Resume Parser']],
        ]);
        // Projects is a title prefix; About This Mac matches by its 'profile' keyword.
        expect(titles(searchSpotlight(index, 'pr'))).toEqual([
            ['apps', ['Projects', 'About This Mac']],
            ['projects', ['Pricing Page']],
            ['skills', ['Preact']],
        ]);
    });

    it('caps each group', () => {
        const many = buildSpotlightIndex({
            apps: [],
            projects: Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: `Site ${i}` })),
        });
        expect(searchSpotlight(many, 'site')[0].results).toHaveLength(5);
        expect(searchSpotlight(many, 'site', { perGroup: 2 })[0].results.map((entry) => entry.title)).toEqual(['Site 0', 'Site 1']);
    });

    it('treats symbols literally', () => {
        expect(() => searchSpotlight(index, '(')).not.toThrow();
        expect(searchSpotlight(index, '.*')).toEqual([]);
        expect(titles(searchSpotlight(buildSpotlightIndex({ apps: [], projects: [{ id: 'c', title: 'C++ Notes' }] }), 'c++')))
            .toEqual([['projects', ['C++ Notes']]]);
    });

    it('flattens groups in display order', () => {
        expect(flattenResults(searchSpotlight(index, 'res')).map((entry) => entry.id)).toEqual(['app:resume', 'project:p2']);
    });
});

describe('moveSelection', () => {
    it('moves and wraps at both ends', () => {
        expect(moveSelection(0, 1, 3)).toBe(1);
        expect(moveSelection(2, 1, 3)).toBe(0);
        expect(moveSelection(0, -1, 3)).toBe(2);
    });

    it('stays at 0 when there is nothing to select', () => {
        expect(moveSelection(0, 1, 0)).toBe(0);
        expect(moveSelection(4, -1, 0)).toBe(0);
    });
});
```

These expectations depend on Step 3's exact keywords:
- **`'res'`:** only Resume matches among the apps, and only "Resume Parser" among projects. No app keyword contains "res".
- **`'pr'`:** Projects (title prefix) and About This Mac (the keyword `profile`) match. Among projects only "Pricing Page" matches; among skills only "Preact". "React" has no "pr".
- **Count:** this file has 15 tests.

Append to `src/lib/shortcuts.test.js`. Also add `isSpotlightKey` to that file's import from `./shortcuts`.

```js
describe('isSpotlightKey', () => {
    it('opens with Cmd+K on macOS, leaving Ctrl+K to text fields', () => {
        expect(isSpotlightKey({ metaKey: true, key: 'k' }, true)).toBe(true);
        expect(isSpotlightKey({ metaKey: true, key: 'K' }, true)).toBe(true);
        expect(isSpotlightKey({ ctrlKey: true, key: 'k' }, true)).toBe(false);
        expect(isSpotlightKey({ metaKey: true, code: 'Space', key: ' ' }, true)).toBe(false);
    });

    it('opens with Ctrl+K or Meta+Space elsewhere', () => {
        expect(isSpotlightKey({ ctrlKey: true, key: 'k' }, false)).toBe(true);
        expect(isSpotlightKey({ metaKey: true, code: 'Space', key: ' ' }, false)).toBe(true);
        expect(isSpotlightKey({ metaKey: true, key: 'k' }, false)).toBe(false);
    });

    it('ignores plain K and Shift/Alt combinations', () => {
        expect(isSpotlightKey({ key: 'k' }, true)).toBe(false);
        expect(isSpotlightKey({ metaKey: true, shiftKey: true, key: 'k' }, true)).toBe(false);
        expect(isSpotlightKey({ ctrlKey: true, altKey: true, key: 'k' }, false)).toBe(false);
    });
});
```

Append to `src/store/system.test.js`, inside a new `describe` at the end:

```js
describe('Spotlight state', () => {
    beforeEach(() => {
        useSystemStore.setState({ bootPhase: 'desktop' });
    });

    it('starts closed, opens, closes and toggles', () => {
        expect(system().spotlightOpen).toBe(false);
        system().openSpotlight();
        expect(system().spotlightOpen).toBe(true);
        system().closeSpotlight();
        expect(system().spotlightOpen).toBe(false);
        system().toggleSpotlight();
        expect(system().spotlightOpen).toBe(true);
        system().toggleSpotlight();
        expect(system().spotlightOpen).toBe(false);
    });

    it('never stacks with Mission Control', () => {
        system().openMissionControl();
        system().openSpotlight();
        expect(system().missionControl).toBeNull();
        expect(system().spotlightOpen).toBe(true);
        system().openMissionControl();
        expect(system().spotlightOpen).toBe(false);
        expect(system().missionControl).not.toBeNull();
    });

    it('opens only on the desktop and closes on lock and restart', () => {
        useSystemStore.setState({ bootPhase: 'locked' });
        system().openSpotlight();
        expect(system().spotlightOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openSpotlight();
        system().lock();
        expect(system().spotlightOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openSpotlight();
        system().restart();
        expect(system().spotlightOpen).toBe(false);
    });
});
```

Append inside the `describe('runMenuAction', …)` block of `src/lib/menuActions.test.js`:

```js
    it('opens a web address in a new browser tab', () => {
        const open = vi.fn();
        vi.stubGlobal('open', open);
        runMenuAction({ type: 'openUrl', url: 'github.com/x/b' });
        expect(open).toHaveBeenCalledWith('https://github.com/x/b', '_blank', 'noopener,noreferrer');
    });

    it('never opens anything but a web address', () => {
        const open = vi.fn();
        vi.stubGlobal('open', open);
        runMenuAction({ type: 'openUrl', url: 'javascript:alert(1)' });
        runMenuAction({ type: 'openUrl', url: 42 });
        expect(open).not.toHaveBeenCalled();
    });

    it('opens Spotlight', () => {
        runMenuAction({ type: 'spotlight' });
        expect(system().spotlightOpen).toBe(true);
    });
```

(That file's `beforeEach` already sets `bootPhase: 'desktop'`, and its `afterEach` calls `vi.unstubAllGlobals()`.)

Append to `src/constants/apps.test.js`, inside its existing `describe`:

```js
    it('gives every app that does something lowercase search keywords', () => {
        APPS.filter((app) => app.hasWindow !== false || app.action).forEach((app) => {
            expect(app.keywords.length, app.id).toBeGreaterThan(0);
            app.keywords.forEach((keyword) => expect(keyword).toBe(keyword.toLowerCase()));
        });
    });
```

Add `APPS` to that file's import from `./apps` if it isn't already imported.

In `src/lib/menus.test.js`, extend the test `'only shows shortcuts that work on this platform'` with:

```js
        expect(item(bar({ isMac: true }), 'help', 'Spotlight')).toMatchObject({ shortcut: '⌘K', action: { type: 'spotlight' } });
        expect(item(bar({ isMac: false }), 'help', 'Spotlight').shortcut).toBe('⌃K');
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run `npm test`. Expected failures:
- `spotlight.test.js` can't resolve `./spotlight`.
- `isSpotlightKey` is not exported.
- The Spotlight state, `openUrl`, `spotlight`, keywords and Help → Spotlight assertions fail.

- [ ] **Step 3: Add keywords to the registry.** In `src/constants/apps.js`, add a `keywords` line to each entry, right after `title` (or after `label` for Resume):

| id | keywords |
|---|---|
| `finder` | `['finder', 'work', 'portfolio', 'folders', 'files']` |
| `contact` | `['email', 'message', 'hire', 'reach out', 'socials']` |
| `terminal` | `['terminal', 'tech stack', 'technologies', 'tools']` |
| `resume` | `['cv', 'experience', 'pdf']` |
| `safari` | `['browser', 'web', 'internet', 'sites', 'live demos']` |
| `missionControl` | `['windows', 'overview', 'expose']` |
| `about` | `['system', 'profile', 'info', 'mac']` |
| `trash` | `[]` |

For example:

```js
        id: 'resume',
        title: 'Resume',
        label: 'Resume.pdf',
        keywords: ['cv', 'experience', 'pdf'],
```

The Step 1 search tests depend on these exact keywords:
- No keyword contains "res".
- The only keyword starting with "pr" is About's `profile`.

If you change a keyword, recheck those tests.

Also update the header comment's last line: `` // `action` marks dock launchers that run something instead of opening a window; `keywords` feed Spotlight. ``

- [ ] **Step 4: Write `src/lib/spotlight.js`.**

```js
import { APPS } from '../constants/apps';

// Spotlight's search is pure: the index is built from the registry and the
// Firestore lists, and every entry carries a plain action for runMenuAction
// (src/lib/menuActions.js). Notes and tracks join in Phases 7–8.

export const SPOTLIGHT_GROUPS = [
    { id: 'apps', label: 'Applications' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
];

// Firestore data is untyped: only non-blank strings count.
const isText = (value) => typeof value === 'string' && value.trim() !== '';

const appEntries = (apps) => apps
    .filter((app) => app.hasWindow !== false || app.action)
    .map((app) => ({
        id: `app:${app.id}`,
        group: 'apps',
        title: app.title,
        subtitle: 'Application',
        icon: app.icon,
        keywords: app.keywords ?? [],
        action: app.action === 'missionControl' ? { type: 'missionControl' } : { type: 'openApp', id: app.id },
    }));

const projectEntry = (project) => {
    const title = project.title.trim();

    if (isText(project.website)) {
        return { subtitle: 'Open in Safari', action: { type: 'openApp', id: 'safari', data: { url: project.website, title } } };
    }
    if (isText(project.github)) {
        return { subtitle: 'Open on GitHub', action: { type: 'openUrl', url: project.github } };
    }
    return { subtitle: 'Show in Finder', action: { type: 'openApp', id: 'finder' } };
};

const projectEntries = (projects) => projects
    .filter((project) => isText(project?.title))
    .map((project) => ({
        id: `project:${project.id}`,
        group: 'projects',
        title: project.title.trim(),
        icon: '/images/folder.png',
        keywords: [],
        ...projectEntry(project),
    }));

// The admin panel saves items as an array; older docs may hold one string.
const skillItems = (items) => (Array.isArray(items) ? items : isText(items) ? items.split(',') : [])
    .filter(isText)
    .map((item) => item.trim());

const skillEntries = (skills) => skills.flatMap((skill) => skillItems(skill?.items).map((item, index) => ({
    id: `skill:${skill.id}:${index}`,
    group: 'skills',
    title: item,
    subtitle: isText(skill.category) ? skill.category.trim() : 'Skill',
    icon: '/images/terminal.png',
    keywords: isText(skill.category) ? [skill.category.trim()] : [],
    action: { type: 'openApp', id: 'terminal' },
})));

export const buildSpotlightIndex = ({ apps = APPS, projects = [], skills = [] } = {}) => [
    ...appEntries(apps),
    ...projectEntries(projects),
    ...skillEntries(skills),
];

const normalize = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const wordsOf = (text) => text.split(/[\s\-_./]+/).filter(Boolean);

// Higher is better; 0 means no match. Plain string checks only, so any
// symbol in the query is matched literally.
const scoreEntry = (entry, query) => {
    const title = normalize(entry.title);
    const keywords = entry.keywords.map(normalize);

    if (title === query) return 6;
    if (title.startsWith(query)) return 5;
    if (wordsOf(title).some((word) => word.startsWith(query))) return 4;
    if (keywords.some((keyword) => keyword.startsWith(query))) return 3;
    if (title.includes(query)) return 2;
    if (keywords.some((keyword) => keyword.includes(query))) return 1;
    return 0;
};

export const searchSpotlight = (index, rawQuery, { perGroup = 5 } = {}) => {
    const query = typeof rawQuery === 'string' ? normalize(rawQuery) : '';

    if (!query) return [];

    return SPOTLIGHT_GROUPS
        .map((group) => ({
            ...group,
            results: index
                .map((entry, order) => ({ entry, order, score: entry.group === group.id ? scoreEntry(entry, query) : 0 }))
                .filter((match) => match.score > 0)
                .sort((a, b) => b.score - a.score || a.order - b.order)
                .slice(0, perGroup)
                .map((match) => match.entry),
        }))
        .filter((group) => group.results.length > 0);
};

export const flattenResults = (groups) => groups.flatMap((group) => group.results);

export const moveSelection = (index, delta, count) => (count === 0 ? 0 : (index + delta + count) % count);
```

Check the ranking test against this code. For the query "parse":
- "Parse" is exact (6).
- "Parser" is a prefix (5).
- "Big Parse Job" has a word starting with "parse" (4).
- "Comparse" contains "parse" (2).
- "Spare Parts" contains "par" but not "parse", so it scores 0 and is excluded.

So the expected order is `['Parse', 'Parser', 'Big Parse Job', 'Comparse']`.

- [ ] **Step 5: Add `isSpotlightKey` to `src/lib/shortcuts.js`.** Append:

```js
// Spotlight: Cmd+K on macOS (Ctrl+K there deletes to end of line), Ctrl+K
// elsewhere, plus Meta+Space off-Mac — macOS takes Cmd+Space before the page.
export const isSpotlightKey = (event, isMac) => {
    if (event.altKey || event.shiftKey) return false;

    const primary = isMac ? event.metaKey : event.ctrlKey;

    if (primary && event.key?.toLowerCase() === 'k') return true;
    return !isMac && Boolean(event.metaKey) && event.code === 'Space';
};
```

- [ ] **Step 6: Add Spotlight state to `src/store/system.js`.**
- Update the top comment to: `// OS-level state that isn't about a single window: boot phase, Mission Control, Spotlight and the desktop Clean Up counter; Control Center and audio in later phases.`
- Add `spotlightOpen: false,` to `createInitialSystemState` after `missionControl: null,`.
- In `openMissionControl`, also close Spotlight:

```js
    openMissionControl: () =>
      set((state) => {
        state.spotlightOpen = false;
        state.missionControl = { layout: missionControlLayout(visibleWindowEntries(), getViewport()) };
      }),
```

- Add these actions after `toggleMissionControl`:

```js
    // Spotlight and Mission Control never stack: each closes the other.
    openSpotlight: () =>
      set((state) => {
        if (state.bootPhase !== 'desktop') return;
        state.missionControl = null;
        state.spotlightOpen = true;
      }),

    closeSpotlight: () =>
      set((state) => {
        state.spotlightOpen = false;
      }),

    toggleSpotlight: () => {
      if (get().spotlightOpen) get().closeSpotlight();
      else get().openSpotlight();
    },
```

- In both `lock` and `restart`, add `state.spotlightOpen = false;` next to `state.missionControl = null;`.

- [ ] **Step 7: Add the actions to `src/lib/menuActions.js`.**
- Add the import: `import { normalizeAddress } from './browser';`
- Add `'openUrl'` to the `LEAVES_MISSION_CONTROL` set.
- Add these cases before `default:`:

```js
        case 'openUrl':
        {
            // Firestore links are untyped: only ever open an http(s) address.
            const url = normalizeAddress(action.url);
            if (url) globalThis.open?.(url, '_blank', 'noopener,noreferrer');
            break;
        }
        case 'spotlight':
            system.openSpotlight();
            break;
```

- [ ] **Step 8: Add Help → Spotlight in `src/lib/menus.js`.** In the `help` menu's `items`, insert this after the `Contact …` item and before `SEPARATOR`:

```js
                    { label: 'Spotlight', shortcut: isMac ? '⌘K' : '⌃K', action: { type: 'spotlight' } },
```

- [ ] **Step 9: Run the checks.**
- `npm test`: expect 199 passing. That's 174, plus 15 spotlight, 3 shortcuts, 3 system, 3 menuActions and 1 apps. The menus change extends an existing test. If the total differs, report the per-file counts.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 10: Commit.**

```bash
git add src/lib/spotlight.js src/lib/spotlight.test.js src/constants/apps.js src/constants/apps.test.js src/lib/shortcuts.js src/lib/shortcuts.test.js src/store/system.js src/store/system.test.js src/lib/menuActions.js src/lib/menuActions.test.js src/lib/menus.js src/lib/menus.test.js
git commit -m "feat: Spotlight search index, ranking, shortcut, state and actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Spotlight panel, magnifier, styles and docs

**Files:**
- Create: `src/components/system/Spotlight.jsx`
- Modify: `src/App.jsx`, `src/components/Navbar.jsx`, `src/constants/index.js`, `src/index.css`, `src/components/system/DesktopContextMenu.jsx`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md`

**Interfaces:**
- Consumes:
  - From Task 2: `buildSpotlightIndex`, `searchSpotlight`, `flattenResults`, `moveSelection`, `isSpotlightKey`, `spotlightOpen`, `closeSpotlight`, `toggleSpotlight`.
  - From Task 1: `useProjects` and `useSkills`.
  - From Phase 6a: `runMenuAction`.
- Produces: the `<Spotlight />` component, and a magnifier button marked `data-spotlight-toggle`.

- [ ] **Step 1: Create `src/components/system/Spotlight.jsx`.**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import useProjects from '../../hooks/useProjects';
import useSkills from '../../hooks/useSkills';
import { runMenuAction } from '../../lib/menuActions';
import { getPlatform, isMacPlatform, isSpotlightKey } from '../../lib/shortcuts';
import { buildSpotlightIndex, flattenResults, moveSelection, searchSpotlight } from '../../lib/spotlight';
import useSystemStore, { isDesktopPhase } from '../../store/system';

const isMac = isMacPlatform(getPlatform());

// The panel mounts only while open, so every open starts with an empty query.
const SpotlightPanel = () => {
    const closeSpotlight = useSystemStore((state) => state.closeSpotlight);
    const { projects } = useProjects();
    const { skills } = useSkills();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const panelRef = useRef(null);

    // A failed fetch leaves an empty list, so apps are still found.
    const index = useMemo(() => buildSpotlightIndex({ projects, skills }), [projects, skills]);
    const groups = useMemo(() => searchSpotlight(index, query), [index, query]);
    const results = flattenResults(groups);
    const active = Math.min(selected, Math.max(results.length - 1, 0));
    const hasQuery = query.trim() !== '';

    // Close on a press outside (the magnifier toggles on its own) or leaving the page.
    useEffect(() => {
        const handlePointerDown = (event) => {
            if (panelRef.current?.contains(event.target)) return;
            if (event.target.closest?.('[data-spotlight-toggle]')) return;
            closeSpotlight();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('blur', closeSpotlight);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('blur', closeSpotlight);
        };
    }, [closeSpotlight]);

    useEffect(() => {
        document.getElementById(`spotlight-${active}`)?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const choose = (entry) => {
        closeSpotlight();
        runMenuAction(entry.action);
    };

    const handleKeyDown = (event) => {
        // Enter that confirms an IME composition is not a choice.
        if (event.nativeEvent.isComposing) return;

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected(moveSelection(active, event.key === 'ArrowDown' ? 1 : -1, results.length));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (results[active]) choose(results[active]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeSpotlight();
        }
    };

    return (
        <div ref={panelRef} className="spotlight" role="dialog" aria-label="Spotlight Search">
            <div className="spotlight-field">
                <Search size={22} aria-hidden="true" />
                <input
                    autoFocus
                    type="text"
                    value={query}
                    placeholder="Spotlight Search"
                    aria-label="Spotlight Search"
                    role="combobox"
                    aria-expanded={results.length > 0}
                    aria-controls="spotlight-results"
                    aria-activedescendant={results[active] ? `spotlight-${active}` : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setSelected(0);
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
            {hasQuery && (
                <div id="spotlight-results" className="spotlight-results" role="listbox">
                    {groups.length === 0 ? (
                        <p className="spotlight-empty">No results</p>
                    ) : groups.map((group) => (
                        <div key={group.id} role="group" aria-label={group.label}>
                            <p className="spotlight-group">{group.label}</p>
                            {group.results.map((entry) => {
                                const position = results.indexOf(entry);

                                return (
                                    <button
                                        key={entry.id}
                                        id={`spotlight-${position}`}
                                        type="button"
                                        role="option"
                                        tabIndex={-1}
                                        aria-selected={position === active}
                                        className={`spotlight-row${position === active ? ' is-selected' : ''}`}
                                        onPointerMove={() => setSelected(position)}
                                        onClick={() => choose(entry)}
                                    >
                                        <img src={entry.icon} alt="" />
                                        <span className="spotlight-title">{entry.title}</span>
                                        <span className="spotlight-subtitle">{entry.subtitle}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Owns the global shortcut; works even while a text field has focus.
const Spotlight = () => {
    const open = useSystemStore((state) => state.spotlightOpen);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const system = useSystemStore.getState();

            if (!isDesktopPhase(system) || !isSpotlightKey(event, isMac)) return;

            event.preventDefault();
            system.toggleSpotlight();
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    return open ? <SpotlightPanel /> : null;
};

export default Spotlight;
```

- [ ] **Step 2: Mount it.** In `src/App.jsx`:
- Add the import `import Spotlight from "@components/system/Spotlight"` next to the other `@components/system` imports.
- Render `<Spotlight />` right after `<AppSwitcher />`.

- [ ] **Step 3: Add the magnifier button.**

In `src/constants/index.js`, change the second `navIcons` entry to:

```js
    {
        id: 2,
        img: "/icons/search.svg",
        action: "spotlight",
        label: "Spotlight",
    },
```

In `src/components/Navbar.jsx`:
- Add `const toggleSpotlight = useSystemStore((state) => state.toggleSpotlight)` after the `bootPhase` selector.
- Replace the `navIcons.map(...)` block with:

```jsx
          {navIcons.map(({ id, img, action, label }) => (
            <li key={id}>
              {action === 'spotlight' ? (
                // Spotlight's outside-press handler skips this, so it toggles cleanly.
                <button type="button" className="flex" data-spotlight-toggle aria-label={label} onClick={toggleSpotlight}>
                  <img className="icon-hover invert" src={img} alt="" />
                </button>
              ) : (
                <img className="icon-hover invert" src={img} alt={`icon-${id}`} />
              )}
            </li>
          ))}
```

- [ ] **Step 4: Keep the native menu inside Spotlight.** In `src/components/system/DesktopContextMenu.jsx`, append `, .spotlight` to the `NATIVE_MENU_AREAS` selector string.

- [ ] **Step 5: Add the styles.** Append to `src/index.css`, after the `.context-menu` rule:

```css
/* Spotlight: above windows, the menu bar (100000) and the hot corner
   (100001); below the desktop context menu (150000) and boot/lock (200000). */
.spotlight {
  position: fixed;
  top: 22vh;
  left: 50%;
  transform: translateX(-50%);
  z-index: 140000;
  width: min(640px, calc(100vw - 32px));
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(40 40 40 / 0.88);
  backdrop-filter: blur(30px) saturate(1.6);
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
  color: white;
}
.spotlight-field {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: rgb(255 255 255 / 0.6);
}
.spotlight-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 22px;
  color: white;
}
.spotlight-field input::placeholder {
  color: rgb(255 255 255 / 0.4);
}
.spotlight-results {
  max-height: min(400px, 50vh);
  overflow-y: auto;
  padding: 6px;
  border-top: 1px solid rgb(255 255 255 / 0.1);
}
.spotlight-group {
  padding: 6px 10px 2px;
  font-size: 11px;
  font-weight: 600;
  color: rgb(255 255 255 / 0.5);
}
.spotlight-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  text-align: left;
  font-size: 14px;
  cursor: default;
}
.spotlight-row.is-selected {
  background: rgb(10 132 255 / 0.85);
}
.spotlight-row img {
  flex: none;
  width: 24px;
  height: 24px;
  object-fit: contain;
}
.spotlight-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spotlight-subtitle {
  flex: none;
  font-size: 12px;
  color: rgb(255 255 255 / 0.55);
}
.spotlight-row.is-selected .spotlight-subtitle {
  color: rgb(255 255 255 / 0.85);
}
.spotlight-empty {
  padding: 12px 16px;
  font-size: 14px;
  color: rgb(255 255 255 / 0.5);
}
```

- [ ] **Step 6: Update the docs.**

In `CLAUDE.md`, after the "Menus are data" bullet in the window-system section, add:

`- **Spotlight** (`components/system/Spotlight.jsx`): Cmd+K on macOS, Ctrl+K elsewhere (plus Meta+Space off-Mac), the menu-bar magnifier, or Help → Spotlight. The search is pure (`src/lib/spotlight.js`): `buildSpotlightIndex` turns the registry (`keywords`), projects and skills into entries carrying `runMenuAction` actions, and `searchSpotlight` ranks and groups them. `spotlightOpen` lives in the system store; Spotlight and Mission Control close each other, and lock/restart close Spotlight.`

In the spec, under section 5's Spotlight bullet, add an indented note: `  - *Phase 6b note:* notes and tracks join the index with their apps (Phases 8 and 7). Cmd+K is the macOS shortcut; Ctrl+K there is left to text fields.`

- [ ] **Step 7: Run the checks.**
- `npm test`: 199 passing.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 8: Commit.**

```bash
git add src/components/system/Spotlight.jsx src/App.jsx src/components/Navbar.jsx src/constants/index.js src/index.css src/components/system/DesktopContextMenu.jsx CLAUDE.md docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md
git commit -m "feat: Spotlight panel with menu-bar magnifier

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Chrome checks (controller).**
- **Opening:** Cmd+K opens Spotlight on the desktop, including while Safari's address bar is focused, but not during the boot or lock screens. The magnifier toggles it, and Help → Spotlight opens it.
- **Typing:** "res" shows Applications → Resume and Projects → matches. ↑/↓ wrap, Enter opens the selection, and the selection resets on each keystroke.
- **Choosing results:**
  - The askSudo result opens a Safari tab.
  - A GitHub-only project opens a new browser tab.
  - A skill opens Skills.
  - Mission Control toggles.
- **Closing:** Esc closes Spotlight without leaving anything else open. An outside click and window blur close it too. Reopening shows an empty field.
- **Mission Control:** the hot corner or Ctrl+↑ (off-Mac) while Spotlight is open closes it, and Spotlight opened during Mission Control closes Mission Control.
- **Edge cases:** a query with no matches shows "No results", and a long list scrolls the selection into view.
- **Skills terminal:** it still loads its table, and its Retry button works.
