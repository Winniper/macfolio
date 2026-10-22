# Phase 6a — Menu Bar, About This Mac, Desktop Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the menu bar into a working macOS menu bar (Apple menu with About This Mac / Restart… / Lock Screen, the focused app's bold name, File / Edit / Window / Go / Help menus where every item does something), add an About This Mac window, and add a right-click menu on the wallpaper and desktop icons.

**Architecture:** Menus are data. A pure `buildMenuBar()` (`src/lib/menus.js`) turns the current window state into menus whose items carry plain action objects; `runMenuAction()` (`src/lib/menuActions.js`) performs an action against the window and system stores. Both are unit-tested. One `Menu` component renders any item list; the rebuilt `Navbar` and a new `DesktopContextMenu` use it. About This Mac is an ordinary registry window (`about`, launch-only).

**Tech Stack:** React 19, Zustand 5, GSAP 3.14, Tailwind 4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md` — section 5 (Menu bar, Desktop context menu) and section 4 "About This Mac"; build-order phase 6 (split: this is 6a; Spotlight is 6b; notifications + sounds are 6c).

**Decisions:**
- *Only real shortcuts are shown.* A menu item shows a shortcut only if pressing it works on the visitor's platform (Mission Control ⌃↑ off-Mac; switcher ⌥⇥/⌃\`). Browser-owned keys like ⌘W/⌘T are never advertised.
- *Edit has one item, Copy* (copies the selected text). Paste/Undo can't work without clipboard permission prompts.
- *Desktop right-click: Open Terminal, Clean Up, About This Mac.* The spec's "New Note" waits for the Notes app (Phase 8).
- *About This Mac shows only real data:* name, avatar/initials, optional `role` and `location` (null until the owner sets them — then hidden), and the live project count. The `socials`/`techStack` constants are leftover template data (JS Mastery links) and are not shown.
- *Spotlight and Control Center icons* arrive with their features (6b, Phase 7); the existing decorative status icons stay.
- *Restart/Lock blur the focused element first* so the key that dismisses the lock screen can't type into a hidden input (deferred from the Phase 4 review).
- *The welcome entrance tween is killed on restart/lock* (Phase 4 deferred minor, now reachable via the Apple menu).

## Global Constraints

- Menu bar: Apple menu (About This Mac, Restart…, Lock Screen); bold focused-app name; File / Edit / Window / Help / **Go** menus where every item works (Window: Minimize/Zoom/Close; Browser File: New Tab; Help: opens Contact; Go: Projects/Contact/Resume). Right side: live clock (already ticks each minute).
- Desktop context menu: wallpaper only (windows/iframes keep native menus). On a desktop icon: Open.
- About This Mac: `placement: []`, small window styled like macOS's.
- Desktop shortcuts and global listeners check `isDesktopPhase(useSystemStore.getState())`.
- Window components: `data-titlebar` header; root fills the section; never clip/position the `<section>` in CSS; export Terminal-style (`const XWindow = WindowWrapper(X, 'key'); export default XWindow;`).
- Vitest covers pure logic and stores only; never import a window/component or `src/lib/firebase.js` from a test. UI is verified in Chrome.
- `npx eslint . --ignore-pattern .superpowers` stays at 10 errors / 0 warnings. Never edit or commit `._*` files or the untracked `plan.md`, `page-render-check.png`, `website-screenshot.png`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `feature/menus`.

## Review Focus

1. Choosing Lock Screen or Restart while a text field (e.g. Safari's address bar) has focus must not let the unlock key type into that field (pinned in Task 1: `runMenuAction` blurs first).
2. A context menu opened near the right or bottom edge must stay fully on screen (pinned in Task 1: `clampMenuPosition`).
3. Window menu commands with no focused window must be disabled, never acting on a stale window (pinned in Task 1).
4. Menu dropdowns must render above windows and close on outside click, Esc, and window blur (verified in Chrome, Task 2).
5. Right-click inside a window, an input, the menu bar, the dock, or Mission Control must keep the browser's native behavior; only the wallpaper and desktop icons get the custom menu (verified in Chrome, Task 3).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/menus.js` + test (create) | `buildMenuBar`, `desktopMenuItems`, `clampMenuPosition`, `DESKTOP_TITLE` |
| `src/lib/menuActions.js` + test (create) | `runMenuAction` |
| `src/lib/profile.js` + test (create) | `initialsOf` (shared by lock screen and About) |
| `src/store/system.js` (modify) | `desktopCleanups` counter + `cleanUpDesktop()` |
| `src/components/menubar/Menu.jsx` (create) | Renders a menu item list |
| `src/components/Navbar.jsx` (rewrite) | Menu bar |
| `src/windows/AboutThisMac.jsx` (create) | About window |
| `src/components/system/DesktopContextMenu.jsx` (create) | Right-click menu |
| `src/components/DesktopItem.jsx` (modify) | `data-desktop-item`, Clean Up animation |
| `src/components/Welcome.jsx`, `src/components/system/LockScreen.jsx`, `src/windows/Browser.jsx` (modify) | Kill entrance on restart; shared initials; New Tab request |
| `src/constants/apps.js` + test, `src/constants/index.js`, `src/windows/index.js`, `src/App.jsx`, `src/index.css`, `CLAUDE.md` (modify) | Registry, profile fields, export, render, styles, docs |

---

### Task 1: Menu model and actions

**Files:**
- Create: `src/lib/menus.js`, `src/lib/menus.test.js`, `src/lib/menuActions.js`, `src/lib/menuActions.test.js`, `src/lib/profile.js`, `src/lib/profile.test.js`
- Modify: `src/store/system.js`, `src/constants/apps.js`, `src/constants/apps.test.js`, `src/constants/index.js`

**Interfaces:**
- Consumes: `getApp`, `buildWindowConfig` (registry); `profile` (constants); window store actions; system store `switchToApp`, `toggleMissionControl`, `restart`, `lock`.
- Produces:
  - Item shape: `{ label, action?, shortcut?, disabled?, checked? }` or `{ separator: true }`. Action shapes: `{ type: 'openApp', id, data? }`, `{ type: 'focusApp', id }`, `{ type: 'close' | 'minimize' | 'zoom', id }`, `{ type: 'missionControl' }`, `{ type: 'safariNewTab' }`, `{ type: 'copySelection' }`, `{ type: 'restart' }`, `{ type: 'lock' }`, `{ type: 'cleanUp' }`
  - `DESKTOP_TITLE = "DevBarman's Portfolio"`
  - `buildMenuBar({ focusedId, windows, isMac, hasSelection }) => { apple: Item[], menus: Array<{ id: 'app' | 'file' | 'edit' | 'window' | 'go' | 'help', title, bold?, items }> }`
  - `desktopMenuItems: Item[]`
  - `clampMenuPosition({ x, y }, { w, h }, viewport) => { x, y }` (4px margin)
  - `runMenuAction(action) => void`
  - `initialsOf(name) => string`
  - System store: `desktopCleanups: number` (starts 0), `cleanUpDesktop()`
  - Registry: `about` entry (`placement: []`); `profile.role`, `profile.location` (null)

- [ ] **Step 1: Write the failing tests**

`src/lib/menus.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { DESKTOP_TITLE, buildMenuBar, clampMenuPosition, desktopMenuItems } from './menus';
import { buildWindowConfig } from '../constants/apps';

const windowsWith = (open = {}) => {
    const windows = buildWindowConfig();
    Object.entries(open).forEach(([id, patch]) => Object.assign(windows[id], { isOpen: true }, patch));
    return windows;
};
const bar = (options = {}) =>
    buildMenuBar({ focusedId: null, windows: windowsWith(), isMac: true, hasSelection: false, ...options });
const menu = (menuBar, id) => menuBar.menus.find((m) => m.id === id);
const item = (menuBar, id, label) => menu(menuBar, id).items.find((i) => i.label === label);
const labels = (items) => items.filter((i) => !i.separator).map((i) => i.label);

describe('buildMenuBar', () => {
    it('names the desktop when no window is focused', () => {
        expect(menu(bar(), 'app')).toMatchObject({ title: DESKTOP_TITLE, bold: true });
    });

    it('names the focused app', () => {
        expect(menu(bar({ focusedId: 'terminal', windows: windowsWith({ terminal: {} }) }), 'app').title).toBe('Skills');
    });

    it('offers About This Mac, Restart and Lock Screen in the Apple menu', () => {
        expect(bar().apple.filter((i) => !i.separator).map((i) => [i.label, i.action])).toEqual([
            ['About This Mac', { type: 'openApp', id: 'about' }],
            ['Restart…', { type: 'restart' }],
            ['Lock Screen', { type: 'lock' }],
        ]);
    });

    it('adds New Tab to the File menu only for Safari', () => {
        expect(labels(menu(bar({ focusedId: 'safari', windows: windowsWith({ safari: {} }) }), 'file').items))
            .toEqual(['New Tab', 'Close Window']);
        expect(labels(menu(bar({ focusedId: 'finder', windows: windowsWith({ finder: {} }) }), 'file').items))
            .toEqual(['Close Window']);
    });

    it('disables window commands when nothing is focused', () => {
        const menuBar = bar();
        expect(item(menuBar, 'window', 'Minimize').disabled).toBe(true);
        expect(item(menuBar, 'window', 'Zoom').disabled).toBe(true);
        expect(item(menuBar, 'file', 'Close Window').disabled).toBe(true);
    });

    it('points window commands at the focused window', () => {
        const menuBar = bar({ focusedId: 'finder', windows: windowsWith({ finder: {} }) });
        expect(item(menuBar, 'window', 'Minimize')).toMatchObject({ disabled: false, action: { type: 'minimize', id: 'finder' } });
        expect(item(menuBar, 'window', 'Zoom').action).toEqual({ type: 'zoom', id: 'finder' });
        expect(item(menuBar, 'file', 'Close Window').action).toEqual({ type: 'close', id: 'finder' });
    });

    it('lists open windows in the Window menu and checks the focused one', () => {
        const menuBar = bar({
            focusedId: 'resume',
            windows: windowsWith({ finder: {}, resume: {}, contact: { isMinimized: true } }),
        });
        const list = menu(menuBar, 'window').items.filter((i) => i.action?.type === 'focusApp');
        expect(list.map((i) => [i.label, i.checked])).toEqual([
            ['Projects', false],
            ['Contact', false],
            ['Resume', true],
        ]);
    });

    it('enables Copy only while text is selected', () => {
        expect(item(bar(), 'edit', 'Copy')).toMatchObject({ disabled: true, action: { type: 'copySelection' } });
        expect(item(bar({ hasSelection: true }), 'edit', 'Copy').disabled).toBe(false);
    });

    it('only shows shortcuts that work on this platform', () => {
        expect(item(bar({ isMac: true }), 'window', 'Mission Control').shortcut).toBeUndefined();
        expect(item(bar({ isMac: false }), 'window', 'Mission Control').shortcut).toBe('⌃↑');
        expect(item(bar({ isMac: true }), 'help', 'Switch apps')).toMatchObject({ shortcut: '⌥⇥  ⌃`', disabled: true });
        expect(item(bar({ isMac: false }), 'help', 'Switch apps').shortcut).toBe('⌃`');
    });

    it('opens apps from the Go menu and Contact from Help', () => {
        expect(menu(bar(), 'go').items.map((i) => [i.label, i.action])).toEqual([
            ['Projects', { type: 'openApp', id: 'finder' }],
            ['Safari', { type: 'openApp', id: 'safari' }],
            ['Resume', { type: 'openApp', id: 'resume' }],
            ['Contact', { type: 'openApp', id: 'contact' }],
        ]);
        expect(item(bar(), 'help', 'Contact Debaditya').action).toEqual({ type: 'openApp', id: 'contact' });
    });
});

describe('desktopMenuItems', () => {
    it('offers Open Terminal, Clean Up and About This Mac on the wallpaper', () => {
        expect(desktopMenuItems.filter((i) => !i.separator).map((i) => [i.label, i.action])).toEqual([
            ['Open Terminal', { type: 'openApp', id: 'terminal' }],
            ['Clean Up', { type: 'cleanUp' }],
            ['About This Mac', { type: 'openApp', id: 'about' }],
        ]);
    });
});

describe('clampMenuPosition', () => {
    const viewport = { width: 1440, height: 900 };
    const size = { w: 220, h: 120 };

    it('keeps a menu that fits where it was opened', () => {
        expect(clampMenuPosition({ x: 300, y: 200 }, size, viewport)).toEqual({ x: 300, y: 200 });
    });

    it('pulls a menu back on screen near the right and bottom edges', () => {
        expect(clampMenuPosition({ x: 1400, y: 880 }, size, viewport)).toEqual({ x: 1216, y: 776 });
    });

    it('never goes past the top-left margin', () => {
        expect(clampMenuPosition({ x: -10, y: 0 }, size, { width: 200, height: 100 })).toEqual({ x: 4, y: 4 });
    });
});
```

`src/lib/menuActions.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runMenuAction } from './menuActions';
import useWindowStore, { createInitialWindowState } from '../store/window';
import useSystemStore, { createInitialSystemState } from '../store/system';

const windows = () => useWindowStore.getState();
const system = () => useSystemStore.getState();

beforeEach(() => {
    useWindowStore.setState(createInitialWindowState());
    useSystemStore.setState({ ...createInitialSystemState(), bootPhase: 'desktop' });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('runMenuAction', () => {
    it('opens an app', () => {
        runMenuAction({ type: 'openApp', id: 'about' });
        expect(windows().windows.about.isOpen).toBe(true);
        expect(windows().focusedId).toBe('about');
    });

    it('switches to an app, restoring it if minimized', () => {
        windows().openWindow('finder');
        windows().minimizeWindow('finder');
        runMenuAction({ type: 'focusApp', id: 'finder' });
        expect(windows().windows.finder.isMinimized).toBe(false);
        expect(windows().focusedId).toBe('finder');
    });

    it('closes, minimizes and zooms a window', () => {
        windows().openWindow('finder');
        runMenuAction({ type: 'zoom', id: 'finder' });
        expect(windows().windows.finder.isMaximized).toBe(true);
        runMenuAction({ type: 'minimize', id: 'finder' });
        expect(windows().windows.finder.isMinimized).toBe(true);
        runMenuAction({ type: 'close', id: 'finder' });
        expect(windows().windows.finder.isOpen).toBe(false);
    });

    it('toggles Mission Control', () => {
        runMenuAction({ type: 'missionControl' });
        expect(system().missionControl).not.toBeNull();
        runMenuAction({ type: 'missionControl' });
        expect(system().missionControl).toBeNull();
    });

    it('asks Safari for a new tab every time', () => {
        runMenuAction({ type: 'safariNewTab' });
        const first = windows().windows.safari.data;
        runMenuAction({ type: 'safariNewTab' });
        expect(windows().windows.safari.data).toEqual({ newTab: true });
        expect(windows().windows.safari.data).not.toBe(first);
        expect(windows().focusedId).toBe('safari');
    });

    it('drops keyboard focus before locking or restarting', () => {
        const blur = vi.fn();
        vi.stubGlobal('document', { activeElement: { blur } });
        runMenuAction({ type: 'lock' });
        expect(blur).toHaveBeenCalledTimes(1);
        expect(system().bootPhase).toBe('locked');
        runMenuAction({ type: 'restart' });
        expect(blur).toHaveBeenCalledTimes(2);
        expect(system().bootPhase).toBe('booting');
    });

    it('copies the selected text', () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        vi.stubGlobal('getSelection', () => ({ toString: () => 'hello' }));
        runMenuAction({ type: 'copySelection' });
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('tidies the desktop icons', () => {
        runMenuAction({ type: 'cleanUp' });
        runMenuAction({ type: 'cleanUp' });
        expect(system().desktopCleanups).toBe(2);
    });

    it('ignores unknown actions', () => {
        expect(() => runMenuAction({ type: 'nope' })).not.toThrow();
    });
});
```

`src/lib/profile.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { initialsOf } from './profile';

describe('initialsOf', () => {
    it('uses the first letters of the first two names', () => {
        expect(initialsOf('Debaditya Barman')).toBe('DB');
        expect(initialsOf('  ada  king lovelace ')).toBe('AK');
        expect(initialsOf('Prince')).toBe('P');
    });
});
```

In `src/constants/apps.test.js`, change the key list in `'builds a closed window entry for every windowed app only'` to `['about', 'contact', 'finder', 'resume', 'safari', 'terminal']`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL — missing modules `./menus`, `./menuActions`, `./profile`; the apps test misses `about`.

- [ ] **Step 3: Implement**

`src/lib/profile.js`:

```js
// "Debaditya Barman" → "DB": the avatar fallback until a photo is set.
export const initialsOf = (name) =>
    name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
```

`src/lib/menus.js`:

```js
import { getApp } from '../constants/apps';
import { profile } from '../constants';

// Menus are data: items carry plain action objects that runMenuAction
// (src/lib/menuActions.js) performs. A shortcut is shown only when pressing it
// actually works on the visitor's platform.

export const DESKTOP_TITLE = "DevBarman's Portfolio";

const SEPARATOR = { separator: true };

const firstName = profile.name.trim().split(/\s+/)[0];

const appleMenu = [
    { label: 'About This Mac', action: { type: 'openApp', id: 'about' } },
    SEPARATOR,
    { label: 'Restart…', action: { type: 'restart' } },
    { label: 'Lock Screen', action: { type: 'lock' } },
];

export const desktopMenuItems = [
    { label: 'Open Terminal', action: { type: 'openApp', id: 'terminal' } },
    { label: 'Clean Up', action: { type: 'cleanUp' } },
    SEPARATOR,
    { label: 'About This Mac', action: { type: 'openApp', id: 'about' } },
];

const windowCommand = (label, type, focusedId) => ({
    label,
    action: { type, id: focusedId },
    disabled: !focusedId,
});

export const buildMenuBar = ({ focusedId, windows, isMac, hasSelection }) => {
    const openIds = Object.keys(windows).filter((id) => windows[id].isOpen);
    const appTitle = focusedId ? getApp(focusedId).title : DESKTOP_TITLE;

    return {
        apple: appleMenu,
        menus: [
            {
                id: 'app',
                title: appTitle,
                bold: true,
                items: focusedId
                    ? [{ label: `Close ${appTitle}`, action: { type: 'close', id: focusedId } }]
                    : [{ label: 'About This Mac', action: { type: 'openApp', id: 'about' } }],
            },
            {
                id: 'file',
                title: 'File',
                items: [
                    ...(focusedId === 'safari' ? [{ label: 'New Tab', action: { type: 'safariNewTab' } }] : []),
                    windowCommand('Close Window', 'close', focusedId),
                ],
            },
            {
                id: 'edit',
                title: 'Edit',
                items: [{ label: 'Copy', action: { type: 'copySelection' }, disabled: !hasSelection }],
            },
            {
                id: 'window',
                title: 'Window',
                items: [
                    windowCommand('Minimize', 'minimize', focusedId),
                    windowCommand('Zoom', 'zoom', focusedId),
                    SEPARATOR,
                    {
                        label: 'Mission Control',
                        action: { type: 'missionControl' },
                        ...(isMac ? {} : { shortcut: '⌃↑' }),
                    },
                    ...(openIds.length ? [SEPARATOR] : []),
                    ...openIds.map((id) => ({
                        label: getApp(id).title,
                        action: { type: 'focusApp', id },
                        checked: id === focusedId,
                    })),
                ],
            },
            {
                id: 'go',
                title: 'Go',
                items: ['finder', 'safari', 'resume', 'contact'].map((id) => ({
                    label: getApp(id).title,
                    action: { type: 'openApp', id },
                })),
            },
            {
                id: 'help',
                title: 'Help',
                items: [
                    { label: `Contact ${firstName}`, action: { type: 'openApp', id: 'contact' } },
                    SEPARATOR,
                    { label: 'Switch apps', shortcut: isMac ? '⌥⇥  ⌃`' : '⌃`', disabled: true },
                    { label: 'Mission Control', shortcut: isMac ? 'Top-right corner' : '⌃↑', disabled: true },
                ],
            },
        ],
    };
};

// Keep a menu opened at (x, y) fully on screen, 4px from every edge.
export const clampMenuPosition = ({ x, y }, { w, h }, viewport) => ({
    x: Math.max(4, Math.min(x, viewport.width - w - 4)),
    y: Math.max(4, Math.min(y, viewport.height - h - 4)),
});
```

`src/lib/menuActions.js`:

```js
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';

// Lock/Restart cover the desktop; drop focus first so the key that dismisses
// the lock screen can't type into a hidden input.
const blurActiveElement = () => globalThis.document?.activeElement?.blur?.();

export const runMenuAction = (action) => {
    const windows = useWindowStore.getState();
    const system = useSystemStore.getState();

    switch (action.type) {
        case 'openApp':
            windows.openWindow(action.id, action.data ?? null);
            break;
        case 'focusApp':
            system.switchToApp(action.id);
            break;
        case 'close':
            windows.closeWindow(action.id);
            break;
        case 'minimize':
            windows.minimizeWindow(action.id);
            break;
        case 'zoom':
            windows.toggleMaximize(action.id);
            break;
        case 'missionControl':
            system.toggleMissionControl();
            break;
        case 'safariNewTab':
            windows.openWindow('safari', { newTab: true });
            break;
        case 'copySelection':
            globalThis.navigator?.clipboard?.writeText(globalThis.getSelection?.()?.toString() ?? '');
            break;
        case 'lock':
            blurActiveElement();
            system.lock();
            break;
        case 'restart':
            blurActiveElement();
            system.restart();
            break;
        case 'cleanUp':
            system.cleanUpDesktop();
            break;
        default:
            break;
    }
};
```

`src/store/system.js`: add `desktopCleanups: 0,` to `createInitialSystemState()`, and the action:

```js
    // Desktop icons animate back to their default spots whenever this bumps.
    cleanUpDesktop: () =>
      set((state) => {
        state.desktopCleanups += 1;
      }),
```

`src/constants/apps.js`: add before the `trash` entry:

```js
    {
        id: 'about',
        title: 'About This Mac',
        icon: '/images/logo.svg',
        placement: [],
        defaultBounds: { x: 560, y: 140, w: 480, h: 340 },
        minSize: { w: 400, h: 300 },
    },
```

`src/constants/index.js`: extend `profile`:

```js
// Shown on the lock screen and in About This Mac. Put a photo in public/images
// and set `avatar` to its path; set `role`/`location` to show those lines
// (left out while null).
const profile = {
    name: "Debaditya Barman",
    avatar: null,
    role: null,
    location: null,
};
```

(Replace the existing `profile` block and its comment.)

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test`
Expected: PASS — 17 files, 166 tests (142 + 14 menus + 9 actions + 1 profile; the apps test edit adds none).

- [ ] **Step 5: Commit**

```bash
git add src/lib/menus.js src/lib/menus.test.js src/lib/menuActions.js src/lib/menuActions.test.js src/lib/profile.js src/lib/profile.test.js src/store/system.js src/constants/apps.js src/constants/apps.test.js src/constants/index.js
git commit -m "feat: menu bar model, menu actions and About registry entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Menu bar and About This Mac

**Files:**
- Create: `src/components/menubar/Menu.jsx`, `src/windows/AboutThisMac.jsx`
- Rewrite: `src/components/Navbar.jsx`
- Modify: `src/windows/index.js`, `src/App.jsx`, `src/windows/Browser.jsx`, `src/components/Welcome.jsx`, `src/components/system/LockScreen.jsx`, `src/index.css`, `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1's `buildMenuBar`, `runMenuAction`, `initialsOf`, `profile.role/location`, registry `about`; `useProjects`, `favoritesFromProjects`; `getPlatform`, `isMacPlatform`.
- Produces: `<Menu items onSelect className? style? menuRef? />` (reused by Task 3); `openWindow('safari', { newTab: true })` opens a Favorites tab.

- [ ] **Step 1: `src/components/menubar/Menu.jsx`**

```jsx
// Renders any menu item list (menu bar dropdowns, the desktop context menu).
const Menu = ({ items, onSelect, className = '', style, menuRef }) => (
    <ul ref={menuRef} className={`menu ${className}`} role="menu" style={style}>
        {items.map((item, index) => (item.separator ? (
            <li key={`separator-${index}`} className="menu-separator" role="separator" />
        ) : (
            <li key={item.label} role="none">
                <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    disabled={item.disabled}
                    onClick={() => onSelect(item)}
                >
                    <span className="menu-check" aria-hidden="true">{item.checked ? '✓' : ''}</span>
                    <span className="menu-label">{item.label}</span>
                    {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                </button>
            </li>
        )))}
    </ul>
);

export default Menu;
```

- [ ] **Step 2: Rewrite `src/components/Navbar.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'

import { navIcons } from '@constants'
import Menu from './menubar/Menu'
import useClock from '../hooks/useClock'
import { buildMenuBar } from '../lib/menus'
import { runMenuAction } from '../lib/menuActions'
import { getPlatform, isMacPlatform } from '../lib/shortcuts'
import useWindowStore from '../store/window'

const isMac = isMacPlatform(getPlatform())

const Navbar = () => {
  const now = useClock()
  const navRef = useRef(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [hasSelection, setHasSelection] = useState(false)
  const focusedId = useWindowStore((state) => state.focusedId)
  const windows = useWindowStore((state) => state.windows)

  const menuBar = buildMenuBar({ focusedId, windows, isMac, hasSelection })

  // Close on a press outside the menu bar, Esc, or leaving the page.
  useEffect(() => {
    if (!openMenu) return undefined

    const close = () => setOpenMenu(null)
    const handlePointerDown = (event) => {
      if (!navRef.current?.contains(event.target)) close()
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', close)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', close)
    }
  }, [openMenu])

  const toggle = (id) => {
    setHasSelection(Boolean(window.getSelection()?.toString()))
    setOpenMenu((current) => (current === id ? null : id))
  }

  // Like macOS: once a menu is open, hovering another title switches to it.
  const hover = (id) => {
    if (openMenu && openMenu !== id) setOpenMenu(id)
  }

  const select = (item) => {
    setOpenMenu(null)
    if (item.action) runMenuAction(item.action)
  }

  const renderMenu = (id, title, items, titleClassName = '') => (
    <li key={id} className="menubar-item">
      <button
        type="button"
        className={`menubar-title ${titleClassName}${openMenu === id ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={openMenu === id}
        onClick={() => toggle(id)}
        onPointerEnter={() => hover(id)}
      >
        {title}
      </button>
      {openMenu === id && <Menu items={items} onSelect={select} />}
    </li>
  )

  return (
    <nav ref={navRef}>
      <div>
        <ul className="menubar">
          {renderMenu('apple', <img src="/images/logo.svg" alt="Apple menu" className="invert size-4" />, menuBar.apple)}
          {menuBar.menus.map((menu) => renderMenu(menu.id, menu.title, menu.items, menu.bold ? 'font-bold' : ''))}
        </ul>
      </div>
      <div>
        <ul>
          {navIcons.map(({ id, img }) => (
            <li key={id}>
              <img className="icon-hover invert" src={img} alt={`icon-${id}`} />
            </li>
          ))}
        </ul>
        <time>{dayjs(now).format("ddd MMM D h:mm A")}</time>
      </div>
    </nav>
  )
}

export default Navbar
```

(`navLinks` is no longer used by the Navbar; leave the constant in place.)

- [ ] **Step 3: About This Mac** — `src/windows/AboutThisMac.jsx`:

```jsx
import { profile } from '../constants';
import WindowControls from '../components/WindowControl';
import WindowWrapper from '../hoc/WindowWrapper';
import useProjects from '../hooks/useProjects';
import { favoritesFromProjects } from '../lib/browser';
import { initialsOf } from '../lib/profile';
import useWindowStore from '../store/window';

// macOS-style "About This Mac", where the specs are the portfolio's owner.
// Only real data is shown: role/location lines appear once set in constants.
const AboutThisMac = () => {
    const openWindow = useWindowStore((state) => state.openWindow);
    const { projects, loading } = useProjects();
    const live = favoritesFromProjects(projects).length;

    return (
        <div className="about">
            <div className="about-titlebar" data-titlebar>
                <WindowControls target="about" />
            </div>

            <div className="about-body">
                <div className="about-avatar">
                    {profile.avatar ? <img src={profile.avatar} alt="" /> : initialsOf(profile.name)}
                </div>

                <div className="about-details">
                    <h2 className="about-name">{profile.name}</h2>
                    {profile.role && <p className="about-role">{profile.role}</p>}

                    <dl className="about-specs">
                        {profile.location && (
                            <>
                                <dt>Location</dt>
                                <dd>{profile.location}</dd>
                            </>
                        )}
                        <dt>Projects</dt>
                        <dd>{loading ? '…' : `${projects.length} (${live} live)`}</dd>
                    </dl>

                    <div className="about-actions">
                        <button type="button" onClick={() => openWindow('resume')}>Resume</button>
                        <button type="button" onClick={() => openWindow('contact')}>Contact</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AboutWindow = WindowWrapper(AboutThisMac, 'about');
export default AboutWindow;
```

`src/windows/index.js`: import `AboutThisMac from "./AboutThisMac"` and add it to the export list. `src/App.jsx`: import `AboutThisMac` from `"@windows"` with the others and render `<AboutThisMac />` after `<Browser />`.

- [ ] **Step 4: Small follow-ups**

`src/windows/Browser.jsx` — at the top of the `request` effect body, before the URL logic, add:

```js
        // File → New Tab
        if (request?.newTab) {
            dispatch({ type: 'newTab' });
            return;
        }
```

`src/components/Welcome.jsx` — in the entrance `useGSAP`, inside the `if (bootPhase !== 'desktop')` branch, call `gsap.killTweensOf(letters)` before the `gsap.set(...)`, with the comment `// Restart/Lock can come mid-entrance: stop it so the letters really hide.`

`src/components/system/LockScreen.jsx` — delete its local `initials` helper, import `{ initialsOf } from '../../lib/profile'`, and use `initialsOf(profile.name)`.

- [ ] **Step 5: Styles** — append to `src/index.css` (outside every layer):

```css
/* Menu bar: above windows (z 1000+), below the hot corner (100001). */
nav {
  position: relative;
  z-index: 100000;
}
.menubar {
  gap: 2px !important;
}
.menubar-item {
  position: relative;
}
.menubar-title {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 5px;
  font-size: 13px;
  color: rgb(255 255 255 / 0.92);
  cursor: default;
}
.menubar-title.is-open {
  background: rgb(255 255 255 / 0.2);
}

/* Shared menu (dropdowns and the desktop context menu). The `nav ul` base
   styles would otherwise lay it out as a row. */
.menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  display: block !important;
  min-width: 220px;
  padding: 5px;
  border-radius: 8px;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(36 36 36 / 0.9);
  backdrop-filter: blur(24px);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
  font-size: 13px;
  color: white;
  text-align: left;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 3px 10px 3px 4px;
  border-radius: 4px;
  white-space: nowrap;
  cursor: default;
}
.menu-item:hover:not(:disabled) {
  background: #2f6fe5;
}
.menu-item:disabled {
  color: rgb(255 255 255 / 0.4);
}
.menu-check {
  width: 14px;
  text-align: center;
}
.menu-shortcut {
  margin-left: auto;
  padding-left: 24px;
  color: rgb(255 255 255 / 0.55);
}
.menu-item:hover:not(:disabled) .menu-shortcut {
  color: white;
}
.menu-separator {
  height: 1px;
  margin: 4px 6px;
  background: rgb(255 255 255 / 0.14);
}

/* About This Mac */
.about {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border-radius: 0.75rem;
  background: #262626;
  color: #e5e5e5;
  box-shadow: 0 25px 50px rgb(0 0 0 / 0.5);
}
.about-titlebar {
  display: flex;
  padding: 12px 14px;
}
.about-body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 8px 36px 28px;
}
.about-avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  overflow: hidden;
  border-radius: 9999px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  font-size: 40px;
  font-weight: 700;
}
.about-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.about-name {
  font-size: 26px;
  font-weight: 700;
}
.about-role {
  margin-top: 2px;
  color: #a3a3a3;
}
.about-specs {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 14px;
  margin-top: 16px;
  font-size: 13px;
}
.about-specs dt {
  font-weight: 600;
  text-align: right;
}
.about-specs dd {
  color: #c4c4c4;
}
.about-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.about-actions button {
  padding: 4px 14px;
  border-radius: 6px;
  background: #3a3a3a;
  font-size: 13px;
}
.about-actions button:hover {
  background: #4a4a4a;
}
```

- [ ] **Step 6: Document** — in `CLAUDE.md`, after the Safari bullet, add:

```markdown
- **Menus are data.** `buildMenuBar()` (`src/lib/menus.js`) derives the Apple/app/File/Edit/Window/Go/Help menus from window state; items carry plain action objects that `runMenuAction()` (`src/lib/menuActions.js`) performs. Only shortcuts that really work on the visitor's platform are shown. `components/menubar/Menu.jsx` renders any item list (also used by the desktop context menu). The `nav` sits at z-index 100000 so dropdowns cover windows; the hot corner (100001) stays above it.
```

- [ ] **Step 7: Verify**

Run: `npm test` — Expected: PASS, 166 tests.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: `✖ 10 problems (10 errors, 0 warnings)`.
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

In Chrome:
- The menu bar reads: Apple logo, bold "DevBarman's Portfolio", File, Edit, Window, Go, Help; with a window focused, the bold title is its name.
- Clicking a title opens its dropdown above any window; hovering another title switches menus; clicking outside, Esc, and leaving the page close it.
- Every item works: About This Mac opens the window (initials, name, project count, Resume/Contact buttons); Restart… replays the boot; Lock Screen locks; File → Close Window and Window → Minimize/Zoom act on the focused window and are disabled with none; Safari's File → New Tab opens a Favorites tab; Window lists open windows with a ✓ on the focused one and switching works (incl. minimized); Go opens each app; Help → Contact Debaditya opens Contact; Edit → Copy copies selected text.
- With Safari's address bar focused, Apple → Lock Screen, then press a letter to unlock: the letter is not typed into the address bar.
- Restart within a second of unlocking: the welcome letters stay hidden until the next unlock.

- [ ] **Step 8: Commit**

```bash
git add src/components/menubar/Menu.jsx src/components/Navbar.jsx src/windows/AboutThisMac.jsx src/windows/index.js src/App.jsx src/windows/Browser.jsx src/components/Welcome.jsx src/components/system/LockScreen.jsx src/index.css CLAUDE.md
git commit -m "feat: working menu bar and About This Mac

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Desktop context menu and Clean Up

**Files:**
- Create: `src/components/system/DesktopContextMenu.jsx`
- Modify: `src/components/DesktopItem.jsx`, `src/App.jsx`, `src/index.css`, `CLAUDE.md`

**Interfaces:**
- Consumes: `Menu` (Task 2); `desktopMenuItems`, `clampMenuPosition`, `runMenuAction` (Task 1); `useSystemStore` `desktopCleanups`, `isDesktopPhase`; `getViewport`.

- [ ] **Step 1: `src/components/system/DesktopContextMenu.jsx`**

```jsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import Menu from '../menubar/Menu';
import { getViewport } from '../../lib/bounds';
import { clampMenuPosition, desktopMenuItems } from '../../lib/menus';
import { runMenuAction } from '../../lib/menuActions';
import useSystemStore, { isDesktopPhase } from '../../store/system';

// Everything that keeps the browser's own right-click menu.
const NATIVE_MENU_AREAS = '[data-window], nav, #dock, .menu, .mission-control, input, textarea, [contenteditable]';

// Right-click on the wallpaper or a desktop icon.
const DesktopContextMenu = () => {
    const [menu, setMenu] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleContextMenu = (event) => {
            if (!isDesktopPhase(useSystemStore.getState())) return;
            if (event.target.closest(NATIVE_MENU_AREAS)) return;

            event.preventDefault();

            const icon = event.target.closest('[data-desktop-item]');
            const items = icon
                ? [{ label: 'Open', action: { type: 'openApp', id: icon.dataset.desktopItem } }]
                : desktopMenuItems;

            setMenu({ x: event.clientX, y: event.clientY, items });
        };

        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    // Close on an outside press, Esc, scroll/resize, or leaving the page.
    useEffect(() => {
        if (!menu) return undefined;

        const close = () => setMenu(null);
        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) close();
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', close);
        window.addEventListener('blur', close);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', close);
            window.removeEventListener('blur', close);
        };
    }, [menu]);

    // Keep it on screen once its size is known.
    useLayoutEffect(() => {
        const element = menuRef.current;

        if (!menu || !element) return;

        const { x, y } = clampMenuPosition(
            { x: menu.x, y: menu.y },
            { w: element.offsetWidth, h: element.offsetHeight },
            getViewport()
        );

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    }, [menu]);

    if (!menu) return null;

    return (
        <Menu
            menuRef={menuRef}
            className="context-menu"
            style={{ left: menu.x, top: menu.y }}
            items={menu.items}
            onSelect={(item) => {
                setMenu(null);
                if (item.action) runMenuAction(item.action);
            }}
        />
    );
};

export default DesktopContextMenu;
```

- [ ] **Step 2: Desktop icons** — in `src/components/DesktopItem.jsx`:
- Import `useSystemStore from '../store/system';`.
- Keep the Draggable instance in a ref: add `const dragRef = useRef(null);`, set `dragRef.current = draggableInstance[0];` after creating it, and `dragRef.current = null;` in its cleanup.
- Add the Clean Up animation:

```js
    const cleanups = useSystemStore((state) => state.desktopCleanups);

    // Desktop → Clean Up: slide back to the default spot.
    useEffect(() => {
        const element = itemRef.current;

        if (cleanups === 0 || !element) return;

        gsap.to(element, {
            x: 0,
            y: 0,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => dragRef.current?.update(),
        });
    }, [cleanups]);
```

- Add `data-desktop-item={item.id}` to the root `<div>`.

- [ ] **Step 3: Mount and style** — in `src/App.jsx` import `DesktopContextMenu from "@components/system/DesktopContextMenu"` and render `<DesktopContextMenu />` after `<AppSwitcher />`. Append to `src/index.css`:

```css
.context-menu {
  position: fixed;
  top: auto;
  z-index: 150000;
}
```

- [ ] **Step 4: Document** — extend the CLAUDE.md "Menus are data" bullet with: `Right-click on the wallpaper or a desktop icon opens \`components/system/DesktopContextMenu.jsx\`; windows, inputs, the menu bar, the dock and Mission Control keep the browser's native menu.`

- [ ] **Step 5: Verify**

Run: `npm test` — Expected: PASS, 166 tests.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: `✖ 10 problems (10 errors, 0 warnings)`.
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

In Chrome:
- Right-click the wallpaper: Open Terminal / Clean Up / About This Mac at the pointer; each works.
- Drag two desktop icons away, then Clean Up: both slide back; they can still be dragged afterwards.
- Right-click a desktop icon: a single "Open" item opens that app.
- Right-click near the bottom-right corner: the menu stays fully on screen.
- Right-click inside a window, Safari's address bar, the menu bar, the dock, and in Mission Control: the browser's native menu appears instead.
- Esc, clicking elsewhere, and resizing close the menu. During the lock screen, right-click shows nothing custom.

- [ ] **Step 6: Commit**

```bash
git add src/components/system/DesktopContextMenu.jsx src/components/DesktopItem.jsx src/App.jsx src/index.css CLAUDE.md
git commit -m "feat: desktop right-click menu with Clean Up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
