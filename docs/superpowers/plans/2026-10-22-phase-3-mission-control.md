# Phase 3 — Mission Control + App Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mission Control (all visible windows spread into a grid over a dimmed desktop; click one to focus it, Esc or a click on the backdrop to leave) and an app switcher (hold Option+Tab on macOS or Ctrl+` anywhere, Tab to cycle, release to switch).

**Architecture:** All decisions live in pure, unit-tested functions: `src/lib/missionControl.js` lays the grid out, `src/lib/shortcuts.js` recognizes keys per platform, and `src/lib/switcher.js` holds the switcher's order and a keyboard reducer. A new `src/store/system.js` (the spec's system store) holds Mission Control state. `WindowWrapper` animates each window to its grid slot through its own animation slot, so Mission Control never fights the geometry or visibility animations from Phase 2. The components (`MissionControl`, `AppSwitcher`) are thin: they listen to keys and pointers, call the pure functions, and render.

**Tech Stack:** React 19, Zustand 5 + Immer, GSAP 3.14, Tailwind 4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md` — section 5b (Mission Control, App switcher), build-order phase 3.

**Deliberate deviations / deferrals:**
- *"All shortcuts listed in the Help menu"* is deferred to Phase 6, which builds the menu-bar menus; there is no Help menu yet.
- *The dock is covered by the Mission Control backdrop.* macOS keeps the dock clickable, but here the dock sits below windows in z-order, so it would show through scaled windows unevenly. Esc, a backdrop click or a window click all leave Mission Control.
- *Mission Control needs an icon.* No asset exists, so this plan adds a small SVG (`public/images/mission-control.svg`) the owner can replace.

## Global Constraints

- GSAP is the only animation library; no new runtime dependencies.
- Shortcuts: Mission Control = dock icon, top-right hot corner, **Ctrl+↑ on Windows/Linux only** (macOS reserves F3 and Ctrl+↑). App switcher = **Alt/Option+Tab on macOS** and **Ctrl+` on all platforms** (Windows reserves Alt+Tab).
- New apps go on the desktop; Mission Control is a dock *launcher* (`hasWindow: false`), as the spec places it.
- Vitest covers pure logic only (`src/lib/`, stores, registry); UI is verified in Chrome via `npm run dev`. Never import a window component or `src/lib/firebase.js` from a test.
- `npx eslint . --ignore-pattern .superpowers` must stay at the 10-error baseline with 0 warnings.
- Never edit or commit AppleDouble `._*` files.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Branch: `feature/mission-control`.

## Review Focus

1. Switching away from the browser (Cmd/Alt+Tab to another app, so the keyup never arrives) while the switcher is open must not leave it stuck on screen (pinned in Task 3: reducer `blur` case).
2. Pressing Ctrl+↑ on a Mac must do nothing in the page (macOS owns it), and Alt+Tab on Windows must not be claimed (pinned in Tasks 1 and 3: `isMissionControlKey`, `switcherModifier`).
3. A huge or maximized window must shrink to fit its Mission Control slot, and a small one must never be enlarged (pinned in Task 1: layout tests).
4. Minimized windows stay out of Mission Control, but appear in the switcher and are restored when picked (pinned in Task 1: system store test; Task 3: `switcherOrder` test + component wiring).
5. While Mission Control is open, clicks inside a window (Finder items, buttons, links, resize handles, title-bar drags) must not reach the window's content — a click only picks the window (CSS `pointer-events` rule in Task 2; verified in Chrome).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/shortcuts.js` (create) | Platform detection and per-platform shortcut recognition |
| `src/lib/missionControl.js` (create) | Grid layout of windows for Mission Control |
| `src/lib/switcher.js` (create) | Switcher app order and keyboard reducer |
| `src/store/system.js` (create) | Mission Control state (spec's system store; later phases add to it) |
| `*.test.js` beside each of the above (create) | Unit tests |
| `src/constants/apps.js`, `apps.test.js` (modify) | Mission Control dock launcher (`action`) |
| `public/images/mission-control.svg` (create) | Launcher icon |
| `src/components/system/MissionControl.jsx` (create) | Backdrop, labels, Ctrl+↑/Esc, hot corner |
| `src/components/system/AppSwitcher.jsx` (create) | Switcher overlay and key listeners |
| `src/hoc/WindowWrapper.jsx` (modify) | Animate to/from the grid slot; click picks a window |
| `src/components/Dock.jsx` (modify) | Launcher click → toggle Mission Control |
| `src/App.jsx`, `src/index.css`, `CLAUDE.md`, `AGENTS.md` (modify) | Mount, styles, docs |

---

### Task 1: Mission Control layout, shortcuts and system store

**Files:**
- Create: `src/lib/shortcuts.js`, `src/lib/shortcuts.test.js`, `src/lib/missionControl.js`, `src/lib/missionControl.test.js`, `src/store/system.js`, `src/store/system.test.js`

**Interfaces:**
- Consumes: `MENU_BAR_HEIGHT`, `DOCK_RESERVE` (120), `getViewport` from `src/lib/bounds.js`; `useWindowStore`, `createInitialWindowState` from `src/store/window.js`.
- Produces:
  - `isMacPlatform(platform: string) => boolean`
  - `getPlatform() => string` (`navigator.userAgentData.platform` → `navigator.platform` → `''`)
  - `isMissionControlKey(event: { ctrlKey, key }, isMac: boolean) => boolean`
  - `MC_PADDING = 48`, `MC_GAP = 24`, `MC_LABEL = 28`
  - `missionControlLayout(entries: Array<{ key, bounds }>, viewport) => Record<key, { x, y, scale, label: { left, top, width } }>` — `x/y` are GSAP translate offsets from the window's own `bounds` (use with `transformOrigin: '0 0'`)
  - `useSystemStore` (default export) with `missionControl: null | { layout }`, `openMissionControl()`, `closeMissionControl()`, `toggleMissionControl()`; named `createInitialSystemState()`

- [ ] **Step 1: Write the failing tests**

`src/lib/shortcuts.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { isMacPlatform, isMissionControlKey } from './shortcuts';

describe('isMacPlatform', () => {
    it('recognizes macOS platform strings', () => {
        expect(isMacPlatform('macOS')).toBe(true);
        expect(isMacPlatform('MacIntel')).toBe(true);
    });

    it('rejects other platforms and empty strings', () => {
        expect(isMacPlatform('Windows')).toBe(false);
        expect(isMacPlatform('Linux x86_64')).toBe(false);
        expect(isMacPlatform('')).toBe(false);
    });
});

describe('isMissionControlKey', () => {
    it('opens Mission Control with Ctrl+ArrowUp on Windows/Linux', () => {
        expect(isMissionControlKey({ ctrlKey: true, key: 'ArrowUp' }, false)).toBe(true);
    });

    it('leaves Ctrl+ArrowUp to macOS', () => {
        expect(isMissionControlKey({ ctrlKey: true, key: 'ArrowUp' }, true)).toBe(false);
    });

    it('ignores ArrowUp without Ctrl', () => {
        expect(isMissionControlKey({ ctrlKey: false, key: 'ArrowUp' }, false)).toBe(false);
    });
});
```

`src/lib/missionControl.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { missionControlLayout } from './missionControl';

const viewport = { width: 1440, height: 900 };

describe('missionControlLayout', () => {
    it('lays out nothing when no windows are visible', () => {
        expect(missionControlLayout([], viewport)).toEqual({});
    });

    it('centers a single window that already fits, without enlarging it', () => {
        const layout = missionControlLayout([{ key: 'finder', bounds: { x: 128, y: 80, w: 760, h: 444 } }], viewport);
        expect(layout.finder).toEqual({
            x: 212, y: 94, scale: 1,
            label: { left: 340, top: 626, width: 760 },
        });
    });

    it('shrinks a maximized window to fit its slot', () => {
        const { finder } = missionControlLayout([{ key: 'finder', bounds: { x: 0, y: 40, w: 1440, h: 740 } }], viewport);
        expect(finder.scale).toBeCloseTo(568 / 740);
        expect(1440 * finder.scale).toBeLessThanOrEqual(1296);
    });

    it('arranges four windows in a 2x2 grid in the given order', () => {
        const bounds = { x: 0, y: 40, w: 400, h: 300 };
        const layout = missionControlLayout(
            ['a', 'b', 'c', 'd'].map((key) => ({ key, bounds })),
            viewport
        );
        expect(Object.keys(layout)).toEqual(['a', 'b', 'c', 'd']);
        expect(layout.a.scale).toBeCloseTo(0.82);
        expect(layout.a.x).toBeCloseTo(220);
        expect(layout.a.y).toBeCloseTo(72);
        expect(layout.d.x).toBeCloseTo(892);
        expect(layout.d.y).toBeCloseTo(394);
    });
});
```

`src/store/system.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import useSystemStore, { createInitialSystemState } from './system';
import useWindowStore, { createInitialWindowState } from './window';

const system = () => useSystemStore.getState();
const windows = () => useWindowStore.getState();

beforeEach(() => {
    globalThis.innerWidth = 1440;
    globalThis.innerHeight = 900;
    useWindowStore.setState(createInitialWindowState());
    useSystemStore.setState(createInitialSystemState());
});

afterEach(() => {
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
});

describe('Mission Control state', () => {
    it('starts closed', () => {
        expect(system().missionControl).toBeNull();
    });

    it('lays out only visible windows, frontmost first', () => {
        windows().openWindow('finder');
        windows().openWindow('terminal');
        windows().openWindow('contact');
        windows().minimizeWindow('terminal');
        system().openMissionControl();
        expect(Object.keys(system().missionControl.layout)).toEqual(['contact', 'finder']);
    });

    it('closes', () => {
        windows().openWindow('finder');
        system().openMissionControl();
        system().closeMissionControl();
        expect(system().missionControl).toBeNull();
    });

    it('toggles open and closed', () => {
        system().toggleMissionControl();
        expect(system().missionControl).toEqual({ layout: {} });
        system().toggleMissionControl();
        expect(system().missionControl).toBeNull();
    });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/lib/shortcuts.test.js src/lib/missionControl.test.js src/store/system.test.js`
Expected: FAIL — `Cannot find module './shortcuts'`, `'./missionControl'`, `'./system'`.

- [ ] **Step 3: Implement**

`src/lib/shortcuts.js`:

```js
// Platform-aware keyboard shortcuts. macOS reserves Ctrl+↑/F3 (Mission
// Control) and Cmd+Tab; Windows reserves Alt+Tab — so each shortcut is only
// claimed where the visitor's OS leaves it free.

export const isMacPlatform = (platform) => /mac/i.test(platform);

export const getPlatform = () =>
    globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || '';

export const isMissionControlKey = (event, isMac) =>
    !isMac && event.ctrlKey && event.key === 'ArrowUp';
```

`src/lib/missionControl.js`:

```js
import { DOCK_RESERVE, MENU_BAR_HEIGHT } from './bounds';

export const MC_PADDING = 48;
export const MC_GAP = 24;
export const MC_LABEL = 28;

// Grid slots for Mission Control: the area between the menu bar and the dock
// is split into cols x rows cells (cols = ceil(sqrt(n))), each window is scaled
// to fit its cell (never enlarged) and centered above its label. x/y are GSAP
// translate offsets from the window's own bounds (transformOrigin '0 0').
export const missionControlLayout = (entries, viewport) => {
    if (entries.length === 0) return {};

    const area = {
        x: MC_PADDING,
        y: MENU_BAR_HEIGHT + MC_PADDING,
        w: viewport.width - 2 * MC_PADDING,
        h: viewport.height - MENU_BAR_HEIGHT - DOCK_RESERVE - 2 * MC_PADDING,
    };
    const cols = Math.ceil(Math.sqrt(entries.length));
    const rows = Math.ceil(entries.length / cols);
    const cellW = area.w / cols;
    const cellH = area.h / rows;
    const availW = cellW - 2 * MC_GAP;
    const availH = cellH - 2 * MC_GAP - MC_LABEL;

    return Object.fromEntries(entries.map(({ key, bounds }, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const scale = Math.min(1, availW / bounds.w, availH / bounds.h);
        const width = bounds.w * scale;
        const height = bounds.h * scale;
        const left = area.x + col * cellW + (cellW - width) / 2;
        const top = area.y + row * cellH + MC_GAP + (availH - height) / 2;

        return [key, {
            x: left - bounds.x,
            y: top - bounds.y,
            scale,
            label: { left, top: top + height + 8, width },
        }];
    }));
};
```

`src/store/system.js`:

```js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getViewport } from '../lib/bounds';
import { missionControlLayout } from '../lib/missionControl';
import useWindowStore from './window';

// OS-level state that isn't about a single window. Later phases add boot
// phase, Spotlight, Control Center and audio here.
export const createInitialSystemState = () => ({
  missionControl: null,
});

const visibleWindowEntries = () =>
  Object.entries(useWindowStore.getState().windows)
    .filter(([, window]) => window.isOpen && !window.isMinimized && window.bounds)
    .sort(([, a], [, b]) => b.zIndex - a.zIndex)
    .map(([key, window]) => ({ key, bounds: window.bounds }));

const useSystemStore = create(
  immer((set, get) => ({
    ...createInitialSystemState(),

    openMissionControl: () =>
      set((state) => {
        state.missionControl = { layout: missionControlLayout(visibleWindowEntries(), getViewport()) };
      }),

    closeMissionControl: () =>
      set((state) => {
        state.missionControl = null;
      }),

    toggleMissionControl: () => {
      if (get().missionControl) get().closeMissionControl();
      else get().openMissionControl();
    },
  }))
);

export default useSystemStore;
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test`
Expected: PASS — 9 files, 77 tests (64 existing + 5 shortcuts + 4 layout + 4 system).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shortcuts.js src/lib/shortcuts.test.js src/lib/missionControl.js src/lib/missionControl.test.js src/store/system.js src/store/system.test.js
git commit -m "feat: Mission Control layout, platform shortcuts and system store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Mission Control UI, dock launcher and hot corner

**Files:**
- Create: `src/components/system/MissionControl.jsx`, `public/images/mission-control.svg`
- Modify: `src/constants/apps.js`, `src/constants/apps.test.js`, `src/components/Dock.jsx`, `src/hoc/WindowWrapper.jsx`, `src/App.jsx`, `src/index.css`, `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes: everything Task 1 produces; `createAnimationSlot` (`src/lib/animationSlot.js`); `getApp`.
- Produces:
  - Registry launcher entry `{ id: 'missionControl', …, hasWindow: false, action: 'missionControl' }`; `dockApps` items gain `action: string | null`.
  - Window sections carry `data-window`; `document.body` has class `mission-control-open` while it is open.

- [ ] **Step 1: Update the registry tests** — in `src/constants/apps.test.js`, replace the test `'derives dock items in registry order with full icon paths'` with:

```js
    it('derives dock items in registry order with full icon paths', () => {
        expect(dockApps.map((a) => a.id)).toEqual(['finder', 'contact', 'terminal', 'missionControl', 'trash']);
        expect(dockApps.find((a) => a.id === 'finder')).toEqual({
            id: 'finder', name: 'Projects', icon: '/images/finder.png', canOpen: true, action: null,
        });
        expect(dockApps.find((a) => a.id === 'trash').canOpen).toBe(false);
    });

    it('marks Mission Control as a dock launcher without a window', () => {
        expect(dockApps.find((a) => a.id === 'missionControl')).toEqual({
            id: 'missionControl', name: 'Mission Control', icon: '/images/mission-control.svg',
            canOpen: false, action: 'missionControl',
        });
        expect(buildWindowConfig().missionControl).toBeUndefined();
    });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- src/constants/apps.test.js`
Expected: FAIL — the dock order lacks `missionControl`, and the finder item lacks `action`.

- [ ] **Step 3: Add the launcher to the registry** — in `src/constants/apps.js`, insert before the `trash` entry:

```js
    {
        id: 'missionControl',
        title: 'Mission Control',
        icon: '/images/mission-control.svg',
        placement: ['dock'],
        hasWindow: false,
        action: 'missionControl',
    },
```

and change the `dockApps` mapping to:

```js
    .map((app) => ({
        id: app.id,
        name: app.title,
        icon: app.icon,
        canOpen: hasWindow(app),
        action: app.action ?? null,
    }));
```

Add to the header comment: `// \`action\` marks dock launchers that run something instead of opening a window.`

Create `public/images/mission-control.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5b6cf2"/>
      <stop offset="1" stop-color="#2b2f8f"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#bg)"/>
  <rect x="11" y="15" width="18" height="14" rx="3" fill="#fff" fill-opacity=".9"/>
  <rect x="35" y="15" width="18" height="14" rx="3" fill="#fff" fill-opacity=".75"/>
  <rect x="11" y="35" width="18" height="14" rx="3" fill="#fff" fill-opacity=".75"/>
  <rect x="35" y="35" width="18" height="14" rx="3" fill="#fff" fill-opacity=".6"/>
</svg>
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: PASS, 78 tests.

- [ ] **Step 5: Dock launcher** — in `src/components/Dock.jsx`:

Add the import after the window-store import:

```js
import useSystemStore from '../store/system';
```

Add after the `restoreWindow` selector:

```js
    const toggleMissionControl = useSystemStore((state) => state.toggleMissionControl);
```

Make `handleAppClick` start with:

```js
        if (app.action === 'missionControl') {
            toggleMissionControl();
            return;
        }

```

In `renderApp`, change `disabled={!app.canOpen}` to `disabled={!app.canOpen && !app.action}` and `className={!app.canOpen ? 'opacity-60' : ''}` to `className={!app.canOpen && !app.action ? 'opacity-60' : ''}`.

- [ ] **Step 6: Create `src/components/system/MissionControl.jsx`**

```jsx
import { useEffect } from 'react';

import { getApp } from '../../constants/apps';
import { getPlatform, isMacPlatform, isMissionControlKey } from '../../lib/shortcuts';
import useSystemStore from '../../store/system';

const isMac = isMacPlatform(getPlatform());

// Backdrop + window labels while Mission Control is open (the windows
// themselves are moved by WindowWrapper), the Ctrl+↑ / Esc shortcuts, and the
// top-right hot corner.
const MissionControl = () => {
    const missionControl = useSystemStore((state) => state.missionControl);
    const openMissionControl = useSystemStore((state) => state.openMissionControl);
    const closeMissionControl = useSystemStore((state) => state.closeMissionControl);
    const toggleMissionControl = useSystemStore((state) => state.toggleMissionControl);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (isMissionControlKey(event, isMac)) {
                event.preventDefault();
                toggleMissionControl();
            } else if (event.key === 'Escape' && useSystemStore.getState().missionControl) {
                closeMissionControl();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleMissionControl, closeMissionControl]);

    useEffect(() => {
        document.body.classList.toggle('mission-control-open', Boolean(missionControl));
    }, [missionControl]);

    const handleHotCorner = () => {
        if (!useSystemStore.getState().missionControl) openMissionControl();
    };

    return (
        <>
            <div className="hot-corner hot-corner-top-right" onPointerEnter={handleHotCorner} />

            {missionControl && (
                <div className="mission-control" onClick={closeMissionControl}>
                    {Object.entries(missionControl.layout).map(([key, { label }]) => (
                        <span
                            key={key}
                            className="mission-control-label"
                            style={{ left: label.left, top: label.top, width: label.width }}
                        >
                            {getApp(key).title}
                        </span>
                    ))}
                </div>
            )}
        </>
    );
};

export default MissionControl;
```

- [ ] **Step 7: Move windows into and out of the grid** — in `src/hoc/WindowWrapper.jsx`:

Add the import after the window-store import:

```js
import useSystemStore from '../store/system';
```

Add a third slot after `const zoomAnimation = createAnimationSlot();`:

```js
    const missionControlAnimation = createAnimationSlot();
```

Add after the `lastMaximizedRef` ref:

```js
        const inMissionControlRef = useRef(false);
```

Add after the `toggleMaximize` selector:

```js
        const missionControlTarget = useSystemStore((state) => state.missionControl?.layout[windowKey] ?? null);
        const closeMissionControl = useSystemStore((state) => state.closeMissionControl);
```

Add this effect after the geometry (bounds) effect:

```js
        // Mission Control: slide into this window's grid slot, and back out.
        useLayoutEffect(() => {
            const element = windowRef.current;

            if (!element) return;

            if (missionControlTarget) {
                inMissionControlRef.current = true;
                visibilityAnimation.finish();
                zoomAnimation.finish();

                const { x, y, scale } = missionControlTarget;

                missionControlAnimation.play(gsap.to(element, {
                    transformOrigin: '0 0', x, y, scale, duration: 0.35, ease: 'power3.out',
                }));
            } else if (inMissionControlRef.current) {
                inMissionControlRef.current = false;

                missionControlAnimation.play(gsap.to(element, {
                    x: 0,
                    y: 0,
                    scale: 1,
                    duration: 0.3,
                    ease: 'power3.out',
                    onComplete: () => gsap.set(element, { clearProps: 'transform,transformOrigin' }),
                }));
            }
        }, [missionControlTarget]);
```

Replace the section's `onPointerDown={() => focusWindow(windowKey)}` with:

```jsx
                data-window
                onPointerDown={() => {
                    focusWindow(windowKey);

                    // In Mission Control a click just picks this window.
                    if (useSystemStore.getState().missionControl) closeMissionControl();
                }}
```

- [ ] **Step 8: Mount and style**

`src/App.jsx` — add the import:

```js
import MissionControl from "@components/system/MissionControl"
```

and render `<MissionControl />` right after `<Dock />`.

Append to `src/index.css` (outside every layer):

```css
/* Mission Control: backdrop sits just below windows (z 1000+). */
.mission-control {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgb(0 0 0 / 0.35);
  backdrop-filter: blur(6px);
  animation: mission-control-fade 0.25s ease-out;
}
@keyframes mission-control-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.mission-control-label {
  position: absolute;
  text-align: center;
  font-size: 13px;
  color: white;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
  pointer-events: none;
}
/* While open, a click on a window only picks it: its content can't be used. */
body.mission-control-open [data-window] {
  cursor: pointer;
}
body.mission-control-open [data-window] > * {
  pointer-events: none;
}
.hot-corner {
  position: fixed;
  z-index: 100001;
  width: 6px;
  height: 6px;
}
.hot-corner-top-right {
  top: 0;
  right: 0;
}
```

- [ ] **Step 9: Document** — in `CLAUDE.md`, after the window-system bullets, add:

```markdown
- `src/store/system.js` holds OS-level state (Mission Control now; boot phase, Spotlight, Control Center and audio in later phases). While Mission Control is open, `WindowWrapper` slides each visible window into its grid slot (`src/lib/missionControl.js`) through its own animation slot, `body.mission-control-open` disables window content, and a press on a window picks it.
- Shortcuts are platform-aware (`src/lib/shortcuts.js`): Mission Control is Ctrl+↑ on Windows/Linux only (macOS reserves it), plus the dock launcher and the top-right hot corner.
```

In `AGENTS.md` under `### Window Management`, append:

```markdown
Keyboard shortcuts must go through `src/lib/shortcuts.js` so each one is only claimed on platforms whose OS leaves it free.
```

- [ ] **Step 10: Verify**

Run: `npm test` — Expected: PASS, 78 tests.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: `✖ 10 problems (10 errors, 0 warnings)`.
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

In Chrome (`npm run dev`), with Projects, Resume and Contact open and one of them minimized:
- The dock shows the Mission Control icon before the divider; clicking it spreads the *visible* windows into a grid with titles below; the minimized one stays in the dock.
- Clicking a Finder item or traffic light inside a spread window does nothing but pick that window: Mission Control closes and that window is in front.
- Esc and a click on the dim backdrop each close it, and windows slide back to their exact positions.
- Moving the pointer into the top-right corner opens it.
- With a maximized window, it shrinks into its slot and comes back maximized.

- [ ] **Step 11: Commit**

```bash
git add src/constants/apps.js src/constants/apps.test.js public/images/mission-control.svg src/components/Dock.jsx src/components/system/MissionControl.jsx src/hoc/WindowWrapper.jsx src/App.jsx src/index.css CLAUDE.md AGENTS.md
git commit -m "feat: Mission Control with dock launcher, hot corner and Ctrl+Up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: App switcher

**Files:**
- Create: `src/lib/switcher.js`, `src/lib/switcher.test.js`, `src/components/system/AppSwitcher.jsx`
- Modify: `src/lib/shortcuts.js`, `src/lib/shortcuts.test.js`, `src/App.jsx`, `src/index.css`, `CLAUDE.md`

**Interfaces:**
- Consumes: `getPlatform`, `isMacPlatform` (Task 1); `useWindowStore` `focusWindow`, `restoreWindow`; `getApp`.
- Produces:
  - `switcherModifier(event: { altKey, ctrlKey, key, code }, isMac) => 'Alt' | 'Control' | null`
  - `switcherOrder(windows) => string[]` — open windows; visible ones first, each group by z-index descending
  - `switcherReducer(state, action, { isMac, order }) => { state, commit: string | null, handled: boolean }` where `state = null | { order: string[], index: number, modifier: 'Alt' | 'Control' }` and `action` is `{ type: 'keydown', key, code, altKey, ctrlKey, shiftKey } | { type: 'keyup', key } | { type: 'blur' }`; `handled` means the component should `preventDefault()`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/shortcuts.test.js` (and add `switcherModifier` to its import):

```js
describe('switcherModifier', () => {
    it('starts the switcher with Option+Tab on macOS', () => {
        expect(switcherModifier({ altKey: true, ctrlKey: false, key: 'Tab', code: 'Tab' }, true)).toBe('Alt');
    });

    it('leaves Alt+Tab to Windows/Linux', () => {
        expect(switcherModifier({ altKey: true, ctrlKey: false, key: 'Tab', code: 'Tab' }, false)).toBeNull();
    });

    it('starts the switcher with Ctrl+` everywhere', () => {
        const event = { altKey: false, ctrlKey: true, key: '`', code: 'Backquote' };
        expect(switcherModifier(event, true)).toBe('Control');
        expect(switcherModifier(event, false)).toBe('Control');
    });

    it('ignores plain Tab', () => {
        expect(switcherModifier({ altKey: false, ctrlKey: false, key: 'Tab', code: 'Tab' }, true)).toBeNull();
    });
});
```

`src/lib/switcher.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { switcherOrder, switcherReducer } from './switcher';

const win = (isOpen, isMinimized, zIndex) => ({ isOpen, isMinimized, zIndex });

describe('switcherOrder', () => {
    it('lists open windows, visible first, each by recency', () => {
        expect(switcherOrder({
            finder: win(true, false, 1003),
            terminal: win(true, true, 1005),
            contact: win(true, false, 1004),
            resume: win(false, false, 1000),
        })).toEqual(['contact', 'finder', 'terminal']);
    });

    it('is empty when nothing is open', () => {
        expect(switcherOrder({ finder: win(false, false, 1000) })).toEqual([]);
    });
});

describe('switcherReducer', () => {
    const order = ['contact', 'finder', 'terminal'];
    const mac = { isMac: true, order };
    const optionTab = { type: 'keydown', key: 'Tab', code: 'Tab', altKey: true, ctrlKey: false, shiftKey: false };
    const ctrlBackquote = { type: 'keydown', key: '`', code: 'Backquote', altKey: false, ctrlKey: true, shiftKey: false };
    const open = { order, index: 1, modifier: 'Alt' };

    it('opens on Option+Tab with the previous app selected', () => {
        expect(switcherReducer(null, optionTab, mac)).toEqual({ state: open, commit: null, handled: true });
    });

    it('opens on Ctrl+` off macOS', () => {
        expect(switcherReducer(null, ctrlBackquote, { isMac: false, order }).state)
            .toEqual({ order, index: 1, modifier: 'Control' });
    });

    it('selects the only app when one window is open', () => {
        expect(switcherReducer(null, optionTab, { isMac: true, order: ['finder'] }).state.index).toBe(0);
    });

    it('stays closed and lets the key through when nothing is open', () => {
        expect(switcherReducer(null, ctrlBackquote, { isMac: true, order: [] }))
            .toEqual({ state: null, commit: null, handled: false });
    });

    it('advances on Tab and wraps around', () => {
        const once = switcherReducer(open, optionTab, mac).state;
        expect(once.index).toBe(2);
        expect(switcherReducer(once, optionTab, mac).state.index).toBe(0);
    });

    it('advances on ` too', () => {
        const state = { order, index: 1, modifier: 'Control' };
        expect(switcherReducer(state, ctrlBackquote, mac).state.index).toBe(2);
    });

    it('goes back on Shift+Tab', () => {
        expect(switcherReducer(open, { ...optionTab, shiftKey: true }, mac).state.index).toBe(0);
    });

    it('switches to the selection when the modifier is released', () => {
        expect(switcherReducer(open, { type: 'keyup', key: 'Alt' }, mac))
            .toEqual({ state: null, commit: 'finder', handled: true });
    });

    it('ignores releasing other keys', () => {
        expect(switcherReducer(open, { type: 'keyup', key: 'Tab' }, mac))
            .toEqual({ state: open, commit: null, handled: false });
    });

    it('cancels on Escape without switching', () => {
        expect(switcherReducer(open, { ...optionTab, key: 'Escape', code: 'Escape' }, mac))
            .toEqual({ state: null, commit: null, handled: true });
    });

    it('cancels when the page loses focus, so it never sticks open', () => {
        expect(switcherReducer(open, { type: 'blur' }, mac))
            .toEqual({ state: null, commit: null, handled: false });
    });

    it('lets unrelated keys through while open', () => {
        expect(switcherReducer(open, { ...optionTab, key: 'a', code: 'KeyA' }, mac))
            .toEqual({ state: open, commit: null, handled: false });
    });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/lib/shortcuts.test.js src/lib/switcher.test.js`
Expected: FAIL — `switcherModifier is not a function` / `Cannot find module './switcher'`.

- [ ] **Step 3: Implement**

Append to `src/lib/shortcuts.js`:

```js
// The held modifier that starts the app switcher, or null: Option+Tab on
// macOS (Windows reserves Alt+Tab), Ctrl+` everywhere.
export const switcherModifier = (event, isMac) => {
    if (isMac && event.altKey && event.key === 'Tab') return 'Alt';
    if (event.ctrlKey && event.code === 'Backquote') return 'Control';
    return null;
};
```

`src/lib/switcher.js`:

```js
import { switcherModifier } from './shortcuts';

// Open windows for the switcher: visible ones first, then minimized, each
// group most-recently-raised first.
export const switcherOrder = (windows) =>
    Object.entries(windows)
        .filter(([, window]) => window.isOpen)
        .sort(([, a], [, b]) =>
            Number(a.isMinimized) - Number(b.isMinimized) || b.zIndex - a.zIndex)
        .map(([key]) => key);

const result = (state, commit = null, handled = false) => ({ state, commit, handled });

// Keyboard state machine for the app switcher. `handled` tells the caller to
// preventDefault; `commit` is the app to switch to.
export const switcherReducer = (state, action, { isMac, order }) => {
    switch (action.type) {
        case 'keydown': {
            if (!state) {
                const modifier = switcherModifier(action, isMac);

                if (!modifier || order.length === 0) return result(null);

                return result({ order, index: order.length > 1 ? 1 : 0, modifier }, null, true);
            }

            if (action.key === 'Escape') return result(null, null, true);

            if (action.key === 'Tab' || action.code === 'Backquote') {
                const count = state.order.length;
                const step = action.shiftKey ? -1 : 1;

                return result({ ...state, index: (state.index + step + count) % count }, null, true);
            }

            return result(state);
        }

        case 'keyup':
            if (state && action.key === state.modifier) {
                return result(null, state.order[state.index], true);
            }

            return result(state);

        case 'blur':
            return result(null);

        default:
            return result(state);
    }
};
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test`
Expected: PASS — 10 files, 96 tests.

- [ ] **Step 5: Create `src/components/system/AppSwitcher.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';

import { getApp } from '../../constants/apps';
import { getPlatform, isMacPlatform } from '../../lib/shortcuts';
import { switcherOrder, switcherReducer } from '../../lib/switcher';
import useWindowStore from '../../store/window';

const isMac = isMacPlatform(getPlatform());

// Hold Option+Tab (macOS) or Ctrl+` and press Tab/` to cycle; release to switch.
const AppSwitcher = () => {
    const [switcher, setSwitcher] = useState(null);
    const switcherRef = useRef(null);

    useEffect(() => {
        const dispatch = (action, event) => {
            const { windows, focusWindow, restoreWindow } = useWindowStore.getState();
            const { state, commit, handled } = switcherReducer(
                switcherRef.current,
                action,
                { isMac, order: switcherOrder(windows) }
            );

            if (handled) event?.preventDefault();

            if (state !== switcherRef.current) {
                switcherRef.current = state;
                setSwitcher(state);
            }

            if (commit) {
                if (windows[commit].isMinimized) restoreWindow(commit);
                else focusWindow(commit);
            }
        };

        const handleKeyDown = (event) => dispatch({
            type: 'keydown',
            key: event.key,
            code: event.code,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
        }, event);
        const handleKeyUp = (event) => dispatch({ type: 'keyup', key: event.key }, event);
        const handleBlur = () => dispatch({ type: 'blur' });

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    if (!switcher) return null;

    const selected = getApp(switcher.order[switcher.index]);

    return (
        <div className="app-switcher" role="listbox" aria-label="Switch apps">
            <div className="app-switcher-row">
                {switcher.order.map((id, index) => (
                    <div
                        key={id}
                        className={`app-switcher-item${index === switcher.index ? ' is-selected' : ''}`}
                        role="option"
                        aria-selected={index === switcher.index}
                    >
                        <img src={getApp(id).icon} alt={getApp(id).title} />
                    </div>
                ))}
            </div>
            <p className="app-switcher-title">{selected.title}</p>
        </div>
    );
};

export default AppSwitcher;
```

- [ ] **Step 6: Mount and style**

`src/App.jsx` — add `import AppSwitcher from "@components/system/AppSwitcher"` and render `<AppSwitcher />` right after `<MissionControl />`.

Append to `src/index.css` (outside every layer):

```css
/* App switcher overlay (Option+Tab / Ctrl+`). */
.app-switcher {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 12px;
  border-radius: 24px;
  border: 1px solid rgb(255 255 255 / 0.1);
  background: rgb(30 30 30 / 0.75);
  backdrop-filter: blur(24px);
}
.app-switcher-row {
  display: flex;
  gap: 12px;
}
.app-switcher-item {
  padding: 8px;
  border-radius: 16px;
}
.app-switcher-item.is-selected {
  background: rgb(255 255 255 / 0.18);
}
.app-switcher-item img {
  width: 72px;
  height: 72px;
  object-fit: contain;
}
.app-switcher-title {
  font-size: 13px;
  color: white;
}
```

In `CLAUDE.md`, extend the shortcuts bullet added in Task 2 with: `The app switcher is Option+Tab on macOS and Ctrl+\` everywhere (Windows reserves Alt+Tab); its keyboard logic is the pure \`switcherReducer\` in \`src/lib/switcher.js\`.`

- [ ] **Step 7: Verify**

Run: `npm test` — Expected: PASS, 96 tests.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: `✖ 10 problems (10 errors, 0 warnings)`.
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

In Chrome, with Projects, Resume and Contact open (Contact in front) and Resume minimized:
- Press and release Ctrl+`: the previously used window (Projects) comes to the front.
- Dispatch Ctrl+` then ` again then release Control: the switcher shows Contact, Projects, Resume and switching to the third restores the minimized Resume.
- Escape while it's open closes it without switching.
- Blurring the page while it's open closes it.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shortcuts.js src/lib/shortcuts.test.js src/lib/switcher.js src/lib/switcher.test.js src/components/system/AppSwitcher.jsx src/App.jsx src/index.css CLAUDE.md
git commit -m "feat: app switcher on Option+Tab (macOS) and Ctrl+\`

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
