# Phase 1 — App Registry + Window Store Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-maintained window/dock/desktop config with a single app registry, add `focusedId` to the window store, make the dock focus (not close) open apps, make the menu-bar clock tick, and remove the dead Safari/Photos/Maps/txtfile/imgfile wiring — with no new user-facing features.

**Architecture:** `src/constants/apps.js` is a pure-data registry (no component imports, so it and the store are unit-testable without Firebase). Dock items, desktop items and the store seed are derived from it. Window components keep `WindowWrapper(Comp, 'key')`; the key must match a registry id. Pure helpers live in `src/lib/` and get Vitest tests.

**Tech Stack:** React 19, Vite 7, Zustand 5 + Immer, dayjs, Vitest 3 (new, dev only).

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md` (sections 1, 7, and build-order phase 1).

**Deviation from spec (deliberate):** the spec's registry entry includes `component`. It is omitted here because every window imports `src/lib/firebase.js`, which throws at init without `.env`; a registry that imports components would make the registry and store untestable. `defaultBounds`/`minSize` arrive in phase 2 and `keywords` in phase 6, when they are first used.

## Global Constraints

- Vitest for pure logic only; UI is verified manually with `npm run dev`.
- `npm run lint` must not exceed the 40-error baseline (`✖ 40 problems (40 errors, 0 warnings)` on `main`).
- Window ids stay stable so `#id` selectors in `src/index.css` keep matching.
- New apps get `placement: ['desktop']`, never the dock.
- Repo sits on a case-insensitive volume with AppleDouble `._*` files — never edit or commit them.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `feature/os-upgrade`.

## Review Focus

1. Clicking the dock icon of an app that is open but behind other windows must bring it to front, not close it (pinned in Task 3 via `getDockAction`).
2. Every id used by `navLinks` (menu bar) must exist in the store, or the menu item silently does nothing after the dead-config cleanup (pinned in Task 1 registry test).
3. Closing the focused window must hand focus to the next-topmost open window, not leave `focusedId` pointing at a closed window (pinned in Task 2).
4. `focusWindow` on a closed or unknown window must be a no-op, so stale Draggable presses can't resurrect z-order for hidden windows (pinned in Task 2).
5. The clock must stay correct across minute boundaries and after the tab is backgrounded — each tick recomputes the delay from the real time (pinned in Task 4 via `msUntilNextMinute`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/constants/apps.js` (create) | Registry `APPS`, `INITIAL_Z_INDEX`, derived `dockApps`, `desktopItems`, `buildWindowConfig`, `getApp` |
| `src/constants/apps.test.js` (create) | Registry invariants and derivations |
| `src/store/window.js` (modify) | Seed from registry, `focusedId`, `createInitialWindowState` |
| `src/store/window.test.js` (create) | Store action behavior |
| `src/lib/dock.js` (create) | `getDockAction(windowState)` |
| `src/lib/dock.test.js` (create) | Dock click decision |
| `src/lib/time.js` (create) | `msUntilNextMinute(date)` |
| `src/lib/time.test.js` (create) | Clock delay math |
| `src/hooks/useClock.js` (create) | Minute-aligned live `Date` |
| `src/components/Dock.jsx`, `src/components/Navbar.jsx` (modify) | Consume registry / clock |
| `src/constants/index.js` (modify) | Drop dead config, re-export derived items |
| `src/windows/Maps.jsx`, `src/store/map.js` (delete) | Dropped Maps app |
| `package.json`, `CLAUDE.md`, `AGENTS.md` (modify) | Test script, deps, docs |

---

### Task 1: Vitest setup + app registry

**Files:**
- Create: `src/constants/apps.js`, `src/constants/apps.test.js`
- Modify: `package.json` (scripts, devDependencies), `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes: `navLinks` from `src/constants/index.js` (test only).
- Produces:
  - `INITIAL_Z_INDEX: number` (1000)
  - `APPS: Array<{ id: string, title: string, icon: string, desktopIcon?: string, label?: string, placement: Array<'dock'|'desktop'>, desktopPosition?: { top: number, left: number }, hasWindow?: boolean }>`
  - `getApp(id: string) => App | undefined`
  - `dockApps: Array<{ id, name, icon, canOpen: boolean }>` (same shape `Dock.jsx` already consumes, except `icon` is now a full path)
  - `desktopItems: Array<{ id, title, icon, position: { top, left } }>` (same shape `DesktopItem.jsx` consumes)
  - `buildWindowConfig(apps?: App[]) => Record<id, { isOpen: false, zIndex: number, data: null }>`

- [ ] **Step 1: Install Vitest and add the script**

```bash
npm install -D vitest@^3.2.4
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 2: Write the failing registry test** — `src/constants/apps.test.js`

```js
import { describe, it, expect } from 'vitest';
import { APPS, INITIAL_Z_INDEX, getApp, dockApps, desktopItems, buildWindowConfig } from './apps';
import { navLinks } from './index';

describe('app registry', () => {
    it('has unique ids', () => {
        const ids = APPS.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('gives every desktop app a desktop position', () => {
        APPS.filter((a) => a.placement.includes('desktop')).forEach((a) => {
            expect(a.desktopPosition, a.id).toEqual({ top: expect.any(Number), left: expect.any(Number) });
        });
    });

    it('looks up apps by id', () => {
        expect(getApp('terminal').title).toBe('Skills');
        expect(getApp('nope')).toBeUndefined();
    });

    it('derives dock items in registry order with full icon paths', () => {
        expect(dockApps.map((a) => a.id)).toEqual(['finder', 'contact', 'terminal', 'trash']);
        expect(dockApps.find((a) => a.id === 'finder')).toEqual({
            id: 'finder', name: 'Projects', icon: '/images/finder.png', canOpen: true,
        });
        expect(dockApps.find((a) => a.id === 'trash').canOpen).toBe(false);
    });

    it('derives desktop items using label and desktopIcon overrides', () => {
        expect(desktopItems).toEqual([
            { id: 'finder', title: 'Projects', icon: '/images/folder.png', position: { top: 60, left: 20 } },
            { id: 'resume', title: 'Resume.pdf', icon: '/images/pdf.png', position: { top: 160, left: 20 } },
        ]);
    });

    it('builds a closed window entry for every windowed app only', () => {
        const config = buildWindowConfig();
        expect(Object.keys(config).sort()).toEqual(['contact', 'finder', 'resume', 'terminal']);
        expect(config.finder).toEqual({ isOpen: false, zIndex: INITIAL_Z_INDEX, data: null });
    });

    it('returns fresh objects on each build', () => {
        expect(buildWindowConfig().finder).not.toBe(buildWindowConfig().finder);
    });

    it('covers every menu-bar link with a window', () => {
        const config = buildWindowConfig();
        navLinks.forEach(({ type }) => expect(config[type], type).toBeDefined());
    });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/constants/apps.test.js`
Expected: FAIL — `Failed to resolve import "./apps"`.

- [ ] **Step 4: Write the registry** — `src/constants/apps.js`

```js
// Single source of truth for every app on the desktop.
// Pure data only — no component imports, so the store and tests can load it
// without initializing Firebase. Each windowed app's id must match the key
// passed to WindowWrapper in its component file.

export const INITIAL_Z_INDEX = 1000;

export const APPS = [
    {
        id: 'finder',
        title: 'Projects',
        icon: '/images/finder.png',
        desktopIcon: '/images/folder.png',
        placement: ['dock', 'desktop'],
        desktopPosition: { top: 60, left: 20 },
    },
    {
        id: 'contact',
        title: 'Contact',
        icon: '/images/contact.png',
        placement: ['dock'],
    },
    {
        id: 'terminal',
        title: 'Skills',
        icon: '/images/terminal.png',
        placement: ['dock'],
    },
    {
        id: 'resume',
        title: 'Resume',
        label: 'Resume.pdf',
        icon: '/images/pdf.png',
        placement: ['desktop'],
        desktopPosition: { top: 160, left: 20 },
    },
    {
        id: 'trash',
        title: 'Archive',
        icon: '/images/trash.png',
        placement: ['dock'],
        hasWindow: false,
    },
];

const hasWindow = (app) => app.hasWindow !== false;

export const getApp = (id) => APPS.find((app) => app.id === id);

export const dockApps = APPS
    .filter((app) => app.placement.includes('dock'))
    .map((app) => ({ id: app.id, name: app.title, icon: app.icon, canOpen: hasWindow(app) }));

export const desktopItems = APPS
    .filter((app) => app.placement.includes('desktop'))
    .map((app) => ({
        id: app.id,
        title: app.label ?? app.title,
        icon: app.desktopIcon ?? app.icon,
        position: app.desktopPosition,
    }));

export const buildWindowConfig = (apps = APPS) =>
    Object.fromEntries(
        apps
            .filter(hasWindow)
            .map((app) => [app.id, { isOpen: false, zIndex: INITIAL_Z_INDEX, data: null }])
    );
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/constants/apps.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Update the docs' test command**

In `CLAUDE.md`, replace the line beginning `No test suite is configured` with:

```markdown
`npm test` runs Vitest once (`vitest run`); `npm test -- src/store/window.test.js` runs one file. Tests cover pure logic only (registry, stores, `src/lib/` helpers) — UI is verified by running `npm run dev`. Never import a window component or `src/lib/firebase.js` from a test: Firebase throws at init without `.env`.
```

Also add `npm test          # Vitest, pure logic only` to the commands block after the `npm run lint` line.

In `AGENTS.md`, replace `**Note**: This project does not have a test suite configured. No \`test\` script exists.` with:

```markdown
# Unit tests (Vitest, pure logic only)
npm test
npm test -- src/store/window.test.js
```

placed inside the preceding bash block, removing the note line.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/constants/apps.js src/constants/apps.test.js CLAUDE.md AGENTS.md
git commit -m "feat: add app registry and Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Window store seeded from the registry, with `focusedId`

**Files:**
- Modify: `src/store/window.js` (full rewrite, 45 lines)
- Modify: `src/constants/index.js` (remove `INITIAL_Z_INDEX`/`WINDOW_CONFIG` block at the end of the file, lines ~534–548)
- Create: `src/store/window.test.js`

**Interfaces:**
- Consumes: `buildWindowConfig`, `INITIAL_Z_INDEX` from `src/constants/apps.js`.
- Produces (default export `useWindowStore`, plus named `createInitialWindowState`):
  - state: `windows: Record<id, { isOpen, zIndex, data }>`, `nextZIndex: number`, `focusedId: string | null`
  - `openWindow(key: string, data?: any)` — opens, raises to top, sets `focusedId`
  - `closeWindow(key: string)` — closes, resets `zIndex`/`data`; if it was focused, `focusedId` becomes the topmost remaining open window or `null`
  - `focusWindow(key: string)` — raises an **open** window and sets `focusedId`; no-op for closed/unknown keys
  - `createInitialWindowState() => { windows, nextZIndex, focusedId }` (fresh objects; used by tests to reset)

- [ ] **Step 1: Write the failing store test** — `src/store/window.test.js`

```js
import { describe, it, expect, beforeEach } from 'vitest';
import useWindowStore, { createInitialWindowState } from './window';
import { INITIAL_Z_INDEX } from '../constants/apps';

const store = () => useWindowStore.getState();

beforeEach(() => {
    useWindowStore.setState(createInitialWindowState());
});

describe('window store', () => {
    it('starts with every window closed and nothing focused', () => {
        expect(store().focusedId).toBeNull();
        Object.values(store().windows).forEach((w) => expect(w.isOpen).toBe(false));
    });

    it('opens a window on top and focuses it', () => {
        store().openWindow('finder', { folder: 'projects' });
        const w = store().windows.finder;
        expect(w).toEqual({ isOpen: true, zIndex: INITIAL_Z_INDEX + 1, data: { folder: 'projects' } });
        expect(store().focusedId).toBe('finder');
    });

    it('stacks later windows above earlier ones', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        expect(store().windows.terminal.zIndex).toBeGreaterThan(store().windows.finder.zIndex);
        expect(store().focusedId).toBe('terminal');
    });

    it('raises a focused window above the rest', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        store().focusWindow('finder');
        expect(store().windows.finder.zIndex).toBeGreaterThan(store().windows.terminal.zIndex);
        expect(store().focusedId).toBe('finder');
    });

    it('ignores focus on a closed window', () => {
        store().openWindow('finder');
        const before = store().nextZIndex;
        store().focusWindow('terminal');
        expect(store().windows.terminal.isOpen).toBe(false);
        expect(store().nextZIndex).toBe(before);
        expect(store().focusedId).toBe('finder');
    });

    it('resets a closed window and hands focus to the next topmost open window', () => {
        store().openWindow('finder');
        store().openWindow('contact');
        store().openWindow('terminal', { x: 1 });
        store().closeWindow('terminal');
        expect(store().windows.terminal).toEqual({ isOpen: false, zIndex: INITIAL_Z_INDEX, data: null });
        expect(store().focusedId).toBe('contact');
    });

    it('keeps focus when closing a background window', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        store().closeWindow('finder');
        expect(store().focusedId).toBe('terminal');
    });

    it('clears focus when the last window closes', () => {
        store().openWindow('finder');
        store().closeWindow('finder');
        expect(store().focusedId).toBeNull();
    });

    it('ignores unknown window ids', () => {
        const before = store();
        store().openWindow('safari');
        store().closeWindow('safari');
        store().focusWindow('safari');
        expect(store().windows).toEqual(before.windows);
        expect(store().nextZIndex).toBe(before.nextZIndex);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/store/window.test.js`
Expected: FAIL — `createInitialWindowState is not a function` (and `focusedId` undefined).

- [ ] **Step 3: Rewrite the store** — `src/store/window.js`

```js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { buildWindowConfig, INITIAL_Z_INDEX } from '../constants/apps';

export const createInitialWindowState = () => ({
  windows: buildWindowConfig(),
  nextZIndex: INITIAL_Z_INDEX + 1,
  focusedId: null,
});

const topmostOpenWindow = (windows) => {
  let topId = null;
  let topZ = -Infinity;

  Object.entries(windows).forEach(([id, window]) => {
    if (window.isOpen && window.zIndex > topZ) {
      topId = id;
      topZ = window.zIndex;
    }
  });

  return topId;
};

const useWindowStore = create(
  immer((set) => ({
    ...createInitialWindowState(),

    openWindow: (key, data = null) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = true;
        window.zIndex = state.nextZIndex;
        window.data = data || window.data;

        state.nextZIndex++;
        state.focusedId = key;
      }),

    closeWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = false;
        window.zIndex = INITIAL_Z_INDEX;
        window.data = null;

        if (state.focusedId === key) {
          state.focusedId = topmostOpenWindow(state.windows);
        }
      }),

    focusWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !window.isOpen) return;

        window.zIndex = state.nextZIndex;
        state.nextZIndex++;
        state.focusedId = key;
      }),
  }))
);

export default useWindowStore;
```

- [ ] **Step 4: Remove the old config from `src/constants/index.js`**

Delete the whole tail block starting at `const INITIAL_Z_INDEX = 1000;` through the line `export { INITIAL_Z_INDEX, WINDOW_CONFIG, INITIAL_Z_INDEX as initialZIndex, WINDOW_CONFIG as windowConfig };`. Then confirm nothing else referenced it:

Run: `grep -rn "WINDOW_CONFIG\|windowConfig\|initialZIndex" src | grep -v '/\._'`
Expected: no output.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS — `apps.test.js` (8) and `window.test.js` (9).

- [ ] **Step 6: Commit**

```bash
git add src/store/window.js src/store/window.test.js src/constants/index.js
git commit -m "refactor: seed window store from app registry and track focused window

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dock + desktop consume the registry; dock focuses open apps; remove dead apps

**Files:**
- Create: `src/lib/dock.js`, `src/lib/dock.test.js`
- Modify: `src/components/Dock.jsx`, `src/constants/index.js`, `CLAUDE.md`, `AGENTS.md`, `package.json`
- Delete: `src/windows/Maps.jsx`, `src/store/map.js`

**Interfaces:**
- Consumes: `dockApps`, `desktopItems` (Task 1); `useWindowStore` `openWindow`/`focusWindow`/`windows` (Task 2).
- Produces: `getDockAction(windowState?: { isOpen: boolean }) => 'none' | 'open' | 'focus'` — phase 2 extends it with `'restore'` for minimized windows.

- [ ] **Step 1: Write the failing test** — `src/lib/dock.test.js`

```js
import { describe, it, expect } from 'vitest';
import { getDockAction } from './dock';

describe('getDockAction', () => {
    it('does nothing for apps without a window', () => {
        expect(getDockAction(undefined)).toBe('none');
    });

    it('opens a closed window', () => {
        expect(getDockAction({ isOpen: false })).toBe('open');
    });

    it('focuses an open window instead of closing it', () => {
        expect(getDockAction({ isOpen: true })).toBe('focus');
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/dock.test.js`
Expected: FAIL — `Failed to resolve import "./dock"`.

- [ ] **Step 3: Implement** — `src/lib/dock.js`

```js
// What a dock icon click should do, given that app's window state
// (undefined when the app has no window, e.g. Archive).
export const getDockAction = (windowState) => {
    if (!windowState) return 'none';
    return windowState.isOpen ? 'focus' : 'open';
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/dock.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Point `src/constants/index.js` at the registry and drop dead data**

1. Delete the `const dockApps = [ ... ];` array (starts `const dockApps = [`, ends before `const blogPosts`).
2. Delete the `const desktopItems = [ ... ];` array (just above the main `export {` block).
3. Delete the `const mapLocations = [ ... ];` array.
4. Add at the very top of the file:

```js
import { dockApps, desktopItems } from './apps';
```

5. In the main `export { ... }` block, remove `mapLocations,` (keep `dockApps,` and `desktopItems,` — they now re-export the derived values).

- [ ] **Step 6: Update `src/components/Dock.jsx`**

Replace the store destructure and `toggleApp`:

```js
    const { windows, openWindow, focusWindow } = useWindowStore();
```

```js
    const handleAppClick = (app) => {
        const action = getDockAction(app.canOpen ? windows[app.id] : undefined);

        if (action === 'open') openWindow(app.id);
        if (action === 'focus') focusWindow(app.id);
    };
```

Add the import after the store import:

```js
import { getDockAction } from '../lib/dock';
```

Change `onClick={() => toggleApp(app)}` to `onClick={() => handleAppClick(app)}`, and the image `src={\`/images/${app.icon}\`}` to `src={app.icon}`.

- [ ] **Step 7: Delete the Maps app**

```bash
git rm src/windows/Maps.jsx src/store/map.js
npm uninstall mapbox-gl react-map-gl
grep -rn "mapbox\|react-map-gl\|useMapStore\|mapLocations" src | grep -v '/\._'
```

Expected: the grep prints nothing.

- [ ] **Step 8: Rewrite the window-system docs**

In `CLAUDE.md`, replace the paragraph starting `**The \`windowKey\` string is a four-way contract.**` and its numbered list, plus the `**Known drift here:**` paragraph, with:

```markdown
**`src/constants/apps.js` is the app registry** — pure data, no component imports (so the store and tests load it without Firebase). Dock items, desktop icons and the store seed are all derived from it; `placement` lists where an app's icon appears (`'dock'`, `'desktop'`), and `hasWindow: false` marks launchers like Archive. Adding a window means: a registry entry, a component ending in `WindowWrapper(Comp, '<same id>')`, its barrel export in `src/windows/index.js`, a render in `App.jsx`, and `#id` CSS in `src/index.css` if it needs custom styling. New apps go on the desktop, not the dock.
```

Also update the window-system bullets: replace the `WINDOW_CONFIG` bullet with `- The store seed comes from \`buildWindowConfig()\` in \`apps.js\`: a map of \`windowKey → { isOpen, zIndex, data }\`.`, and add `- The store tracks \`focusedId\`; closing the focused window hands focus to the next-topmost open one.` In the Commands section, delete the sentence about `VITE_MAPBOX_TOKEN`. In the Data flow paragraph, remove `map locations, ` from the list of static content.

In `AGENTS.md` under `### Window Management`, append:

```markdown
Apps are declared once in `src/constants/apps.js`; dock and desktop icons are derived from it. Clicking a dock icon opens a closed window or focuses an open one — it never closes it.
```

- [ ] **Step 9: Verify tests, lint and the running app**

Run: `npm test`
Expected: PASS — 3 files, 20 tests.

Run: `npm run lint 2>&1 | tail -2`
Expected: `✖ N problems` with N ≤ 40 (deleting `Maps.jsx` may lower it).

Run: `npm run dev`, open http://localhost:5173 and check:
- Dock shows Projects, Contact, Skills, Archive (no Safari/Photos); all icons render.
- Desktop shows Projects and Resume.pdf icons; single-click opens each.
- Open Projects, then Skills, then click the Projects dock icon: Projects comes to front and stays open.
- Archive icon is dimmed and clicking it does nothing.
- Menu-bar Projects/Contact/Resume links each open their window.

- [ ] **Step 10: Commit**

```bash
git add -A src/lib/dock.js src/lib/dock.test.js src/components/Dock.jsx src/constants/index.js package.json package-lock.json CLAUDE.md AGENTS.md
git commit -m "feat: derive dock and desktop from registry, focus open apps from dock, drop Maps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git rm` in Step 7 already staged the deletions.)

---

### Task 4: Live menu-bar clock

**Files:**
- Create: `src/lib/time.js`, `src/lib/time.test.js`, `src/hooks/useClock.js`
- Modify: `src/components/Navbar.jsx`

**Interfaces:**
- Produces:
  - `msUntilNextMinute(date: Date) => number` in `(0, 60000]`
  - `useClock() => Date` — re-renders on each minute boundary (reused by the lock screen in phase 4)

- [ ] **Step 1: Write the failing test** — `src/lib/time.test.js`

```js
import { describe, it, expect } from 'vitest';
import { msUntilNextMinute } from './time';

describe('msUntilNextMinute', () => {
    it('counts down to the next minute boundary', () => {
        expect(msUntilNextMinute(new Date(2026, 9, 22, 10, 30, 45, 500))).toBe(14500);
    });

    it('waits a full minute when exactly on a boundary', () => {
        expect(msUntilNextMinute(new Date(2026, 9, 22, 10, 30, 0, 0))).toBe(60000);
    });

    it('handles the last millisecond of a minute', () => {
        expect(msUntilNextMinute(new Date(2026, 9, 22, 23, 59, 59, 999))).toBe(1);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/lib/time.test.js`
Expected: FAIL — `Failed to resolve import "./time"`.

- [ ] **Step 3: Implement** — `src/lib/time.js`

```js
// Milliseconds until the wall clock next reaches :00 seconds.
export const msUntilNextMinute = (date) =>
    60000 - (date.getSeconds() * 1000 + date.getMilliseconds());
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/time.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Create the hook** — `src/hooks/useClock.js`

```js
import { useEffect, useState } from 'react';

import { msUntilNextMinute } from '../lib/time';

// Current time, refreshed on every minute boundary. The delay is recomputed
// from the real clock each tick, so it self-corrects after the tab sleeps.
const useClock = () => {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let timeoutId;

        const schedule = () => {
            timeoutId = setTimeout(() => {
                setNow(new Date());
                schedule();
            }, msUntilNextMinute(new Date()));
        };

        schedule();

        return () => clearTimeout(timeoutId);
    }, []);

    return now;
};

export default useClock;
```

- [ ] **Step 6: Use it in `src/components/Navbar.jsx`**

Add after the `dayjs` import:

```js
import useClock from '../hooks/useClock'
```

Add as the first line inside `Navbar`:

```js
  const now = useClock()
```

Change `<time>{dayjs().format("ddd MMM D h:mm A")}</time>` to:

```jsx
        <time>{dayjs(now).format("ddd MMM D h:mm A")}</time>
```

- [ ] **Step 7: Verify**

Run: `npm test`
Expected: PASS — 4 files, 23 tests.

Run: `npm run lint 2>&1 | tail -2`
Expected: N ≤ the count after Task 3.

Run: `npm run dev`; note the menu-bar time, wait until the system clock passes the next minute, and confirm the menu bar updates within a second of it.

- [ ] **Step 8: Commit**

```bash
git add src/lib/time.js src/lib/time.test.js src/hooks/useClock.js src/components/Navbar.jsx
git commit -m "fix: make the menu-bar clock tick every minute

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
