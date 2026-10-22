# Phase 4 — Boot Sequence + Lock Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a visitor's first load in a tab, play a handwritten "hello" on black, then show a macOS-style lock screen (blurred desktop, live clock, avatar, name, "click or press any key"), then reveal the desktop with the welcome text animating in. A refresh in the same tab goes straight to the desktop; small screens never see it.

**Architecture:** Boot state is a phase in the system store (`bootPhase: 'booting' | 'locked' | 'desktop'`) with guarded transitions (`finishBoot`, `unlock`, `lock`, `restart`). The first phase comes from a pure `initialBootPhase()` fed by try/catch-wrapped `sessionStorage` and `matchMedia` helpers in `src/lib/boot.js`. The desktop mounts immediately underneath; `BootScreen` and `LockScreen` are full-screen overlays rendered by `App.jsx` for their phase. Desktop keyboard shortcuts ignore input unless the phase is `'desktop'`.

**Tech Stack:** React 19, Zustand 5 + Immer, GSAP 3.14 (DrawSVGPlugin, included in the npm package since 3.13), dayjs, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md` — section 3 (Boot sequence & lock screen), build-order phase 4.

**Deferrals / decisions:**
- *Restart… and Lock Screen menu items* need the Apple menu, which Phase 6 builds. This phase ships the `restart()` and `lock()` store actions (tested) for that menu to call.
- *Startup chime on unlock* belongs to system sounds (Phase 6). *Clicking "hello" to replay it in another language* is an easter egg (Phase 9).
- *When "boot seen" is recorded:* on unlock (reaching the desktop), not at boot start — a refresh while the lock screen is up replays the sequence instead of skipping a screen the visitor never got past.
- *The "hello" path is hand-authored* in this plan; the owner can replace `HELLO_PATH`. It is checked visually in Chrome and may be reshaped there.
- *Avatar:* `profile.avatar` is `null` until the owner adds a photo; the lock screen shows initials meanwhile.

## Global Constraints

- Flow `booting → locked → desktop`; `sessionStorage` "boot seen" flag (try/catch) skips straight to the desktop on a same-tab refresh; blocked storage just replays the boot.
- Boot: black screen, single cursive "hello" drawn with GSAP DrawSVGPlugin, ~2.5s draw + 0.5s hold, fade. Click/any key skips. `prefers-reduced-motion` → shown pre-drawn, quick fade.
- Lock screen dismiss: slide up + fade (fade only with reduced motion), then the welcome text animates in.
- Open windows survive `lock()` and `restart()`.
- Small screens (`max-width: 639px`, Tailwind's `sm` boundary): no boot; the existing desktop-only message stays.
- GSAP is the only animation library; no new dependencies. Vitest covers pure logic only; UI is verified in Chrome. Never import a window component or `src/lib/firebase.js` from a test.
- `npx eslint . --ignore-pattern .superpowers` stays at 10 errors / 0 warnings. Never edit or commit `._*` files.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `feature/boot-lock`.

## Review Focus

1. If `sessionStorage` is blocked or throws (private mode, blocked site data), the visitor must still get in: boot replays, never a blank or stuck screen (pinned in Task 1: `readBootSeen`/`markBootSeen` throwing-storage tests).
2. Desktop shortcuts (Ctrl+`/Option+Tab switcher, Ctrl+↑, Esc for Mission Control, the hot corner) must do nothing during boot or the lock screen (pinned in Task 1: `isDesktopPhase`; wired in Task 2; verified in Chrome).
3. The key press that skips the boot must not also dismiss the lock screen (verified in Chrome in Task 3: the lock screen registers its listeners after mounting).
4. Small screens never see the boot (pinned in Task 1: `initialBootPhase`).
5. `lock()`/`restart()` must keep every open window exactly as it was, and must close Mission Control (pinned in Task 1: store tests).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/boot.js` (create) | Boot-seen flag, media queries, `initialBootPhase` |
| `src/lib/boot.test.js` (create) | Tests for the above |
| `src/store/system.js`, `system.test.js` (modify) | `bootPhase` + transitions; `isDesktopPhase` |
| `src/components/system/BootScreen.jsx` (create) | "hello" draw, skip, reduced motion |
| `src/components/system/LockScreen.jsx` (create) | Clock, avatar, hint, dismiss animation |
| `src/components/system/AppSwitcher.jsx`, `MissionControl.jsx` (modify) | Ignore shortcuts outside the desktop phase |
| `src/components/Welcome.jsx` (modify) | Letters animate in when the desktop is entered |
| `src/constants/index.js` (modify) | `profile` (name, avatar) |
| `src/App.jsx`, `src/index.css`, `CLAUDE.md`, `AGENTS.md` (modify) | Render overlays, styles, docs |

---

### Task 1: Boot phase logic

**Files:**
- Create: `src/lib/boot.js`, `src/lib/boot.test.js`
- Modify: `src/store/system.js`, `src/store/system.test.js`

**Interfaces:**
- Consumes: `useWindowStore`, `createInitialWindowState` (tests only).
- Produces:
  - `readBootSeen(storage = globalThis.sessionStorage) => boolean` (false on any error)
  - `markBootSeen(storage = globalThis.sessionStorage) => void` (never throws)
  - `matchesMedia(query) => boolean`, `isSmallScreen() => boolean` (`(max-width: 639px)`), `prefersReducedMotion() => boolean`
  - `initialBootPhase({ bootSeen, smallScreen }) => 'booting' | 'desktop'`
  - System store: `bootPhase`, `finishBoot()` (booting→locked only), `unlock()` (locked→desktop only; marks boot seen), `lock()` (→locked, closes Mission Control), `restart()` (→booting, closes Mission Control); named export `isDesktopPhase(state) => boolean`
  - `createInitialSystemState()` now computes `bootPhase` from `readBootSeen()` and `isSmallScreen()`

- [ ] **Step 1: Write the failing tests**

`src/lib/boot.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest';
import { initialBootPhase, markBootSeen, matchesMedia, readBootSeen } from './boot';

const memoryStorage = () => {
    const data = {};
    return {
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => { data[key] = String(value); },
    };
};

const throwingStorage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
};

describe('boot-seen flag', () => {
    it('is unset in a fresh tab', () => {
        expect(readBootSeen(memoryStorage())).toBe(false);
    });

    it('reads back after being marked', () => {
        const storage = memoryStorage();
        markBootSeen(storage);
        expect(readBootSeen(storage)).toBe(true);
    });

    it('treats blocked storage as unset instead of throwing', () => {
        expect(readBootSeen(throwingStorage)).toBe(false);
        expect(() => markBootSeen(throwingStorage)).not.toThrow();
    });

    it('treats missing storage (outside a browser) as unset', () => {
        expect(readBootSeen(undefined)).toBe(false);
        expect(() => markBootSeen(undefined)).not.toThrow();
    });
});

describe('matchesMedia', () => {
    afterEach(() => {
        delete globalThis.matchMedia;
    });

    it('is false outside a browser', () => {
        expect(matchesMedia('(max-width: 639px)')).toBe(false);
    });

    it('reports the media query result', () => {
        globalThis.matchMedia = (query) => ({ matches: query === '(max-width: 639px)' });
        expect(matchesMedia('(max-width: 639px)')).toBe(true);
        expect(matchesMedia('(prefers-reduced-motion: reduce)')).toBe(false);
    });
});

describe('initialBootPhase', () => {
    it('boots on a first visit on a large screen', () => {
        expect(initialBootPhase({ bootSeen: false, smallScreen: false })).toBe('booting');
    });

    it('skips to the desktop after the boot was seen in this tab', () => {
        expect(initialBootPhase({ bootSeen: true, smallScreen: false })).toBe('desktop');
    });

    it('never boots on small screens', () => {
        expect(initialBootPhase({ bootSeen: false, smallScreen: true })).toBe('desktop');
    });
});
```

Append to `src/store/system.test.js` (and change its first import line to `import useSystemStore, { createInitialSystemState, isDesktopPhase } from './system';`):

```js
describe('boot phase', () => {
    const memoryStorage = () => {
        const data = {};
        return {
            getItem: (key) => (key in data ? data[key] : null),
            setItem: (key, value) => { data[key] = String(value); },
        };
    };

    afterEach(() => {
        delete globalThis.sessionStorage;
    });

    it('boots on a first visit and skips once the boot was seen in this tab', () => {
        globalThis.sessionStorage = memoryStorage();
        expect(createInitialSystemState().bootPhase).toBe('booting');
        globalThis.sessionStorage.setItem('portfolio:bootSeen', '1');
        expect(createInitialSystemState().bootPhase).toBe('desktop');
    });

    it('goes from booting to locked, and only from booting', () => {
        useSystemStore.setState({ bootPhase: 'booting' });
        system().finishBoot();
        expect(system().bootPhase).toBe('locked');
        useSystemStore.setState({ bootPhase: 'desktop' });
        system().finishBoot();
        expect(system().bootPhase).toBe('desktop');
    });

    it('unlocks to the desktop and remembers the boot was seen', () => {
        globalThis.sessionStorage = memoryStorage();
        useSystemStore.setState({ bootPhase: 'locked' });
        system().unlock();
        expect(system().bootPhase).toBe('desktop');
        expect(globalThis.sessionStorage.getItem('portfolio:bootSeen')).toBe('1');
    });

    it('only unlocks from the lock screen', () => {
        useSystemStore.setState({ bootPhase: 'booting' });
        system().unlock();
        expect(system().bootPhase).toBe('booting');
    });

    it('locks and restarts without touching open windows, closing Mission Control', () => {
        windows().openWindow('finder');
        windows().setBounds('finder', { x: 300, y: 200, w: 600, h: 400 });
        const before = windows().windows.finder;
        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openMissionControl();

        system().lock();
        expect(system().bootPhase).toBe('locked');
        expect(system().missionControl).toBeNull();

        system().openMissionControl();
        system().restart();
        expect(system().bootPhase).toBe('booting');
        expect(system().missionControl).toBeNull();
        expect(windows().windows.finder).toEqual(before);
    });

    it('accepts desktop shortcuts only on the desktop', () => {
        expect(isDesktopPhase({ bootPhase: 'desktop' })).toBe(true);
        expect(isDesktopPhase({ bootPhase: 'locked' })).toBe(false);
        expect(isDesktopPhase({ bootPhase: 'booting' })).toBe(false);
    });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- src/lib/boot.test.js src/store/system.test.js`
Expected: FAIL — `Cannot find module './boot'`; in `system.test.js`, `isDesktopPhase` undefined / `system().finishBoot is not a function`.

- [ ] **Step 3: Implement**

`src/lib/boot.js`:

```js
// First-load boot sequence helpers. Every browser API here is wrapped so a
// blocked or missing one degrades to "show the boot again", never a crash.

const BOOT_SEEN_KEY = 'portfolio:bootSeen';

export const readBootSeen = (storage = globalThis.sessionStorage) => {
    try {
        return storage?.getItem(BOOT_SEEN_KEY) === '1';
    } catch {
        return false;
    }
};

export const markBootSeen = (storage = globalThis.sessionStorage) => {
    try {
        storage?.setItem(BOOT_SEEN_KEY, '1');
    } catch {
        // Storage blocked: the boot simply plays again next load.
    }
};

export const matchesMedia = (query) => {
    try {
        return globalThis.matchMedia?.(query).matches ?? false;
    } catch {
        return false;
    }
};

// Tailwind's `sm` breakpoint is 640px; below it the site shows its
// desktop-only notice instead.
export const isSmallScreen = () => matchesMedia('(max-width: 639px)');

export const prefersReducedMotion = () => matchesMedia('(prefers-reduced-motion: reduce)');

export const initialBootPhase = ({ bootSeen, smallScreen }) =>
    bootSeen || smallScreen ? 'desktop' : 'booting';
```

`src/store/system.js` — add the import:

```js
import { initialBootPhase, isSmallScreen, markBootSeen, readBootSeen } from '../lib/boot';
```

change `createInitialSystemState` to:

```js
export const createInitialSystemState = () => ({
  bootPhase: initialBootPhase({ bootSeen: readBootSeen(), smallScreen: isSmallScreen() }),
  missionControl: null,
});

// Desktop shortcuts (switcher, Mission Control, hot corner) only apply here.
export const isDesktopPhase = (state) => state.bootPhase === 'desktop';
```

update the comment above it to `// OS-level state that isn't about a single window: boot phase and Mission Control now; Spotlight, Control Center and audio in later phases.`, and add these actions after `switchToApp`:

```js
    finishBoot: () =>
      set((state) => {
        if (state.bootPhase === 'booting') state.bootPhase = 'locked';
      }),

    unlock: () => {
      if (get().bootPhase !== 'locked') return;

      markBootSeen();
      set((state) => {
        state.bootPhase = 'desktop';
      });
    },

    // Open windows are untouched; Mission Control is left so the overlay
    // isn't covering a stale grid when the desktop comes back.
    lock: () =>
      set((state) => {
        state.missionControl = null;
        state.bootPhase = 'locked';
      }),

    restart: () =>
      set((state) => {
        state.missionControl = null;
        state.bootPhase = 'booting';
      }),
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test`
Expected: PASS — 12 files, 116 tests (101 + 9 boot + 6 system).

- [ ] **Step 5: Commit**

```bash
git add src/lib/boot.js src/lib/boot.test.js src/store/system.js src/store/system.test.js
git commit -m "feat: boot phase state with session-scoped boot-seen flag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Boot screen, overlay rendering and shortcut guards

**Files:**
- Create: `src/components/system/BootScreen.jsx`
- Modify: `src/App.jsx`, `src/components/system/AppSwitcher.jsx`, `src/components/system/MissionControl.jsx`, `src/index.css`

**Interfaces:**
- Consumes: `useSystemStore` `bootPhase`, `finishBoot`; `isDesktopPhase`; `prefersReducedMotion`.
- Produces: `App.jsx` renders `<BootScreen />` while `bootPhase === 'booting'` (Task 3 adds `<LockScreen />` for `'locked'`). Overlays use z-index 200000 (above the switcher's 100000 and the hot corner's 100001).

- [ ] **Step 1: Create `src/components/system/BootScreen.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

import { prefersReducedMotion } from '../../lib/boot';
import useSystemStore from '../../store/system';

gsap.registerPlugin(DrawSVGPlugin);

// One continuous cursive stroke reading "hello" (viewBox 0 0 640 240).
// Hand-authored; replace with your own path if you like.
const HELLO_PATH = [
    'M 40 170 C 70 150, 110 90, 110 55 C 110 30, 85 30, 80 60 C 72 105, 70 150, 68 185',
    'C 80 140, 115 110, 130 125 C 142 138, 132 170, 140 182',
    'C 160 190, 200 160, 205 140 C 210 118, 180 118, 175 145 C 170 172, 195 190, 225 175',
    'C 255 155, 290 100, 288 60 C 286 30, 262 35, 262 70 C 262 110, 262 160, 280 182 C 290 190, 305 180, 315 165',
    'C 340 130, 362 95, 360 60 C 358 30, 334 35, 334 70 C 334 110, 334 160, 352 182 C 362 190, 378 180, 388 165',
    'C 400 140, 430 120, 450 135 C 470 150, 460 188, 432 188 C 408 188, 405 160, 420 140 C 432 126, 452 130, 470 135',
    'C 490 140, 510 130, 525 120',
].join(' ');

// Black screen that draws "hello", holds, and fades into the lock screen.
// Any click or key skips straight to the lock screen.
const BootScreen = () => {
    const rootRef = useRef(null);
    const pathRef = useRef(null);
    const finishBoot = useSystemStore((state) => state.finishBoot);

    useEffect(() => {
        const timeline = gsap.timeline({ onComplete: finishBoot });

        if (prefersReducedMotion()) {
            timeline
                .set(pathRef.current, { drawSVG: '100%' })
                .to(rootRef.current, { opacity: 0, duration: 0.4, delay: 0.8 });
        } else {
            timeline
                .fromTo(pathRef.current, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2.5, ease: 'power1.inOut' })
                .to(rootRef.current, { opacity: 0, duration: 0.5, delay: 0.5 });
        }

        const skip = () => {
            timeline.kill();
            finishBoot();
        };

        window.addEventListener('keydown', skip);

        return () => {
            window.removeEventListener('keydown', skip);
            timeline.kill();
        };
    }, [finishBoot]);

    return (
        <div ref={rootRef} className="boot-screen" onPointerDown={finishBoot}>
            <svg viewBox="0 0 640 240" aria-label="hello" role="img">
                <path
                    ref={pathRef}
                    d={HELLO_PATH}
                    fill="none"
                    stroke="white"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};

export default BootScreen;
```

- [ ] **Step 2: Render the overlay** — `src/App.jsx`

Add imports:

```js
import useSystemStore from "@store/system"
import BootScreen from "@components/system/BootScreen"
```

Add inside `App`, after the `fitToViewport` selector:

```js
  const bootPhase = useSystemStore((state) => state.bootPhase)
```

Render as the last child of `<main>` (after `<Analytics />`):

```jsx
      {bootPhase === "booting" && <BootScreen />}
```

- [ ] **Step 3: Ignore desktop shortcuts outside the desktop**

`src/components/system/AppSwitcher.jsx`: change the system-store import to `import useSystemStore, { isDesktopPhase } from '../../store/system';` and make `handleKeyDown` and `handleKeyUp` return early:

```js
        const handleKeyDown = (event) => {
            if (!isDesktopPhase(useSystemStore.getState())) return;

            dispatch({
                type: 'keydown',
                key: event.key,
                code: event.code,
                altKey: event.altKey,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
            }, event);
        };
        const handleKeyUp = (event) => {
            if (!isDesktopPhase(useSystemStore.getState())) return;

            dispatch({ type: 'keyup', key: event.key }, event);
        };
```

`src/components/system/MissionControl.jsx`: change the import to `import useSystemStore, { isDesktopPhase } from '../../store/system';`, add `if (!isDesktopPhase(useSystemStore.getState())) return;` as the first line of `handleKeyDown`, and in `handleHotCorner` change the first line to `if (!shouldOpenFromHotCorner(event) || !isDesktopPhase(useSystemStore.getState())) return;`.

- [ ] **Step 4: Styles** — append to `src/index.css` (outside every layer):

```css
/* Boot and lock overlays sit above everything, including the app switcher. */
.boot-screen {
  position: fixed;
  inset: 0;
  z-index: 200000;
  display: grid;
  place-items: center;
  background: #000;
  cursor: default;
}
.boot-screen svg {
  width: min(560px, 70vw);
  height: auto;
}
```

- [ ] **Step 5: Verify**

Run: `npm test` — Expected: PASS, 116 tests.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: `✖ 10 problems (10 errors, 0 warnings)`.
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

In Chrome (`npm run dev`, fresh tab or `sessionStorage.clear()` + reload):
- Black screen, "hello" draws over ~2.5s and reads as "hello" (screenshot mid-draw and at full draw; reshape `HELLO_PATH` if it doesn't read well), then fades.
- Until Task 3 lands, the phase ends at `'locked'` with no overlay — expected.
- Reload and press a key during the draw: it skips at once. Same for a click.
- During the boot, Ctrl+` and the top-right corner do nothing.
- Emulate `prefers-reduced-motion` (DevTools rendering) or check by `matchMedia` override: the word appears fully drawn and fades.

- [ ] **Step 6: Commit**

```bash
git add src/components/system/BootScreen.jsx src/App.jsx src/components/system/AppSwitcher.jsx src/components/system/MissionControl.jsx src/index.css
git commit -m "feat: hello boot screen; desktop shortcuts wait for the desktop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lock screen and welcome entrance

**Files:**
- Create: `src/components/system/LockScreen.jsx`
- Modify: `src/constants/index.js`, `src/App.jsx`, `src/components/Welcome.jsx`, `src/index.css`, `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes: `useSystemStore` `bootPhase`, `unlock`; `useClock` (`src/hooks/useClock.js`); `prefersReducedMotion`.
- Produces: `profile = { name: string, avatar: string | null }` exported from `src/constants/index.js`.

- [ ] **Step 1: Profile data** — in `src/constants/index.js`, add above the main `export { … }` block:

```js
// Shown on the lock screen. Put a photo in public/images and set `avatar` to
// its path (e.g. "/images/avatar.jpg"); until then the initials are shown.
const profile = {
    name: "Debaditya Barman",
    avatar: null,
};
```

and add `profile,` to the export block.

- [ ] **Step 2: Create `src/components/system/LockScreen.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import dayjs from 'dayjs';

import { profile } from '../../constants';
import useClock from '../../hooks/useClock';
import { prefersReducedMotion } from '../../lib/boot';
import useSystemStore from '../../store/system';

const initials = (name) =>
    name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

// Blurred desktop, clock, and the visitor's way in: any click or key slides
// the lock screen up and reveals the desktop.
const LockScreen = () => {
    const rootRef = useRef(null);
    const unlock = useSystemStore((state) => state.unlock);
    const now = useClock();

    useEffect(() => {
        const root = rootRef.current;
        let leaving = false;

        const leave = () => {
            if (leaving) return;
            leaving = true;

            gsap.to(root, prefersReducedMotion()
                ? { opacity: 0, duration: 0.3, onComplete: unlock }
                : { yPercent: -100, opacity: 0, duration: 0.6, ease: 'power3.inOut', onComplete: unlock });
        };

        window.addEventListener('keydown', leave);
        root.addEventListener('pointerdown', leave);

        return () => {
            window.removeEventListener('keydown', leave);
            root.removeEventListener('pointerdown', leave);
            gsap.killTweensOf(root);
        };
    }, [unlock]);

    return (
        <div ref={rootRef} className="lock-screen">
            <div className="lock-clock">
                <p className="lock-date">{dayjs(now).format('dddd, MMMM D')}</p>
                <p className="lock-time">{dayjs(now).format('h:mm')}</p>
            </div>

            <div className="lock-user">
                <div className="lock-avatar">
                    {profile.avatar
                        ? <img src={profile.avatar} alt="" />
                        : initials(profile.name)}
                </div>
                <p className="lock-name">{profile.name}</p>
                <p className="lock-hint">Click or press any key to enter</p>
            </div>
        </div>
    );
};

export default LockScreen;
```

- [ ] **Step 3: Render it** — in `src/App.jsx` add `import LockScreen from "@components/system/LockScreen"` and, after the BootScreen line:

```jsx
      {bootPhase === "locked" && <LockScreen />}
```

- [ ] **Step 4: Welcome text animates in on unlock** — in `src/components/Welcome.jsx`:

Add the import after the `useGSAP` import:

```js
import useSystemStore from '../store/system'
```

Add inside `Welcome`, after the refs:

```js
    const bootPhase = useSystemStore((state) => state.bootPhase)
    const previousPhaseRef = useRef(bootPhase)

    // Letters rise in when the visitor arrives at the desktop from the lock screen.
    useGSAP(() => {
        const entering = bootPhase === 'desktop' && previousPhaseRef.current !== 'desktop'
        previousPhaseRef.current = bootPhase

        if (!entering) return

        const letters = [titleRef.current, subtitleRef.current]
            .flatMap((element) => [...element.querySelectorAll('span')])

        gsap.from(letters, { opacity: 0, y: 24, duration: 0.6, stagger: 0.02, ease: 'power3.out', delay: 0.15 })
    }, { dependencies: [bootPhase] })
```

- [ ] **Step 5: Styles** — append to `src/index.css` (outside every layer):

```css
.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 200000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 10vh 0 9vh;
  color: white;
  background: rgb(0 0 0 / 0.25);
  backdrop-filter: blur(40px) saturate(1.2);
  user-select: none;
  cursor: default;
}
.lock-clock {
  text-align: center;
}
.lock-date {
  font-size: 22px;
  font-weight: 500;
}
.lock-time {
  font-size: clamp(72px, 12vw, 140px);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
}
.lock-user {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.lock-avatar {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.2);
  font-size: 26px;
  font-weight: 600;
}
.lock-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lock-name {
  font-size: 15px;
  font-weight: 600;
}
.lock-hint {
  font-size: 13px;
  animation: lock-hint-pulse 2s ease-in-out infinite;
}
@keyframes lock-hint-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.85; }
}
```

- [ ] **Step 6: Document**

In `CLAUDE.md`, extend the `src/store/system.js` bullet: replace `(Mission Control now; boot phase, Spotlight, Control Center and audio in later phases)` with `(boot phase and Mission Control now; Spotlight, Control Center and audio in later phases)`, and add after that bullet:

```markdown
- **Boot sequence:** `bootPhase` goes `booting → locked → desktop`. `App.jsx` renders `BootScreen`/`LockScreen` as overlays (z 200000) over the already-mounted desktop. A `sessionStorage` flag set on unlock makes same-tab refreshes skip to the desktop; small screens skip it entirely (`src/lib/boot.js`). Desktop shortcuts check `isDesktopPhase()` first. `restart()`/`lock()` exist for the Apple menu (Phase 6). To see the boot again during development, run `sessionStorage.clear()` and reload.
```

In `AGENTS.md`, under `### Window Management`, append:

```markdown
Anything that reacts to global keys or pointer position must check `isDesktopPhase(useSystemStore.getState())`, so it stays inert during the boot and lock screens.
```

- [ ] **Step 7: Verify**

Run: `npm test` — Expected: PASS, 116 tests.
Run: `npx eslint . --ignore-pattern .superpowers 2>&1 | tail -2` — Expected: `✖ 10 problems (10 errors, 0 warnings)`.
Run: `npm run build 2>&1 | grep -E "error|built in"` — Expected: `✓ built in …`.

In Chrome (`sessionStorage.clear()` + reload):
- hello → fade → lock screen: blurred desktop, date, large time, "DB" avatar, name, pulsing hint.
- Skipping the boot with a key lands on the lock screen and does not also unlock it.
- A click (or key) slides the lock screen up; the welcome letters rise in.
- Reload: straight to the desktop, no boot.
- With windows open, calling `lock()` then unlocking, and `restart()` then skipping through, leaves windows exactly where they were.
- During the lock screen, Ctrl+` and Ctrl+↑ do nothing.

- [ ] **Step 8: Commit**

```bash
git add src/components/system/LockScreen.jsx src/constants/index.js src/App.jsx src/components/Welcome.jsx src/index.css CLAUDE.md AGENTS.md
git commit -m "feat: lock screen with live clock and avatar; welcome text animates in

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
