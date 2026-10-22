# Phase 2 — Window Behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make windows behave like macOS: drag only by the title bar, resize from any edge or corner, maximize/restore with the green button or a title-bar double-click, minimize into a dock tile and restore, open/close/minimize animations, position remembered for the visit, and iframes that don't swallow drags.

**Architecture:** Window geometry (`bounds = { x, y, w, h }` in px) moves into the Zustand store and is applied as inline `left/top/width/height` on each window's `<section>`. Pure geometry helpers in `src/lib/bounds.js` (clamping, maximize area, edge resizing, animation transforms) carry the logic and are unit-tested; `WindowWrapper` wires them to GSAP Draggable (title bar, `type: 'top,left'`), pointer-event resize handles, and GSAP tweens on `transform` (free, since dragging no longer uses transforms).

**Tech Stack:** React 19, Zustand 5 + Immer, GSAP 3.14 (Draggable, tweens), lucide-react, Tailwind 4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md` — section 2 (Window behavior), build-order phase 2.

**Deliberate deviations from spec (each argued here):**
- *Resize handles use pointer events, not "each a GSAP Draggable".* A Draggable on a handle moves the handle itself (it would need a proxy element); pointer events with `setPointerCapture` write straight to the store's `bounds`, so nothing fights over the window's position — the concern behind rejecting `react-rnd`. GSAP stays the only animation library and the only window *dragger*.
- *Resize handles are hidden while a window is maximized.* Resizing a zoomed window would have to un-maximize it mid-gesture and would collide with the maximize tween. Restore first, then resize.
- *Dock "thumbnails" are app-icon tiles, not live window snapshots.* A real snapshot needs a DOM-to-canvas library and breaks on cross-origin iframes (Resume's PDF, the future browser).
- *Clicking inside an iframe doesn't focus its window.* Pointer events inside an iframe never reach the parent page; this is a browser limit. Clicking the title bar or any non-iframe area focuses as normal.

## Global Constraints

- GSAP is the only animation library and the only window-drag mechanism; no new runtime dependencies.
- Window ids stay stable so `#id` selectors in `src/index.css` keep matching.
- Position memory lasts for the visit only — no `localStorage`/`sessionStorage`.
- Vitest covers pure logic only (registry, store, `src/lib/`); UI is verified with `npm run dev`. Never import a window component or `src/lib/firebase.js` from a test.
- `npm run lint` must not exceed the 10-error baseline (`✖ 10 problems (10 errors, 0 warnings)`), and must add no warnings.
- Never edit or commit AppleDouble `._*` files.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Branch: `feature/window-behavior`.

## Review Focus

1. Clicking a window's body (not its title bar) must still bring it to the front, and clicking an already-front window must not keep bumping z-index (pinned in Task 2: `focusWindow` no-op when already focused).
2. Shrinking the browser window must leave every window reachable and keep maximized windows filling the new space (pinned in Task 2: `fitToViewport`).
3. Clicking the desktop icon (or menu-bar link) of a minimized app must restore it, not leave it hidden (pinned in Task 2: `openWindow` on a minimized window).
4. Closing a maximized window and reopening it after the browser was resized must come back maximized to the *current* screen, not the old size (pinned in Task 2).
5. Resizing from the top edge into the menu bar must stop at the menu bar without the bottom edge jumping (pinned in Task 1: `resizeBounds` north clamp).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/bounds.js` (create) | Layout constants, `getViewport`, `clampBounds`, `maximizedBounds`, `resizeBounds`, `toRect`, `transformToRect` |
| `src/lib/bounds.test.js` (create) | Geometry tests |
| `src/constants/apps.js` (modify) | `defaultBounds`/`minSize` per windowed app; richer `buildWindowConfig` entries |
| `src/constants/apps.test.js` (modify) | New entry shape; size invariants |
| `src/store/window.js` (rewrite) | Bounds lifecycle, minimize/restore, maximize, `fitToViewport`, `minimizedStack` |
| `src/store/window.test.js` (rewrite) | Store behavior incl. Review Focus 1–4 |
| `src/hoc/WindowWrapper.jsx` (rewrite) | Title-bar drag, resize handles, double-click zoom, bounds styling, animations |
| `src/components/WindowControl.jsx` (rewrite) | Working traffic lights with hover glyphs |
| `src/components/Dock.jsx` (modify) | Restore action, running dots, divider, minimized tiles, origin rects |
| `src/components/DesktopItem.jsx` (modify) | Passes origin rect to `openWindow` |
| `src/lib/dock.js` / `dock.test.js` (modify) | `'restore'` action |
| `src/windows/{Finder,Terminal,Contact,Resume}.jsx` (modify) | `data-titlebar` header; content fills the window |
| `src/App.jsx` (modify) | Re-fit windows on browser resize |
| `src/index.css` (modify) | Drop fixed window positions; traffic-light, resize-handle, dock-tile and drag-guard styles |
| `CLAUDE.md`, `AGENTS.md` (modify) | Window contract (`data-titlebar`, fill sizing, registry sizes) |

---

### Task 1: Window geometry helpers

**Files:**
- Create: `src/lib/bounds.js`, `src/lib/bounds.test.js`

**Interfaces:**
- Produces:
  - `MENU_BAR_HEIGHT = 40`, `DOCK_RESERVE = 96`, `TITLE_BAR_HEIGHT = 44`, `MIN_VISIBLE = 80` (px)
  - `getViewport() => { width: number, height: number }` (falls back to 1440×900 outside a browser)
  - `clampBounds(bounds, minSize, viewport) => bounds` — `bounds = { x, y, w, h }`, `minSize = { w, h }`
  - `maximizedBounds(viewport) => bounds`
  - `resizeBounds(start: bounds, edge: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw', dx: number, dy: number, minSize) => bounds`
  - `toRect(domRect: { left, top, width, height }) => bounds`
  - `transformToRect(from: bounds, to: bounds) => { x, y, scaleX, scaleY }` (GSAP transform values, `transformOrigin: '0 0'`)

- [ ] **Step 1: Write the failing tests** — `src/lib/bounds.test.js`

```js
import { describe, it, expect, afterEach } from 'vitest';
import {
    MENU_BAR_HEIGHT, DOCK_RESERVE, TITLE_BAR_HEIGHT, MIN_VISIBLE,
    getViewport, clampBounds, maximizedBounds, resizeBounds, toRect, transformToRect,
} from './bounds';

const viewport = { width: 1440, height: 900 };
const minSize = { w: 300, h: 200 };

describe('getViewport', () => {
    afterEach(() => {
        delete globalThis.innerWidth;
        delete globalThis.innerHeight;
    });

    it('reads the window size', () => {
        globalThis.innerWidth = 1280;
        globalThis.innerHeight = 720;
        expect(getViewport()).toEqual({ width: 1280, height: 720 });
    });

    it('falls back to 1440x900 outside a browser', () => {
        expect(getViewport()).toEqual({ width: 1440, height: 900 });
    });
});

describe('clampBounds', () => {
    it('leaves in-range bounds alone', () => {
        const b = { x: 100, y: 100, w: 500, h: 400 };
        expect(clampBounds(b, minSize, viewport)).toEqual(b);
    });

    it('grows to the minimum size', () => {
        expect(clampBounds({ x: 10, y: 100, w: 100, h: 100 }, minSize, viewport))
            .toEqual({ x: 10, y: 100, w: 300, h: 200 });
    });

    it('shrinks to fit the screen below the menu bar', () => {
        expect(clampBounds({ x: 0, y: MENU_BAR_HEIGHT, w: 2000, h: 2000 }, minSize, viewport))
            .toEqual({ x: 0, y: MENU_BAR_HEIGHT, w: 1440, h: 900 - MENU_BAR_HEIGHT });
    });

    it('keeps at least MIN_VISIBLE px on screen horizontally', () => {
        expect(clampBounds({ x: -1000, y: 100, w: 500, h: 300 }, minSize, viewport).x).toBe(MIN_VISIBLE - 500);
        expect(clampBounds({ x: 5000, y: 100, w: 500, h: 300 }, minSize, viewport).x).toBe(1440 - MIN_VISIBLE);
    });

    it('keeps the title bar between the menu bar and the bottom edge', () => {
        expect(clampBounds({ x: 100, y: 0, w: 500, h: 300 }, minSize, viewport).y).toBe(MENU_BAR_HEIGHT);
        expect(clampBounds({ x: 100, y: 2000, w: 500, h: 300 }, minSize, viewport).y).toBe(900 - TITLE_BAR_HEIGHT);
    });
});

describe('maximizedBounds', () => {
    it('fills the space between the menu bar and the dock', () => {
        expect(maximizedBounds(viewport)).toEqual({
            x: 0, y: MENU_BAR_HEIGHT, w: 1440, h: 900 - MENU_BAR_HEIGHT - DOCK_RESERVE,
        });
    });

    it('never goes shorter than a title bar on tiny screens', () => {
        expect(maximizedBounds({ width: 400, height: 100 }).h).toBe(TITLE_BAR_HEIGHT);
    });
});

describe('resizeBounds', () => {
    const start = { x: 100, y: 100, w: 400, h: 300 };

    it('grows from the east edge', () => {
        expect(resizeBounds(start, 'e', 50, 999, minSize)).toEqual({ x: 100, y: 100, w: 450, h: 300 });
    });

    it('grows from the south edge', () => {
        expect(resizeBounds(start, 's', 999, 40, minSize)).toEqual({ x: 100, y: 100, w: 400, h: 340 });
    });

    it('moves the left edge and keeps the right edge fixed', () => {
        expect(resizeBounds(start, 'w', -20, 0, minSize)).toEqual({ x: 80, y: 100, w: 420, h: 300 });
    });

    it('stops the west edge at the minimum width without moving the right edge', () => {
        expect(resizeBounds(start, 'w', 200, 0, minSize)).toEqual({ x: 200, y: 100, w: 300, h: 300 });
    });

    it('resizes both axes from a corner', () => {
        expect(resizeBounds(start, 'nw', -20, -30, minSize)).toEqual({ x: 80, y: 70, w: 420, h: 330 });
    });

    it('stops the north edge at the menu bar without moving the bottom edge', () => {
        const nearTop = { x: 100, y: 60, w: 400, h: 300 };
        expect(resizeBounds(nearTop, 'n', 0, -50, minSize))
            .toEqual({ x: 100, y: MENU_BAR_HEIGHT, w: 400, h: 320 });
    });
});

describe('toRect', () => {
    it('converts a DOMRect-like object', () => {
        expect(toRect({ left: 1, top: 2, width: 3, height: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    });
});

describe('transformToRect', () => {
    it('maps a window onto a target rect from its top-left corner', () => {
        expect(transformToRect({ x: 100, y: 100, w: 400, h: 300 }, { x: 600, y: 850, w: 48, h: 48 }))
            .toEqual({ x: 500, y: 750, scaleX: 0.12, scaleY: 0.16 });
    });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/lib/bounds.test.js`
Expected: FAIL — `Cannot find module './bounds'`.

- [ ] **Step 3: Implement** — `src/lib/bounds.js`

```js
// Window geometry. Bounds are { x, y, w, h } in viewport px; x/y are the
// window's left/top.

export const MENU_BAR_HEIGHT = 40;
export const DOCK_RESERVE = 96;
export const TITLE_BAR_HEIGHT = 44;
export const MIN_VISIBLE = 80;

export const getViewport = () => ({
    width: globalThis.innerWidth || 1440,
    height: globalThis.innerHeight || 900,
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Respect the app's minimum size, never exceed the screen, keep the title bar
// below the menu bar and above the bottom edge, and keep MIN_VISIBLE px of the
// window on screen horizontally so it can always be grabbed again.
export const clampBounds = ({ x, y, w, h }, minSize, viewport) => {
    const width = Math.min(Math.max(w, minSize.w), viewport.width);
    const height = Math.min(Math.max(h, minSize.h), viewport.height - MENU_BAR_HEIGHT);

    return {
        x: clamp(x, MIN_VISIBLE - width, viewport.width - MIN_VISIBLE),
        y: clamp(y, MENU_BAR_HEIGHT, viewport.height - TITLE_BAR_HEIGHT),
        w: width,
        h: height,
    };
};

export const maximizedBounds = (viewport) => ({
    x: 0,
    y: MENU_BAR_HEIGHT,
    w: viewport.width,
    h: Math.max(viewport.height - MENU_BAR_HEIGHT - DOCK_RESERVE, TITLE_BAR_HEIGHT),
});

// Bounds after dragging `edge` by (dx, dy) from `start`. Edges that move the
// left/top side keep the opposite side fixed when the minimum size kicks in.
export const resizeBounds = (start, edge, dx, dy, minSize) => {
    let { x, y, w, h } = start;

    if (edge.includes('e')) w = Math.max(start.w + dx, minSize.w);
    if (edge.includes('s')) h = Math.max(start.h + dy, minSize.h);

    if (edge.includes('w')) {
        w = Math.max(start.w - dx, minSize.w);
        x = start.x + start.w - w;
    }

    if (edge.includes('n')) {
        h = Math.max(start.h - dy, minSize.h);
        y = start.y + start.h - h;

        if (y < MENU_BAR_HEIGHT) {
            h -= MENU_BAR_HEIGHT - y;
            y = MENU_BAR_HEIGHT;
        }
    }

    return { x, y, w, h };
};

export const toRect = ({ left, top, width, height }) => ({ x: left, y: top, w: width, h: height });

// GSAP transform that makes a window at `from` cover the rect `to`
// (use with transformOrigin '0 0').
export const transformToRect = (from, to) => ({
    x: to.x - from.x,
    y: to.y - from.y,
    scaleX: to.w / from.w,
    scaleY: to.h / from.h,
});
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test -- src/lib/bounds.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bounds.js src/lib/bounds.test.js
git commit -m "feat: add window geometry helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Registry sizes + window store geometry, minimize and maximize

**Files:**
- Modify: `src/constants/apps.js`, `src/constants/apps.test.js`, `src/lib/dock.js`, `src/lib/dock.test.js`
- Rewrite: `src/store/window.js`, `src/store/window.test.js`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces:
  - Registry: every windowed app has `defaultBounds: { x, y, w, h }` and `minSize: { w, h }`.
  - `buildWindowConfig()` entries: `{ isOpen: false, zIndex: INITIAL_Z_INDEX, data: null, isMinimized: false, isMaximized: false, bounds: null, prevBounds: null, originRect: null }`
  - Store state: `windows`, `nextZIndex`, `focusedId: string | null`, `minimizedStack: string[]` (oldest first)
  - `openWindow(key, data = null, originRect = null)` — opens (or un-minimizes), resolves `bounds` (remembered → default, clamped; maximized → current maximize area), raises, focuses, stores `originRect`
  - `closeWindow(key)` — hides, resets `zIndex`/`data`/`isMinimized`/`originRect`, **keeps** `bounds` and `isMaximized`; focus hand-off to topmost visible window
  - `focusWindow(key)` — raises an open, non-minimized window; no-op if it is already focused
  - `minimizeWindow(key)` — hides an open window into `minimizedStack`; focus hand-off
  - `restoreWindow(key, originRect = null)` — un-minimizes, raises, focuses, stores `originRect`
  - `toggleMaximize(key)` — open windows only; maximize saves `prevBounds`, restore puts them back (clamped)
  - `setBounds(key, bounds)` — stores bounds clamped to the app's `minSize` and the viewport
  - `fitToViewport()` — re-clamps every window with bounds; maximized windows refit to the maximize area
  - `getDockAction(windowState) => 'none' | 'open' | 'restore' | 'focus'`

- [ ] **Step 1: Update the registry test** — in `src/constants/apps.test.js`, replace the test `'builds a closed window entry for every windowed app only'` with:

```js
    it('builds a closed window entry for every windowed app only', () => {
        const config = buildWindowConfig();
        expect(Object.keys(config).sort()).toEqual(['contact', 'finder', 'resume', 'terminal']);
        expect(config.finder).toEqual({
            isOpen: false, zIndex: INITIAL_Z_INDEX, data: null,
            isMinimized: false, isMaximized: false, bounds: null, prevBounds: null, originRect: null,
        });
    });

    it('gives every windowed app a default size at least its minimum size', () => {
        APPS.filter((a) => a.hasWindow !== false).forEach((a) => {
            expect(a.defaultBounds, a.id).toEqual({
                x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number),
            });
            expect(a.minSize, a.id).toEqual({ w: expect.any(Number), h: expect.any(Number) });
            expect(a.defaultBounds.w, a.id).toBeGreaterThanOrEqual(a.minSize.w);
            expect(a.defaultBounds.h, a.id).toBeGreaterThanOrEqual(a.minSize.h);
        });
    });
```

- [ ] **Step 2: Update the dock test** — in `src/lib/dock.test.js`, add inside the `describe`:

```js
    it('restores a minimized window', () => {
        expect(getDockAction({ isOpen: true, isMinimized: true })).toBe('restore');
    });
```

- [ ] **Step 3: Rewrite the store test** — `src/store/window.test.js`

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import useWindowStore, { createInitialWindowState } from './window';
import { INITIAL_Z_INDEX } from '../constants/apps';
import { MENU_BAR_HEIGHT, maximizedBounds } from '../lib/bounds';

const store = () => useWindowStore.getState();
const setViewport = (width, height) => {
    globalThis.innerWidth = width;
    globalThis.innerHeight = height;
};

beforeEach(() => {
    setViewport(1440, 900);
    useWindowStore.setState(createInitialWindowState());
});

afterEach(() => {
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
});

describe('opening, focus and closing', () => {
    it('starts with every window closed and nothing focused', () => {
        expect(store().focusedId).toBeNull();
        expect(store().minimizedStack).toEqual([]);
        Object.values(store().windows).forEach((w) => expect(w.isOpen).toBe(false));
    });

    it('opens a window on top and focuses it', () => {
        store().openWindow('finder', { folder: 'projects' });
        expect(store().windows.finder).toMatchObject({
            isOpen: true, zIndex: INITIAL_Z_INDEX + 1, data: { folder: 'projects' },
        });
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

    it('does not bump z-index when the window is already focused', () => {
        store().openWindow('finder');
        const z = store().windows.finder.zIndex;
        const next = store().nextZIndex;
        store().focusWindow('finder');
        expect(store().windows.finder.zIndex).toBe(z);
        expect(store().nextZIndex).toBe(next);
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
        expect(store().windows.terminal).toMatchObject({ isOpen: false, zIndex: INITIAL_Z_INDEX, data: null });
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
        store().minimizeWindow('safari');
        store().restoreWindow('safari');
        store().toggleMaximize('safari');
        store().setBounds('safari', { x: 0, y: 0, w: 1, h: 1 });
        expect(store().windows).toEqual(before.windows);
        expect(store().nextZIndex).toBe(before.nextZIndex);
    });
});

describe('bounds', () => {
    it('opens at the default bounds', () => {
        store().openWindow('finder');
        expect(store().windows.finder.bounds).toEqual({ x: 128, y: 80, w: 760, h: 444 });
    });

    it('fits the default bounds to a small screen', () => {
        setViewport(800, 600);
        store().openWindow('resume');
        expect(store().windows.resume.bounds).toEqual({ x: 700, y: 64, w: 700, h: 560 });
    });

    it('records where the window was launched from', () => {
        const rect = { x: 20, y: 60, w: 96, h: 80 };
        store().openWindow('finder', null, rect);
        expect(store().windows.finder.originRect).toEqual(rect);
    });

    it('clamps new bounds to the minimum size and below the menu bar', () => {
        store().openWindow('finder');
        store().setBounds('finder', { x: 0, y: 0, w: 10, h: 10 });
        expect(store().windows.finder.bounds).toEqual({ x: 0, y: MENU_BAR_HEIGHT, w: 520, h: 320 });
    });

    it('reopens a window where it was left', () => {
        store().openWindow('finder');
        store().setBounds('finder', { x: 300, y: 200, w: 600, h: 400 });
        store().closeWindow('finder');
        store().openWindow('finder');
        expect(store().windows.finder.bounds).toEqual({ x: 300, y: 200, w: 600, h: 400 });
    });

    it('keeps every window reachable when the screen shrinks', () => {
        store().openWindow('finder');
        store().setBounds('finder', { x: 1200, y: 700, w: 600, h: 400 });
        setViewport(1000, 700);
        store().fitToViewport();
        expect(store().windows.finder.bounds).toEqual({ x: 920, y: 656, w: 600, h: 400 });
    });
});

describe('minimize and restore', () => {
    it('minimizes into the dock stack and hands focus on', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        store().minimizeWindow('terminal');
        expect(store().windows.terminal).toMatchObject({ isOpen: true, isMinimized: true });
        expect(store().minimizedStack).toEqual(['terminal']);
        expect(store().focusedId).toBe('finder');
    });

    it('ignores minimizing a closed or already-minimized window', () => {
        store().minimizeWindow('finder');
        expect(store().windows.finder.isMinimized).toBe(false);
        store().openWindow('finder');
        store().minimizeWindow('finder');
        store().minimizeWindow('finder');
        expect(store().minimizedStack).toEqual(['finder']);
    });

    it('does not focus a minimized window', () => {
        store().openWindow('finder');
        store().minimizeWindow('finder');
        store().focusWindow('finder');
        expect(store().focusedId).toBeNull();
    });

    it('restores a minimized window on top', () => {
        const rect = { x: 900, y: 840, w: 56, h: 56 };
        store().openWindow('finder');
        store().openWindow('terminal');
        store().minimizeWindow('finder');
        store().restoreWindow('finder', rect);
        expect(store().windows.finder).toMatchObject({ isMinimized: false, originRect: rect });
        expect(store().windows.finder.zIndex).toBeGreaterThan(store().windows.terminal.zIndex);
        expect(store().minimizedStack).toEqual([]);
        expect(store().focusedId).toBe('finder');
    });

    it('restores a minimized window when it is opened again', () => {
        store().openWindow('resume');
        store().minimizeWindow('resume');
        store().openWindow('resume');
        expect(store().windows.resume.isMinimized).toBe(false);
        expect(store().minimizedStack).toEqual([]);
        expect(store().focusedId).toBe('resume');
    });

    it('drops a minimized window from the dock when it is closed', () => {
        store().openWindow('finder');
        store().minimizeWindow('finder');
        store().closeWindow('finder');
        expect(store().minimizedStack).toEqual([]);
        expect(store().windows.finder.isMinimized).toBe(false);
    });
});

describe('maximize', () => {
    it('fills the screen and restores the previous bounds', () => {
        store().openWindow('finder');
        store().toggleMaximize('finder');
        expect(store().windows.finder).toMatchObject({
            isMaximized: true,
            bounds: maximizedBounds({ width: 1440, height: 900 }),
            prevBounds: { x: 128, y: 80, w: 760, h: 444 },
        });
        store().toggleMaximize('finder');
        expect(store().windows.finder).toMatchObject({
            isMaximized: false, bounds: { x: 128, y: 80, w: 760, h: 444 }, prevBounds: null,
        });
    });

    it('ignores closed windows', () => {
        store().toggleMaximize('finder');
        expect(store().windows.finder.isMaximized).toBe(false);
    });

    it('reopens a closed maximized window maximized to the current screen', () => {
        store().openWindow('finder');
        store().toggleMaximize('finder');
        store().closeWindow('finder');
        setViewport(1000, 700);
        store().openWindow('finder');
        expect(store().windows.finder).toMatchObject({
            isMaximized: true, bounds: maximizedBounds({ width: 1000, height: 700 }),
        });
    });

    it('refits maximized windows when the screen changes', () => {
        store().openWindow('finder');
        store().toggleMaximize('finder');
        setViewport(1000, 700);
        store().fitToViewport();
        expect(store().windows.finder.bounds).toEqual(maximizedBounds({ width: 1000, height: 700 }));
    });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npm test`
Expected: FAIL — the new registry, dock and store tests fail (e.g. `defaultBounds` undefined, `store().minimizeWindow is not a function`); the untouched Phase 1 tests still pass.

- [ ] **Step 5: Add sizes to the registry** — in `src/constants/apps.js`, add these two keys to each windowed entry (after `placement` / `desktopPosition`):

```js
    // finder
        defaultBounds: { x: 128, y: 80, w: 760, h: 444 },
        minSize: { w: 520, h: 320 },
    // contact
        defaultBounds: { x: 448, y: 160, w: 600, h: 350 },
        minSize: { w: 420, h: 300 },
    // terminal
        defaultBounds: { x: 64, y: 96, w: 480, h: 400 },
        minSize: { w: 360, h: 240 },
    // resume
        defaultBounds: { x: 700, y: 64, w: 700, h: 600 },
        minSize: { w: 400, h: 360 },
```

and replace `buildWindowConfig` with:

```js
export const buildWindowConfig = (apps = APPS) =>
    Object.fromEntries(
        apps
            .filter(hasWindow)
            .map((app) => [app.id, {
                isOpen: false,
                zIndex: INITIAL_Z_INDEX,
                data: null,
                isMinimized: false,
                isMaximized: false,
                bounds: null,
                prevBounds: null,
                originRect: null,
            }])
    );
```

Also extend the file's header comment with: `// defaultBounds/minSize are px; the store clamps them to the screen.`

- [ ] **Step 6: Add the restore action** — `src/lib/dock.js`

```js
// What a dock icon click should do, given that app's window state
// (undefined when the app has no window, e.g. Archive).
export const getDockAction = (windowState) => {
    if (!windowState) return 'none';
    if (!windowState.isOpen) return 'open';
    return windowState.isMinimized ? 'restore' : 'focus';
};
```

- [ ] **Step 7: Rewrite the store** — `src/store/window.js`

```js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { buildWindowConfig, getApp, INITIAL_Z_INDEX } from '../constants/apps';
import { clampBounds, getViewport, maximizedBounds } from '../lib/bounds';

export const createInitialWindowState = () => ({
  windows: buildWindowConfig(),
  nextZIndex: INITIAL_Z_INDEX + 1,
  focusedId: null,
  minimizedStack: [],
});

const isVisible = (window) => window.isOpen && !window.isMinimized;

const topmostVisibleWindow = (windows) => {
  let topId = null;
  let topZ = -Infinity;

  Object.entries(windows).forEach(([id, window]) => {
    if (isVisible(window) && window.zIndex > topZ) {
      topId = id;
      topZ = window.zIndex;
    }
  });

  return topId;
};

const fitBounds = (key, bounds) => clampBounds(bounds, getApp(key).minSize, getViewport());

const raise = (state, key) => {
  state.windows[key].zIndex = state.nextZIndex;
  state.nextZIndex++;
  state.focusedId = key;
};

const unminimize = (state, key) => {
  state.windows[key].isMinimized = false;
  state.minimizedStack = state.minimizedStack.filter((id) => id !== key);
};

const useWindowStore = create(
  immer((set) => ({
    ...createInitialWindowState(),

    openWindow: (key, data = null, originRect = null) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = true;
        window.data = data || window.data;
        window.originRect = originRect;
        window.bounds = window.isMaximized
          ? maximizedBounds(getViewport())
          : fitBounds(key, window.bounds ?? getApp(key).defaultBounds);

        unminimize(state, key);
        raise(state, key);
      }),

    closeWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = false;
        window.zIndex = INITIAL_Z_INDEX;
        window.data = null;
        window.originRect = null;
        unminimize(state, key);

        if (state.focusedId === key) {
          state.focusedId = topmostVisibleWindow(state.windows);
        }
      }),

    focusWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !isVisible(window) || state.focusedId === key) return;

        raise(state, key);
      }),

    minimizeWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !isVisible(window)) return;

        window.isMinimized = true;
        state.minimizedStack.push(key);

        if (state.focusedId === key) {
          state.focusedId = topmostVisibleWindow(state.windows);
        }
      }),

    restoreWindow: (key, originRect = null) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !window.isMinimized) return;

        window.originRect = originRect;
        unminimize(state, key);
        raise(state, key);
      }),

    toggleMaximize: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !window.isOpen) return;

        if (window.isMaximized) {
          window.bounds = fitBounds(key, window.prevBounds ?? getApp(key).defaultBounds);
          window.prevBounds = null;
          window.isMaximized = false;
        } else {
          window.prevBounds = window.bounds;
          window.bounds = maximizedBounds(getViewport());
          window.isMaximized = true;
        }
      }),

    setBounds: (key, bounds) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.bounds = fitBounds(key, bounds);
      }),

    fitToViewport: () =>
      set((state) => {
        Object.entries(state.windows).forEach(([key, window]) => {
          if (!window.bounds) return;

          window.bounds = window.isMaximized
            ? maximizedBounds(getViewport())
            : fitBounds(key, window.bounds);
        });
      }),
  }))
);

export default useWindowStore;
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS — 5 files: `apps` 9, `bounds` 17, `dock` 4, `time` 3, `window` 26 (59 tests).

- [ ] **Step 9: Commit**

```bash
git add src/constants/apps.js src/constants/apps.test.js src/lib/dock.js src/lib/dock.test.js src/store/window.js src/store/window.test.js
git commit -m "feat: track window bounds, minimize and maximize in the window store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Title-bar drag, resize handles, zoom and traffic lights

**Files:**
- Rewrite: `src/hoc/WindowWrapper.jsx`, `src/components/WindowControl.jsx`
- Modify: `src/windows/Finder.jsx`, `src/windows/Terminal.jsx`, `src/windows/Contact.jsx`, `src/windows/Resume.jsx`, `src/App.jsx`, `src/index.css`, `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes: store actions/state from Task 2; `resizeBounds` from Task 1; `getApp` (registry).
- Produces:
  - **Window component contract:** the header element carries `data-titlebar`; the window's root element fills the section (`flex-1 min-h-0 w-full`, or for Finder's fragment, its content row is `flex-1 min-h-0`).
  - `WindowWrapper(Component, key)` throws at import if `key` is not in the registry.
  - While a drag or resize is in progress, `document.body` has class `window-interacting` (iframes get `pointer-events: none`).
  - The visibility effect in `WindowWrapper` is the seam Task 4 replaces.

- [ ] **Step 1: Rewrite `src/hoc/WindowWrapper.jsx`**

```jsx
import { useLayoutEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';

import { getApp } from '../constants/apps';
import { resizeBounds } from '../lib/bounds';
import useWindowStore from '../store/window';

const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const INTERACTIVE = 'button, a, input, textarea, select';

// While a window is dragged or resized, iframes would otherwise swallow the
// pointer and the gesture "sticks" (see .window-interacting in index.css).
const setInteracting = (active) => document.body.classList.toggle('window-interacting', active);

const WindowWrapper = (WrappedComponent, windowKey) => {
    const app = getApp(windowKey);

    if (!app) {
        throw new Error(`WindowWrapper: "${windowKey}" is not in the app registry (src/constants/apps.js)`);
    }

    const Wrapped = (props) => {
        const windowRef = useRef(null);
        const dragRef = useRef(null);
        const wasVisibleRef = useRef(false);

        const windowState = useWindowStore((state) => state.windows[windowKey]);
        const focusWindow = useWindowStore((state) => state.focusWindow);
        const setBounds = useWindowStore((state) => state.setBounds);
        const toggleMaximize = useWindowStore((state) => state.toggleMaximize);

        const { isOpen, isMinimized, isMaximized, zIndex, bounds } = windowState;
        const isVisible = isOpen && !isMinimized;

        // Show / hide. Task 4 replaces this with the full animation set.
        useLayoutEffect(() => {
            const element = windowRef.current;
            const wasVisible = wasVisibleRef.current;
            wasVisibleRef.current = isVisible;

            if (!element || isVisible === wasVisible) return;

            if (isVisible) {
                element.style.display = 'flex';
                gsap.fromTo(
                    element,
                    { scale: 0.8, opacity: 0, y: 40 },
                    { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
                );
            } else {
                element.style.display = 'none';
            }
        }, [isVisible]);

        // Keep Draggable in sync with store-driven geometry; no dragging while zoomed.
        useLayoutEffect(() => {
            const drag = dragRef.current;

            if (!drag) return;

            drag.update();

            if (isMaximized) drag.disable();
            else drag.enable();
        }, [bounds, isMaximized]);

        useGSAP(() => {
            const element = windowRef.current;

            if (!element) return;

            const titlebar = element.querySelector('[data-titlebar]');

            const [dragInstance] = Draggable.create(element, {
                type: 'top,left',
                trigger: titlebar ?? element,
                onDragStart: () => setInteracting(true),
                onDragEnd() {
                    setInteracting(false);

                    const current = useWindowStore.getState().windows[windowKey].bounds;
                    setBounds(windowKey, { ...current, x: this.x, y: this.y });
                },
            });

            dragRef.current = dragInstance;

            const handleDoubleClick = (event) => {
                if (event.target.closest(INTERACTIVE)) return;
                toggleMaximize(windowKey);
            };

            titlebar?.addEventListener('dblclick', handleDoubleClick);

            return () => {
                titlebar?.removeEventListener('dblclick', handleDoubleClick);
                dragInstance.kill();
                dragRef.current = null;
            };
        }, []);

        const startResize = (edge) => (event) => {
            if (event.button !== 0) return;

            event.preventDefault();
            event.stopPropagation();

            const handle = event.currentTarget;
            const start = useWindowStore.getState().windows[windowKey].bounds;
            const origin = { x: event.clientX, y: event.clientY };

            const handleMove = (moveEvent) => {
                setBounds(
                    windowKey,
                    resizeBounds(start, edge, moveEvent.clientX - origin.x, moveEvent.clientY - origin.y, app.minSize)
                );
            };

            const handleUp = () => {
                setInteracting(false);
                handle.removeEventListener('pointermove', handleMove);
                handle.removeEventListener('pointerup', handleUp);
                handle.removeEventListener('pointercancel', handleUp);
            };

            handle.setPointerCapture(event.pointerId);
            handle.addEventListener('pointermove', handleMove);
            handle.addEventListener('pointerup', handleUp);
            handle.addEventListener('pointercancel', handleUp);

            setInteracting(true);
            focusWindow(windowKey);
        };

        return (
            <section
                id={windowKey}
                ref={windowRef}
                className="absolute hidden flex-col"
                style={{
                    zIndex,
                    left: bounds?.x,
                    top: bounds?.y,
                    width: bounds?.w,
                    height: bounds?.h,
                }}
                onPointerDown={() => focusWindow(windowKey)}
            >
                <WrappedComponent {...props} />

                {!isMaximized && RESIZE_EDGES.map((edge) => (
                    <div
                        key={edge}
                        className={`window-resize window-resize-${edge}`}
                        onPointerDown={startResize(edge)}
                    />
                ))}
            </section>
        );
    };

    Wrapped.displayName = `WindowWrapper(${WrappedComponent.displayName || WrappedComponent.name || 'Component'
        })`;

    return Wrapped;
};

export default WindowWrapper;
```

- [ ] **Step 2: Rewrite `src/components/WindowControl.jsx`**

```jsx
import { Minus, Plus, X } from 'lucide-react';

import useWindowStore from '../store/window';

const WindowControls = ({ target }) => {
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);

  return (
    <div id="window-controls">
      <button type="button" className="close" aria-label="Close" onClick={() => closeWindow(target)}>
        <X />
      </button>
      <button type="button" className="minimize" aria-label="Minimize" onClick={() => minimizeWindow(target)}>
        <Minus />
      </button>
      <button type="button" className="maximize" aria-label="Zoom" onClick={() => toggleMaximize(target)}>
        <Plus />
      </button>
    </div>
  );
};

export default WindowControls;
```

- [ ] **Step 3: Mark title bars and make content fill the window**

`src/windows/Contact.jsx`:
- root: `className="flex flex-col rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] w-[min(600px,90vw)] h-[min(350px,60vh)]"` → `className="flex flex-col rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] flex-1 min-h-0 w-full"`
- header: `<div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#1a1a1a]">` → add ` data-titlebar` before `>`
- body: `className="flex flex-col p-8 text-white h-full relative"` → `className="flex flex-col p-8 text-white flex-1 min-h-0 overflow-auto relative"`

`src/windows/Terminal.jsx`:
- root: `className="flex flex-col rounded-xl overflow-hidden shadow-2xl w-[min(480px,90vw)]"` → `className="flex flex-col rounded-xl overflow-hidden shadow-2xl flex-1 min-h-0 w-full"`
- header: `<div className="flex items-center justify-between px-4 py-3 bg-[#3d3d3d] border-b border-[#2a2a2a]">` → add ` data-titlebar`
- body: `className="bg-[#1e1e1e] px-6 py-5 font-mono text-sm min-h-[200px]"` → `className="bg-[#1e1e1e] px-6 py-5 font-mono text-sm flex-1 min-h-0 overflow-auto"`

`src/windows/Resume.jsx`:
- root: `className="flex flex-col rounded-2xl overflow-hidden shadow-2xl w-[min(700px,90vw)] h-[min(600px,70vh)]"` → `className="flex flex-col rounded-2xl overflow-hidden shadow-2xl flex-1 min-h-0 w-full"`
- header: `<div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#1a1a1a] relative">` → add ` data-titlebar`
- PDF area: `className="flex-1 w-full bg-white overflow-hidden"` → `className="flex-1 min-h-0 w-full bg-white overflow-hidden"`

`src/windows/Finder.jsx`:
- header: `<div id="window-header">` → `<div id="window-header" data-titlebar>`
- content row: `className="flex overflow-hidden h-[min(400px,60vh)]"` → `className="flex flex-1 min-h-0 overflow-hidden"`

- [ ] **Step 4: Update `src/index.css`**

Replace the `#window-controls { … }` block with:

```css
  #window-controls {
    @apply flex gap-2;

    button {
      @apply size-3.5 rounded-full flex-center cursor-default;

      svg {
        @apply size-2.5 opacity-0 transition-opacity;
        color: rgb(0 0 0 / 0.6);
        stroke-width: 3;
      }
    }

    &:hover svg {
      @apply opacity-100;
    }

    .close {
      @apply bg-[#ff6157];
    }

    .minimize {
      @apply bg-[#ffc030];
    }

    .maximize {
      @apply bg-[#2acb42];
    }
  }
```

Delete the `#terminal { … }`, `#contact { … }` and `#resume { … }` blocks (they only set `absolute top-… left-…`, which `bounds` now owns). In the `#finder` block change the first line from `@apply absolute left-[10%] top-20 shadow-2xl drop-shadow-2xl overflow-hidden rounded-xl max-w-[90vw];` to `@apply shadow-2xl drop-shadow-2xl overflow-hidden rounded-xl;`.

Append at the end of the file, outside every layer:

```css
/* Window edge/corner resize handles (rendered by WindowWrapper). */
.window-resize {
  position: absolute;
  z-index: 10;
}
.window-resize-n { top: 0; left: 12px; right: 12px; height: 5px; cursor: ns-resize; }
.window-resize-s { bottom: 0; left: 12px; right: 12px; height: 5px; cursor: ns-resize; }
.window-resize-e { right: 0; top: 12px; bottom: 12px; width: 5px; cursor: ew-resize; }
.window-resize-w { left: 0; top: 12px; bottom: 12px; width: 5px; cursor: ew-resize; }
.window-resize-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
.window-resize-sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
.window-resize-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
.window-resize-se { bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize; }

/* During a window drag/resize, iframes must not capture the pointer. */
body.window-interacting {
  user-select: none;
}
body.window-interacting iframe {
  pointer-events: none;
}
```

- [ ] **Step 5: Re-fit windows on browser resize** — `src/App.jsx`

Add imports:

```js
import { useEffect } from "react"
import useWindowStore from "@store/window"
```

Add as the first lines inside `App`:

```js
  const fitToViewport = useWindowStore((state) => state.fitToViewport)

  useEffect(() => {
    window.addEventListener("resize", fitToViewport)
    return () => window.removeEventListener("resize", fitToViewport)
  }, [fitToViewport])
```

- [ ] **Step 6: Document the window contract**

In `CLAUDE.md`, in the window-system bullets, replace the `WindowWrapper(Component, windowKey)` bullet with:

```markdown
- `WindowWrapper(Component, windowKey)` wraps a window component in a `<section id={windowKey}>` positioned and sized by the store's `bounds` (inline `left/top/width/height`). It drags by the element marked `data-titlebar` (GSAP Draggable, `type: 'top,left'`, so transforms stay free for animations), double-click on that element zooms, eight `.window-resize` handles resize, and any press focuses. It throws at import if `windowKey` isn't in the registry.
- **Window components must** put `data-titlebar` on their header and make their root fill the section (`flex-1 min-h-0 w-full`). Fixed widths/heights in window markup break resize and zoom — sizes live in the registry's `defaultBounds`/`minSize`.
- Geometry rules (min size, stay on screen, maximize area between menu bar and dock) are pure functions in `src/lib/bounds.js`; the store applies them, and `App.jsx` re-fits windows on browser resize.
```

Replace the bullet `- \`openWindow(key, data)\` accepts an optional payload stored on the window; \`closeWindow\` clears it.` with:

```markdown
- `openWindow(key, data, originRect)` accepts an optional payload and the launching icon's rect (for the open animation); `closeWindow` clears the payload but keeps `bounds` and zoom state, so a reopened window comes back where it was. `minimizeWindow`/`restoreWindow` move windows in and out of `minimizedStack` (rendered as dock tiles).
```

In `AGENTS.md` under `### Window Management`, append:

```markdown
Window components mark their header with `data-titlebar` and let their root fill the window (`flex-1 min-h-0 w-full`); default and minimum sizes live in the registry (`defaultBounds`, `minSize`), not in the markup.
```

- [ ] **Step 7: Verify**

Run: `npm test`
Expected: PASS, 59 tests.

Run: `npm run lint 2>&1 | tail -2`
Expected: `✖ 10 problems (10 errors, 0 warnings)` or fewer.

Run: `npm run build 2>&1 | grep -E "error|built in"`
Expected: `✓ built in …`, no errors.

Run: `npm run dev` and in the browser check:
- Each window opens at its default size; dragging works only from the title bar (dragging Terminal's body text selects text instead).
- Dragging a window's edges and corners resizes it; it stops at the minimum size; the top edge stops at the menu bar.
- Dragging and resizing across the Resume PDF doesn't stick.
- Green button and title-bar double-click toggle full-screen-between-menu-bar-and-dock; no drag or resize handles while zoomed.
- Yellow button hides the window (dock tile comes in Task 4); red closes; reopening returns to the same place and size.
- Hovering the traffic lights shows ×, −, +; clicking a window's body brings it to the front.
- Shrinking the browser keeps windows reachable.

- [ ] **Step 8: Commit**

```bash
git add src/hoc/WindowWrapper.jsx src/components/WindowControl.jsx src/windows/Finder.jsx src/windows/Terminal.jsx src/windows/Contact.jsx src/windows/Resume.jsx src/App.jsx src/index.css CLAUDE.md AGENTS.md
git commit -m "feat: title-bar drag, edge resize, zoom and working traffic lights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Animations, dock tiles and running indicators

**Files:**
- Modify: `src/hoc/WindowWrapper.jsx`, `src/components/Dock.jsx`, `src/components/DesktopItem.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `transformToRect`, `toRect` (Task 1); `restoreWindow`, `openWindow(key, data, originRect)`, `minimizedStack`, `getDockAction` `'restore'` (Task 2); the visibility seam in `WindowWrapper` (Task 3).
- Produces: dock tiles carry `data-dock-minimized="<windowKey>"` — `WindowWrapper` measures that element as the minimize target.

- [ ] **Step 1: Replace the visibility effect in `src/hoc/WindowWrapper.jsx`**

Change the imports line `import { resizeBounds } from '../lib/bounds';` to:

```js
import { resizeBounds, toRect, transformToRect } from '../lib/bounds';
```

Add above `const WindowWrapper =`:

```js
const hideWindow = (element) => {
    element.style.display = 'none';
    gsap.set(element, { clearProps: 'transform,opacity,transformOrigin' });
};

const minimizeTarget = (windowKey) => {
    const tile = document.querySelector(`[data-dock-minimized="${windowKey}"]`);
    return tile ? toRect(tile.getBoundingClientRect()) : null;
};
```

Replace the whole `// Show / hide. Task 4 replaces this…` effect with:

```js
        // Show / hide with macOS-style motion. Reads the latest state from the
        // store so the effect only re-runs when visibility actually flips.
        useLayoutEffect(() => {
            const element = windowRef.current;
            const wasVisible = wasVisibleRef.current;
            wasVisibleRef.current = isVisible;

            if (!element || isVisible === wasVisible) return;

            const { bounds: current, originRect, isMinimized: minimized } =
                useWindowStore.getState().windows[windowKey];

            gsap.killTweensOf(element);

            if (isVisible) {
                element.style.display = 'flex';

                if (originRect && current) {
                    // Grow out of the icon/tile that launched it.
                    gsap.fromTo(
                        element,
                        { transformOrigin: '0 0', ...transformToRect(current, originRect), opacity: 0 },
                        { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.35, ease: 'power3.out' }
                    );
                } else {
                    gsap.fromTo(
                        element,
                        { transformOrigin: '50% 50%', scale: 0.8, opacity: 0, y: 40 },
                        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
                    );
                }

                return;
            }

            const target = minimized ? minimizeTarget(windowKey) : null;

            if (target && current) {
                // Genie-lite: height collapses faster than width, so the window
                // squashes as it slides into its dock tile.
                const to = transformToRect(current, target);

                gsap.set(element, { transformOrigin: '0 0' });
                gsap.timeline({ onComplete: () => hideWindow(element) })
                    .to(element, { y: to.y, scaleY: to.scaleY, duration: 0.45, ease: 'power2.in' }, 0)
                    .to(element, { x: to.x, scaleX: to.scaleX, duration: 0.45, ease: 'power3.in' }, 0)
                    .to(element, { opacity: 0.4, duration: 0.45, ease: 'none' }, 0);
            } else {
                gsap.to(element, {
                    transformOrigin: '50% 50%',
                    scale: 0.92,
                    opacity: 0,
                    duration: 0.18,
                    ease: 'power1.in',
                    onComplete: () => hideWindow(element),
                });
            }
        }, [isVisible]);
```

Replace the `// Keep Draggable in sync…` effect with one that also tweens zoom changes:

```js
        const lastBoundsRef = useRef(null);
        const lastMaximizedRef = useRef(false);

        // Keep Draggable in sync with store-driven geometry, tween zoom
        // changes (~0.3s), and disable dragging while zoomed.
        useLayoutEffect(() => {
            const element = windowRef.current;
            const drag = dragRef.current;
            const previous = lastBoundsRef.current;
            const zoomChanged = lastMaximizedRef.current !== isMaximized;

            lastBoundsRef.current = bounds;
            lastMaximizedRef.current = isMaximized;

            if (drag) {
                if (isMaximized) drag.disable();
                else drag.enable();
            }

            if (element && zoomChanged && previous && bounds && isVisible) {
                gsap.fromTo(
                    element,
                    { left: previous.x, top: previous.y, width: previous.w, height: previous.h },
                    {
                        left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h,
                        duration: 0.3,
                        ease: 'power2.inOut',
                        onComplete: () => drag?.update(),
                    }
                );
            } else {
                drag?.update();
            }
        }, [bounds, isMaximized, isVisible]);
```

(Move the two `useRef` lines up with the other refs at the top of `Wrapped`.)

- [ ] **Step 2: Rewrite the dock body** — `src/components/Dock.jsx`

```jsx
import gsap from 'gsap';
import { Tooltip } from 'react-tooltip';

import { dockApps, getApp } from '../constants';
import { getDockAction } from '../lib/dock';
import { toRect } from '../lib/bounds';
import useWindowStore from '../store/window';

const magnify = (event) => {
    gsap.to(event.currentTarget, { scale: 1.2, y: -8, duration: 0.2, ease: 'power1.out' });
};

const settle = (event) => {
    gsap.to(event.currentTarget, { scale: 1, y: 0, duration: 0.3, ease: 'power1.out' });
};

const Dock = () => {
    const windows = useWindowStore((state) => state.windows);
    const minimizedStack = useWindowStore((state) => state.minimizedStack);
    const openWindow = useWindowStore((state) => state.openWindow);
    const focusWindow = useWindowStore((state) => state.focusWindow);
    const restoreWindow = useWindowStore((state) => state.restoreWindow);

    const apps = dockApps.filter((app) => app.id !== 'trash');
    const trash = dockApps.find((app) => app.id === 'trash');

    const handleAppClick = (app, event) => {
        const action = getDockAction(app.canOpen ? windows[app.id] : undefined);
        const rect = toRect(event.currentTarget.getBoundingClientRect());

        if (action === 'open') openWindow(app.id, null, rect);
        if (action === 'restore') restoreWindow(app.id, rect);
        if (action === 'focus') focusWindow(app.id);
    };

    const renderApp = (app) => (
        <div key={app.id} className="relative flex justify-center">
            <button
                type="button"
                className="dock-icon"
                aria-label={app.name}
                data-tooltip-id="dock-tooltip"
                data-tooltip-content={app.name}
                disabled={!app.canOpen}
                onClick={(event) => handleAppClick(app, event)}
                onMouseEnter={magnify}
                onMouseLeave={settle}
            >
                <img
                    src={app.icon}
                    alt={app.name}
                    loading="lazy"
                    className={!app.canOpen ? 'opacity-60' : ''}
                />
            </button>
            {windows[app.id]?.isOpen && <span className="dock-running" />}
        </div>
    );

    return (
        <section id="dock">
            <div className="dock-container">
                {apps.map(renderApp)}

                <div className="dock-divider" />

                {minimizedStack.map((id) => {
                    const app = getApp(id);

                    return (
                        <button
                            key={id}
                            type="button"
                            className="dock-icon dock-minimized"
                            aria-label={`Restore ${app.title}`}
                            data-dock-minimized={id}
                            data-tooltip-id="dock-tooltip"
                            data-tooltip-content={app.title}
                            onClick={(event) => restoreWindow(id, toRect(event.currentTarget.getBoundingClientRect()))}
                            onMouseEnter={magnify}
                            onMouseLeave={settle}
                        >
                            <img src={app.icon} alt={app.title} />
                        </button>
                    );
                })}

                {trash && renderApp(trash)}
            </div>

            <Tooltip
                id="dock-tooltip"
                place="top"
                className="tooltip"
                delayShow={150}
            />
        </section>
    );
};

export default Dock;
```

Re-export `getApp` from `src/constants/index.js`: change the top import to `import { dockApps, desktopItems, getApp } from './apps';` and add `getApp,` to the main `export { … }` block.

- [ ] **Step 3: Launch from the desktop icon's position** — `src/components/DesktopItem.jsx`

Add after the store import:

```js
import { toRect } from '../lib/bounds';
```

Replace the handler and its use:

```js
    const handleOpen = (event) => {
        openWindow(item.id, null, toRect(event.currentTarget.getBoundingClientRect()));
    };
```

and `onClick={handleDoubleClick}` → `onClick={handleOpen}`.

- [ ] **Step 4: Dock styles** — in `src/index.css`, inside the `#dock { … }` block after the `.dock-icon { … }` rule, add:

```css
    .dock-running {
      @apply absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-white/80;
    }

    .dock-divider {
      @apply w-px self-stretch my-1 mx-1 bg-white/20;
    }

    .dock-minimized img {
      @apply rounded-lg ring-1 ring-white/20;
    }
```

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: PASS, 59 tests.

Run: `npm run lint 2>&1 | tail -2`
Expected: ≤ 10 errors, 0 warnings.

Run: `npm run build 2>&1 | grep -E "error|built in"`
Expected: `✓ built in …`.

Run: `npm run dev` and check:
- Opening Projects or Resume from the desktop grows the window out of the icon; from the dock, out of the dock icon; from the menu bar, the default pop-in.
- Red button: quick shrink-and-fade.
- Yellow button: window squashes into a new tile right of the divider (left of Archive); the tile magnifies on hover; clicking it grows the window back out of the tile on top.
- Minimize Resume (desktop-only app), then click its desktop icon: it restores and its tile disappears.
- Open apps show a dot under their dock icon; closing removes it.
- Green button animates smoothly both ways.
- Minimize then immediately click the tile: no stuck half-animated window.

- [ ] **Step 6: Commit**

```bash
git add src/hoc/WindowWrapper.jsx src/components/Dock.jsx src/components/DesktopItem.jsx src/constants/index.js src/index.css
git commit -m "feat: window open/close/minimize animations and dock tiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
