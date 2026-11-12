# iPhone-style Phone View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under 640px the portfolio becomes an iPhone-style UI with the same content and system features as the macOS desktop, and from 640px up every window opens fully on screen.

**Architecture:** `App.jsx` renders either the existing desktop shell or a new phone shell (`src/phone/`), chosen live by one media query. The phone shell reuses the stores, data hooks and pure libs; open apps stay in the window store (going home = minimizing every visible window, the front app = the focused visible window), and the sheets reuse `spotlightOpen`, `controlCenterOpen` and `missionControl`. Logic that sits inside desktop components today (Safari's tab wiring, the resume fetch, the contact links) moves into shared hooks/constants first, so nothing is copied.

**Tech Stack:** React 19, Vite 7, Tailwind 4 (desktop) + one plain scoped stylesheet (phone), GSAP, Zustand + Immer, Vitest, `pdfjs-dist` (new, lazy, phone Resume only).

**Spec:** `docs/superpowers/specs/2026-11-12-iphone-phone-view-design.md` — read it before any task; this plan does not repeat its screen descriptions.

## Global Constraints

- Branch: `feat/phone-view`. One commit per task, message style `feat: …` / `refactor: …` / `fix: …`.
- Phone mode: `(max-width: 639px), (pointer: coarse) and (max-height: 499px)`. 640px and up is the unchanged macOS desktop.
- The desktop must not change in look or behaviour except Part 2's window fitting. `WindowWrapper`, the desktop windows' markup and their `#id` CSS are not edited (the three logic extractions in Tasks 7, 8 and 10 change imports and hooks only).
- Nothing on the phone is reachable by swipe alone; every gesture has the tap listed in the spec's Gestures table.
- Phone apps are dark: near-black background, white text, `#0a84ff` for actions, system font stack.
- Phone styles live in `src/phone/phone.css`, plain CSS (no `@apply`), every selector under `#phone` or `.phone-lock`. Unlayered rules beat `index.css`'s `@layer base` / `@layer components`; still, read the `@layer base` block first and do not rely on bare `nav`, `ul`, `time` or `main` looking unstyled.
- Pointer events only (no touch events), so a mouse in a narrow desktop window drives the phone UI.
- GSAP is the only animation library. Every animation has a reduced-motion variant (`prefersReducedMotion()` from `src/lib/boot.js`): a fade or nothing.
- Only new dependency: `pdfjs-dist`, loaded by dynamic import from the phone Resume; it must not land in the entry chunk.
- No new sound files. Opening, closing and leaving a phone app are silent.
- No changes to `/admin`, Supabase tables or policies, or `proxy/`.
- Do not use `locations` or `socials` from `src/constants/index.js`: both are unused template sample data.
- Tests cover pure logic only and never import a component or `src/lib/supabase.js`. `npm test` must be green after every task; `npx eslint . --ignore-pattern .superpowers` must show only the 7 known errors.
- UI is verified in `npm run dev` with the browser's device toolbar at 390×844 with touch emulation on. To replay the boot: `sessionStorage.clear()` and reload.
- Follow `AGENTS.md` (naming, import order, the `Loader2` / `AlertTriangle` / `RefreshCw` loading-state idiom).

## Review Focus

1. **Opening an app from Spotlight or a banner while another app is in front, then going home.** Expected: the home screen shows, both apps are in the switcher, neither lost its state. (Test: Task 3, `phone.test.js` "goes home with two apps visible".)
2. **Resizing across 640px with apps open on the phone.** Expected: the desktop comes back with those apps as dock tiles or sanely sized windows, never a 390px-wide sliver or an off-screen window. (Test: Task 3, `window.test.js` "resetLayout".)
3. **A touch that barely moves, or moves sideways, on the Home bar or lock screen.** Expected: a tap, not a swipe; a sideways drag does nothing. (Tests: Task 4, `gestures.test.js`.)
4. **The resume PDF fails to load or render (offline, blocked worker, corrupt file).** Expected: an error state with Retry, and the Download button still works. (Verification step in Task 8.)
5. **Lock or Restart pressed with a sheet and an app open, music playing.** Expected: the phone lock screen with every sheet closed; music continues on Lock and stops on Restart; unlocking returns to the same app. (Test: Task 3, `system.test.js` "goHome closes sheets"; verification step in Task 13.)

---

## File Structure

```
src/lib/bounds.js            + fitOnScreen                         (Task 1)
src/lib/boot.js              PHONE_QUERY, new boot rule            (Task 2)
src/hooks/useMediaQuery.js   live media query                      (Task 2)
src/constants/apps.js        phone placement + derived lists       (Task 3)
src/lib/phone.js             front app, recents, Spotlight relabel (Task 3)
src/store/system.js          + goHome                              (Task 3)
src/store/window.js          fitOnScreen paths, + resetLayout      (Tasks 1, 3)
src/lib/soundCues.js         phone option                          (Task 3)
src/lib/gestures.js          pure gesture classification           (Task 4)
src/phone/useGesture.js      pointer tracking hook                 (Task 4)
src/phone/phone.css          all phone styles
src/phone/PhoneShell.jsx     root, mounts everything below
src/phone/StatusBar.jsx  HomeBar.jsx  HomeScreen.jsx  PhoneLockScreen.jsx  RotateCard.jsx   (Task 5)
src/phone/AppScreen.jsx      shared app chrome + open/close animation                      (Task 6)
src/phone/apps/index.js      PHONE_APPS: registry id → component                           (Task 6)
src/phone/apps/ContactApp.jsx AboutApp.jsx SkillsApp.jsx           (Task 6)
src/phone/apps/ProjectsApp.jsx                                     (Task 7)
src/hooks/useResume.js  src/phone/apps/ResumeApp.jsx  PdfPages.jsx (Task 8)
src/lib/volumeSupport.js  src/phone/apps/MusicApp.jsx              (Task 9)
src/hooks/useBrowserTabs.js                                        (Task 10)
src/phone/apps/SafariApp.jsx                                       (Task 11)
src/phone/PhoneSpotlight.jsx                                       (Task 12)
src/phone/PhoneControlCenter.jsx                                   (Task 13)
src/phone/PhoneSwitcher.jsx  PhoneBanner.jsx                       (Task 14)
```

---

### Task 1: Windows open fully on screen (spec Part 2)

**Files:**
- Modify: `src/lib/bounds.js`, `src/store/window.js`
- Test: `src/lib/bounds.test.js`, `src/store/window.test.js`

**Interfaces:**
- Produces: `SCREEN_MARGIN = 12` and `fitOnScreen(bounds: {x,y,w,h}, minSize: {w,h}, viewport: {width,height}) → {x,y,w,h}` exported from `src/lib/bounds.js`.

- [ ] **Step 1: Write the failing tests** in `src/lib/bounds.test.js`

```js
describe('fitOnScreen', () => {
    const laptop = { width: 1280, height: 800 };
    const min = { w: 400, h: 360 };

    it('moves a window that hangs off the right edge back on screen', () => {
        expect(fitOnScreen({ x: 700, y: 64, w: 700, h: 600 }, min, laptop)).toEqual({ x: 568, y: 64, w: 700, h: 600 });
    });
    it('leaves a window alone when it is already fully on screen', () => {
        expect(fitOnScreen({ x: 100, y: 100, w: 400, h: 400 }, min, laptop)).toEqual({ x: 100, y: 100, w: 400, h: 400 });
    });
    it('shrinks a window larger than the area between menu bar and dock', () => {
        expect(fitOnScreen({ x: 200, y: 70, w: 1000, h: 680 }, { w: 480, h: 360 }, { width: 1024, height: 768 }))
            .toEqual({ x: 12, y: 52, w: 1000, h: 584 });
    });
    it('takes the whole area when the screen is smaller than the minimum size', () => {
        expect(fitOnScreen({ x: 240, y: 90, w: 900, h: 560 }, { w: 640, h: 400 }, { width: 700, height: 500 }))
            .toEqual({ x: 12, y: 52, w: 676, h: 316 });
    });
    it('raises a too-small window to its minimum size', () => {
        expect(fitOnScreen({ x: 100, y: 100, w: 200, h: 100 }, min, laptop)).toEqual({ x: 100, y: 100, w: 400, h: 360 });
    });
    it('pulls a window in from beyond the left and top edges', () => {
        expect(fitOnScreen({ x: -300, y: 10, w: 400, h: 400 }, min, laptop)).toEqual({ x: 12, y: 52, w: 400, h: 400 });
    });
});
```

- [ ] **Step 2: Run** `npm test -- src/lib/bounds.test.js` — expected: FAIL, `fitOnScreen` is not exported.

- [ ] **Step 3: Implement `fitOnScreen`** in `src/lib/bounds.js`. The area is `x ∈ [SCREEN_MARGIN, width − SCREEN_MARGIN]`, `y ∈ [MENU_BAR_HEIGHT + SCREEN_MARGIN, height − DOCK_RESERVE − SCREEN_MARGIN]`. Size first (`max` with `minSize`, then `min` with the area), then clamp the position so the whole rectangle is inside.

- [ ] **Step 4: Run the bounds tests** — expected: PASS.

- [ ] **Step 5: Use it in the store.** In `src/store/window.js` add `const fitOpen = (key, bounds) => fitOnScreen(bounds, getApp(key).minSize, getViewport())` and use it in `openWindow`, the un-zoom branch of `toggleMaximize`, and `fitToViewport`; make `restoreWindow` also set `window.bounds = fitOpen(key, window.bounds ?? getApp(key).defaultBounds)` unless the window is maximized. `setBounds` (drag and resize) keeps `clampBounds`.

- [ ] **Step 6: Store tests.** Add to `src/store/window.test.js` (stub the viewport the way the file's existing tests do):

```js
it('opens a window fully on screen on a laptop-sized viewport', () => {
    // viewport 1280×800
    store().openWindow('resume');
    expect(store().windows.resume.bounds).toEqual({ x: 568, y: 64, w: 700, h: 600 });
});
it('still lets a drag push a window mostly off screen', () => {
    store().openWindow('contact');
    store().setBounds('contact', { x: 1250, y: 300, w: 600, h: 350 });
    expect(store().windows.contact.bounds.x).toBe(1200); // viewport.width − MIN_VISIBLE
});
```

Update any existing expectation in this file that encoded the old "80px visible" rule for open/restore/un-zoom/`fitToViewport`.

- [ ] **Step 7: Run** `npm test` — expected: all PASS.

- [ ] **Step 8: Verify in the browser.** `npm run dev`; at 1280×800, 1024×768 and 768×1024 open all seven windows (Projects, Contact, Skills, Resume, Safari, Music, Apple menu → About This Mac): each is entirely between the menu bar and the dock. Drag one half off the right edge: it stays there. Close and reopen it: it comes back fully on screen. At 640px and 768px wide the menu bar items and the dock do not overflow; if they do, fix the overflow with the smallest CSS change (no redesign) and note it in the commit.

- [ ] **Step 9: Commit** — `fix: windows always open fully on screen`.

---

### Task 2: Phone mode query and the new boot rule

**Files:**
- Modify: `src/lib/boot.js`, `src/store/system.js` (the `createInitialSystemState` call), `index.html`
- Create: `src/hooks/useMediaQuery.js`
- Test: `src/lib/boot.test.js`, `src/lib/bootShell.test.js`

**Interfaces:**
- Produces from `src/lib/boot.js`: `PHONE_QUERY = '(max-width: 639px), (pointer: coarse) and (max-height: 499px)'`, `PHONE_LANDSCAPE_QUERY = '(pointer: coarse) and (max-height: 499px) and (orientation: landscape)'`, `isPhoneScreen() → boolean`, `initialBootPhase({ bootSeen }) → 'desktop' | 'booting'`. `SMALL_SCREEN_QUERY` and `isSmallScreen` are deleted.
- Produces: `useMediaQuery(query: string) → boolean` (default export of `src/hooks/useMediaQuery.js`), live via `useSyncExternalStore` over `matchMedia(query)`'s `change` event, `false` when `matchMedia` is missing.

- [ ] **Step 1: Change the tests.** In `boot.test.js` replace "never boots on small screens" with:

```js
it('boots on a first visit on any screen size', () => {
    expect(initialBootPhase({ bootSeen: false })).toBe('booting');
});
it('reports phone mode from the phone media query', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query === PHONE_QUERY }));
    expect(isPhoneScreen()).toBe(true);
});
```

In `bootShell.test.js` drop the `SMALL_SCREEN_QUERY` import and expectation and add `expect(head).not.toContain('matchMedia');`.

- [ ] **Step 2: Run** `npm test -- src/lib/boot.test.js src/lib/bootShell.test.js` — expected: FAIL.

- [ ] **Step 3: Implement.** Edit `boot.js` as in Interfaces. In `index.html` the inline script becomes `if (!bootSeen) document.documentElement.classList.add('booting');` and the viewport meta becomes `width=device-width, initial-scale=1.0, viewport-fit=cover`. In `system.js` call `initialBootPhase({ bootSeen: readBootSeen() })`. Write `useMediaQuery`.

- [ ] **Step 4: Run** `npm test` — expected: PASS (fix any other importer of the deleted names).

- [ ] **Step 5: Commit** — `feat: phone mode query; boot plays on every screen size`. (Until Task 5 a phone shows the boot and then the old desktop-only notice; that is expected mid-plan.)

---

### Task 3: Registry placement, phone state, go-home, layout reset, sound rule

**Files:**
- Modify: `src/constants/apps.js`, `src/store/system.js`, `src/store/window.js`, `src/lib/soundCues.js`, `src/components/system/SoundEffects.jsx`
- Create: `src/lib/phone.js`
- Test: `src/constants/apps.test.js`, `src/lib/phone.test.js`, `src/store/system.test.js`, `src/store/window.test.js`, `src/lib/soundCues.test.js`

**Interfaces:**
- Registry field on app entries: `phone: { place: 'dock' | 'grid', order: number, label?: string }`. Values: finder dock 1, safari dock 2, music dock 3, contact dock 4, resume grid 1, terminal grid 2, about grid 3 with `label: 'About'`. `missionControl` and `trash` get none.
- Produces from `apps.js`: `phoneDockApps`, `phoneGridApps` (arrays of `{ id, name, icon }`, sorted by `order`, `name = phone.label ?? title`, `icon = app.icon`), and `phoneRegistry` (the registry entries that have `phone`, with `title` replaced by the phone name; passed to `buildSpotlightIndex({ apps })`).
- Produces from `src/lib/phone.js`: `foregroundApp(windowState) → id | null` (`focusedId` if that window is open and not minimized, else `null`), `recentApps(windowState) → id[]` (every open window, minimized or not, highest `zIndex` first), `phoneSpotlightEntries(entries) → entries` (drops entries whose `action.type === 'missionControl'`; replaces the subtitle `'Show in Finder'` with `'Show in Projects'`).
- Produces in the system store: `goHome()` — sets `spotlightOpen = false`, `controlCenterOpen = false`, `missionControl = null`, then calls `minimizeWindow` for every open, non-minimized window.
- Produces in the window store: `resetLayout()` — for every window: `isMaximized = false`, `prevBounds = null`, `originRect = null`, `bounds = isOpen ? fitOnScreen(defaultBounds, minSize, viewport) : null`. `minimizedStack` and `isMinimized` are untouched.
- Changes: `soundCues(previous, next, { phone = false } = {})` — with `phone: true` the `minimize` and `restore` cues are never returned. `SoundEffects` passes `{ phone: isPhoneScreen() }`.

- [ ] **Step 1: Write the failing tests**

```js
// apps.test.js
it('derives the phone dock and grid in their own order with phone labels', () => {
    expect(phoneDockApps.map((app) => app.id)).toEqual(['finder', 'safari', 'music', 'contact']);
    expect(phoneGridApps.map((app) => [app.id, app.name])).toEqual([['resume', 'Resume'], ['terminal', 'Skills'], ['about', 'About']]);
    expect(phoneDockApps[0]).toEqual({ id: 'finder', name: 'Projects', icon: '/images/finder.png' });
});
it('leaves launchers without a window off the phone', () => {
    expect(phoneRegistry.map((app) => app.id)).not.toContain('trash');
    expect(phoneRegistry.map((app) => app.id)).not.toContain('missionControl');
    expect(phoneRegistry.find((app) => app.id === 'about').title).toBe('About');
});

// phone.test.js — reset both stores in beforeEach the way system.test.js does
it('puts the last opened app in front and lists recents newest first', () => {
    windows().openWindow('finder'); windows().openWindow('safari');
    expect(foregroundApp(windows())).toBe('safari');
    expect(recentApps(windows())).toEqual(['safari', 'finder']);
});
it('goes home with two apps visible, keeping both in recents', () => {
    windows().openWindow('finder'); windows().openWindow('safari');
    system().goHome();
    expect(foregroundApp(windows())).toBeNull();
    expect(recentApps(windows())).toEqual(['safari', 'finder']);
    expect(windows().windows.finder.isOpen).toBe(true);
});
it('brings a recent app back to the front', () => {
    windows().openWindow('finder'); windows().openWindow('safari'); system().goHome();
    system().switchToApp('finder');
    expect(foregroundApp(windows())).toBe('finder');
    expect(recentApps(windows())).toEqual(['finder', 'safari']);
});
it('returns home when the only visible app is closed', () => {
    windows().openWindow('finder'); system().goHome(); windows().openWindow('music');
    windows().closeWindow('music');
    expect(foregroundApp(windows())).toBeNull();
    expect(recentApps(windows())).toEqual(['finder']);
});
it('relabels and filters Spotlight entries for the phone', () => {
    const entries = [
        { id: 'a', subtitle: 'Show in Finder', action: { type: 'openApp', id: 'finder' } },
        { id: 'b', subtitle: 'App', action: { type: 'missionControl' } },
    ];
    expect(phoneSpotlightEntries(entries)).toEqual([{ id: 'a', subtitle: 'Show in Projects', action: { type: 'openApp', id: 'finder' } }]);
});

// system.test.js
it('goHome closes sheets', () => {
    unlockToDesktop(); // however this file reaches bootPhase 'desktop'
    system().openSpotlight(); system().goHome();
    expect(system().spotlightOpen).toBe(false);
    system().openControlCenter(); system().goHome();
    expect(system().controlCenterOpen).toBe(false);
    system().openMissionControl(); system().goHome();
    expect(system().missionControl).toBeNull();
});

// window.test.js — viewport 1280×800
it('resetLayout gives open windows fresh on-screen bounds and clears zoom', () => {
    store().openWindow('resume'); store().toggleMaximize('resume');
    store().setBounds('resume', { x: 0, y: 40, w: 390, h: 700 });
    store().openWindow('finder'); store().minimizeWindow('finder');
    store().resetLayout();
    expect(store().windows.resume).toMatchObject({ isMaximized: false, prevBounds: null, bounds: { x: 568, y: 64, w: 700, h: 600 } });
    expect(store().windows.finder.isMinimized).toBe(true);
    expect(store().windows.contact.bounds).toBeNull();
});

// soundCues.test.js
it('never plays minimize or restore on the phone', () => {
    const base = { bootPhase: 'desktop', spotlightOpen: false, notificationIds: [], minimized: [], visible: ['finder'] };
    const home = { ...base, minimized: ['finder'], visible: [] };
    expect(soundCues(base, home, { phone: true })).toEqual([]);
    expect(soundCues(home, base, { phone: true })).toEqual([]);
    expect(soundCues(base, { ...base, spotlightOpen: true }, { phone: true })).toEqual(['spotlight']);
});
```

- [ ] **Step 2: Run** `npm test` — expected: the new tests FAIL.
- [ ] **Step 3: Implement** everything in Interfaces.
- [ ] **Step 4: Run** `npm test` — expected: all PASS.
- [ ] **Step 5: Commit** — `feat: phone app placement, go-home and phone state helpers`.

---

### Task 4: Gesture classification and the pointer hook

**Files:**
- Create: `src/lib/gestures.js`, `src/phone/useGesture.js`
- Test: `src/lib/gestures.test.js`

**Interfaces:**
- A **gesture sample** is `{ startX, startY, dx, dy, dt, restMs }`: start point in viewport px, total movement, total duration in ms, and ms since the pointer last moved more than 2px (0 while moving).
- Produces from `src/lib/gestures.js`: constants `TAP_SLOP = 10`, `SWIPE_DISTANCE = 48`, `FLICK_DISTANCE = 16`, `FLICK_VELOCITY = 0.5` (px/ms), `LONG_PRESS_MS = 500`, `HOLD_MS = 250`, `SWITCHER_FRACTION = 1 / 3`, `STATUS_BAR_ZONE = 48`; and
  - `swipeDirection({ dx, dy, dt }) → 'up' | 'down' | 'left' | 'right' | null` — the dominant axis, if it moved at least `SWIPE_DISTANCE`, or at least `FLICK_DISTANCE` at `FLICK_VELOCITY` or faster; otherwise `null`.
  - `homeBarGesture(sample, viewportHeight) → 'home' | 'switcher' | null` — within `TAP_SLOP`: `'switcher'` if `dt ≥ LONG_PRESS_MS`, else `'home'`. An upward swipe: `'switcher'` if `−dy ≥ viewportHeight × SWITCHER_FRACTION` or `restMs ≥ HOLD_MS`, else `'home'`. Anything else: `null`.
  - `pullDownTarget({ startX, startY }, viewportWidth) → 'controlCenter' | 'spotlight'` — `'controlCenter'` when `startY ≤ STATUS_BAR_ZONE` and `startX ≥ viewportWidth × 2 / 3`.
- Produces: `useGesture(ref, { onMove?, onEnd?, onCancel? })` from `src/phone/useGesture.js` — pointer events with pointer capture on `ref.current`; calls `onMove(sample)` during the drag and `onEnd(sample)` on release, `onCancel()` on `pointercancel`. No classification inside the hook.

- [ ] **Step 1: Write the failing tests**

```js
describe('swipeDirection', () => {
    it('reads a long drag by its dominant axis', () => {
        expect(swipeDirection({ dx: 5, dy: -60, dt: 300 })).toBe('up');
        expect(swipeDirection({ dx: 70, dy: 20, dt: 200 })).toBe('right');
        expect(swipeDirection({ dx: -4, dy: 90, dt: 400 })).toBe('down');
    });
    it('reads a short fast flick', () => {
        expect(swipeDirection({ dx: 0, dy: -20, dt: 30 })).toBe('up');
    });
    it('ignores a touch that barely moved, however fast', () => {
        expect(swipeDirection({ dx: 3, dy: 4, dt: 80 })).toBeNull();
        expect(swipeDirection({ dx: 0, dy: -12, dt: 10 })).toBeNull();
    });
});
describe('homeBarGesture', () => {
    const at = (sample) => homeBarGesture({ startX: 195, startY: 830, dx: 0, restMs: 0, ...sample }, 844);
    it('goes home on a tap or a short swipe up', () => {
        expect(at({ dy: -2, dt: 120 })).toBe('home');
        expect(at({ dy: -80, dt: 200, restMs: 20 })).toBe('home');
    });
    it('opens the switcher on a long press, a held swipe or a long drag', () => {
        expect(at({ dy: 0, dt: 600 })).toBe('switcher');
        expect(at({ dy: -120, dt: 700, restMs: 300 })).toBe('switcher');
        expect(at({ dy: -300, dt: 300 })).toBe('switcher');
    });
    it('ignores downward and sideways drags', () => {
        expect(at({ dy: 60, dt: 200 })).toBeNull();
        expect(at({ dx: 90, dy: -10, dt: 200 })).toBeNull();
    });
});
describe('pullDownTarget', () => {
    it('opens Control Center only from the top-right corner', () => {
        expect(pullDownTarget({ startX: 300, startY: 20 }, 390)).toBe('controlCenter');
        expect(pullDownTarget({ startX: 100, startY: 20 }, 390)).toBe('spotlight');
        expect(pullDownTarget({ startX: 300, startY: 200 }, 390)).toBe('spotlight');
    });
});
```

- [ ] **Step 2: Run** `npm test -- src/lib/gestures.test.js` — expected: FAIL.
- [ ] **Step 3: Implement** `gestures.js`, then `useGesture.js`.
- [ ] **Step 4: Run** `npm test` — expected: PASS.
- [ ] **Step 5: Commit** — `feat: gesture classification and pointer hook`.

---

### Task 5: Phone shell — mode switch, lock screen, home screen

**Files:**
- Create: `src/phone/PhoneShell.jsx`, `StatusBar.jsx`, `HomeBar.jsx`, `HomeScreen.jsx`, `PhoneLockScreen.jsx`, `RotateCard.jsx`, `phone.css` (all in `src/phone/`)
- Modify: `src/App.jsx`, `src/components/Welcome.jsx`, `src/components/system/Notifications.jsx`, `src/components/system/BootScreen.jsx` (only if it overflows at 390px), `src/index.css`

**Interfaces:**
- Consumes: `useMediaQuery`, `PHONE_QUERY`, `PHONE_LANDSCAPE_QUERY` (Task 2); `phoneDockApps`, `phoneGridApps`, `goHome`, `foregroundApp`, `resetLayout` (Task 3); `useGesture`, `swipeDirection`, `homeBarGesture`, `pullDownTarget`, `TAP_SLOP` (Task 4); `toRect` from `src/lib/bounds.js`; `profile`, `welcomeNotifications` from constants; `initialsOf`; `useClock`.
- Produces: `<PhoneShell />` (default export) rendering `<div id="phone">`; `<StatusBar />`; `<HomeBar onHome onSwitcher />`; home icons carry `data-phone-app={id}` and open with `openWindow(id, null, toRect(icon.getBoundingClientRect()))`. Later tasks mount their pieces inside `PhoneShell`.

- [ ] **Step 1: Switch shells in `App.jsx`.** `const phone = useMediaQuery(PHONE_QUERY)`. Render the existing desktop tree (Navbar through `DesktopContextMenu`) only when `!phone`, `<PhoneShell />` when `phone`. Always mounted, outside the switch: `SoundEffects`, `AudioController`, `DisplayDimmer`, `Analytics`, the boot overlay, and the lock overlay (`<PhoneLockScreen />` on the phone, `<LockScreen />` otherwise). Move the `useWelcomeNotifications()` call from `Notifications.jsx` into `App`. When `phone` turns from `true` to `false`, call `resetLayout()` once.

- [ ] **Step 2: Remove the desktop-only notice.** Delete the `.small-screen` markup in `Welcome.jsx` and its CSS, and every `max-sm:` utility in `src/index.css` (`nav`, `#welcome`, `#dock`, `#home`); the desktop is no longer rendered below 640px. Fix the now-wrong "small screens" comments in `Welcome.jsx` and `boot.js`.

- [ ] **Step 3: `phone.css` foundation.** `#phone`: `position: fixed; inset: 0; height: 100dvh; overflow: hidden; overscroll-behavior: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;` wallpaper background, system font stack. Scrollable regions inside opt back in with `touch-action: pan-y` and `overscroll-behavior: contain`. Padding from `env(safe-area-inset-top / bottom / left / right)`. While `#phone` is mounted, `html, body { overflow: hidden; overscroll-behavior: none; }` (toggle a class on `<html>` from `PhoneShell`).

- [ ] **Step 4: `StatusBar`.** Live clock left (`useClock`, `h:mm`), decorative signal / Wi-Fi / battery glyphs right. Height 44px plus the top safe area. The right third is a button, `aria-label="Control Center"`; it calls `toggleControlCenter()` on tap and `openControlCenter()` when `useGesture` ends with `swipeDirection === 'down'`.

- [ ] **Step 5: `HomeBar`.** A `<button aria-label="Home">` whose visible bar is 134×5px and whose touch area is the full width × 34px, placed above `env(safe-area-inset-bottom)`. On `useGesture` end: `homeBarGesture(sample, window.innerHeight)` → `'home'` calls `onHome`, `'switcher'` calls `onSwitcher`. `PhoneShell` passes `onHome = goHome` and `onSwitcher = openMissionControl` (the switcher UI arrives in Task 14).

- [ ] **Step 6: `PhoneLockScreen`.** Root `.phone-lock` at the same z-index the desktop lock uses (200000). Shows: date as `dddd, MMMM D` (dayjs), clock as `h:mm`, one card styled as a notification with the icon, title and body of `welcomeNotifications[0]`, the hint `Swipe up or tap to open`, and a decorative Home bar. The screen follows the finger upward during a drag. On release: `swipeDirection === 'up'` or movement within `TAP_SLOP` → slide the screen up and away (0.45s, reduced motion: 0.3s fade), then `unlock()`; otherwise spring back. Any `keydown` also unlocks. Only reacts while `bootPhase === 'locked'`, like the desktop `LockScreen`.

- [ ] **Step 7: `HomeScreen`.** Per spec section 3: intro card (avatar or `initialsOf(profile.name)`, `profile.name`, the line `Hey, I'm Debaditya! Welcome to my portfolio.`, buttons **Resume** → `openWindow('resume')` and **Contact** → `openWindow('contact')`), the four-column grid from `phoneGridApps`, a search pill (`aria-label="Search"`, text `Search`) → `openSpotlight()`, and the dock from `phoneDockApps`. A downward swipe on the home screen that starts outside buttons: `pullDownTarget(sample, window.innerWidth)` → `openControlCenter()` or `openSpotlight()`. Icons are `<button>`s with the app name as visible label.

- [ ] **Step 8: `RotateCard`.** Shown when `useMediaQuery(PHONE_LANDSCAPE_QUERY)`: full-screen, above everything in `#phone`, text `Rotate your phone`.

- [ ] **Step 9: `PhoneShell`** assembles `StatusBar`, `HomeScreen`, `HomeBar`, `RotateCard`, and gives `HomeScreen` the `inert` attribute while `foregroundApp` is not `null`.

- [ ] **Step 10: Verify.** `npm test`, eslint baseline. In the browser at 390×844 after `sessionStorage.clear()`: hello plays on black with no wallpaper flash → lock screen with today's date → unlock by swipe up; reload after clearing and unlock by tap; again by a key. The home screen matches the spec; the page does not scroll, bounce or select text; no red notice. Tapping an icon does nothing visible yet (apps arrive next) but `useWindowStore.getState().focusedId` in the console is the app id, and tapping the Home bar sets it back to `null`. At 1440×900 the desktop is unchanged, and the two welcome banners still arrive after unlock. Drag the browser from 1440 to 390 wide and back: each shell appears, no console errors.

- [ ] **Step 11: Commit** — `feat: phone shell with lock screen and home screen`.

---

### Task 6: App chrome and the three simple apps

**Files:**
- Create: `src/phone/AppScreen.jsx`, `src/phone/apps/index.js`, `ContactApp.jsx`, `AboutApp.jsx`, `SkillsApp.jsx` (in `src/phone/apps/`)
- Modify: `src/phone/PhoneShell.jsx`, `src/phone/phone.css`, `src/constants/index.js`, `src/windows/Contact.jsx`

**Interfaces:**
- Consumes: `recentApps`, `foregroundApp`, `goHome`; `windows[id].originRect` (`{x,y,w,h}`) set by the home icons.
- Produces: `<AppScreen title back? onBack? toolbar? flush?>{children}</AppScreen>` — the dark chrome inside an app: a large title, an optional back link rendered as `‹ {back}` (a `<button>`), a scrolling content area (`touch-action: pan-y`), an optional `toolbar` node pinned above the Home bar; `flush` removes the title and content padding (Safari, Now Playing).
- Produces: `PHONE_APPS` from `src/phone/apps/index.js`: `{ [registryId]: Component }`. Tasks 7–11 add `finder`, `resume`, `music`, `safari`. An id missing from the map renders an `AppScreen` with the app's name and the text `Coming soon` until its task lands.
- Produces from `src/constants/index.js`: `contactLinks = [{ id: 'github', name: 'Github', link: 'https://github.com/Winniper' }, { id: 'linkedin', name: 'LinkedIn', link: 'https://www.linkedin.com/in/debaditya-barman-b91748247/' }, { id: 'gmail', name: 'Gmail', link: 'mailto:debadityabarman12@gmail.com' }]` and `contactIntro = { heading: "Let's Connect", body: "Got an idea? A bug to squash? Or just wanna talk tech? I'm in." }`.

- [ ] **Step 1: Share the contact data.** Add the two exports above (values copied from `windows/Contact.jsx`); in `Contact.jsx` build `links` from `contactLinks`, keeping its icons and colours keyed by `id`, and read the heading and body from `contactIntro`. Verify the desktop Contact window looks identical.

- [ ] **Step 2: Mount apps in `PhoneShell`.** For each id in `recentApps`, render `<section className="phone-app" data-app={id}>` containing `PHONE_APPS[id]`; only the `foregroundApp` one is visible, the rest are `hidden` but stay mounted. An app that leaves `recentApps` unmounts.

- [ ] **Step 3: Open and close animation.** When an app becomes the front app, tween its section from `originRect` (if present) to full screen in 0.35s; with no `originRect` (opened from Spotlight or a banner) fade in over 0.2s. `PhoneShell`'s `onHome`: if an app is in front, tween it into the rect of `[data-phone-app="<id>"]` on the home screen over 0.3s, then call `goHome()`; if that icon is not found, fade. Reduced motion: 0.15s cross-fade both ways. A second Home press during the tween must not run it twice.

- [ ] **Step 4: `ContactApp`.** `AppScreen title="Contact"`: avatar or initials, `contactIntro.heading`, `contactIntro.body`, then `contactLinks` as one grouped list (lucide `Github` / `Linkedin` / `Mail` icon, name, chevron), each an `<a target="_blank" rel="noopener noreferrer">`.

- [ ] **Step 5: `AboutApp`.** `AppScreen title="About"`: the avatar or initials, `profile.name`, `profile.role` when set, then rows: Location (when `profile.location` is set) and Projects (`—` while loading or on error, otherwise `` `${projects.length} (${live} live)` `` with `live = favoritesFromProjects(projects).length`), then Resume and Contact rows that `openWindow('resume')` / `openWindow('contact')`. Same data as `windows/AboutThisMac.jsx`.

- [ ] **Step 6: `SkillsApp`.** `AppScreen title="Skills"`: terminal look (monospace, background `#1e1e1e`), the prompt line `@Debaditya % show tech stack`, then per skill a block with the green check and the category above its technologies (stacked, not two columns), the footer line `` `${n} of ${n} stacks loaded successfully (100%)` ``, and the loading / error + Retry / "No skills configured yet." states from `useSkills`, as in `windows/Terminal.jsx`.

- [ ] **Step 7: Verify** at 390×844: Contact from the intro card button and from the dock; About; Skills with real data. Each opens from its icon and returns into it; Home then reopening shows the same scroll position; content scrolls without moving the page; the three links open new tabs. Desktop Contact unchanged. `npm test`, eslint baseline.

- [ ] **Step 8: Commit** — `feat: phone app chrome with Contact, About and Skills`.

---

### Task 7: Projects app

**Files:**
- Create: `src/phone/apps/ProjectsApp.jsx`
- Modify: `src/phone/apps/index.js` (`finder`), `src/phone/phone.css`

**Interfaces:**
- Consumes: `useProjects() → { projects, loading, error, retry }`; `AppScreen`; `normalizeAddress` from `src/lib/browser.js`.

- [ ] **Step 1: Build it.** Two levels, held in local state. Level 1 — `AppScreen title="Projects"`: a grouped list of projects (folder icon, title, chevron) and, in a second group, `Resume.pdf` → `openWindow('resume')`. Level 2 — `AppScreen title={project.title} back="Projects"`: a `Website` row only when `project.website` is set → `openWindow('safari', { url: project.website, title: project.title })`, and a `GitHub` row → `window.open(url, '_blank', 'noopener,noreferrer')` only if `normalizeAddress(project.github)` yields a URL. Loading, error + Retry and empty (`No projects yet.`) states follow the idiom. If the open project disappears from `projects`, fall back to level 1.

- [ ] **Step 2: Verify** at 390×844 with real data: list → project → back; Website opens the Safari placeholder app in front (Safari itself is Task 11); GitHub opens a browser tab; Resume.pdf opens the Resume app. With the network blocked in DevTools: the error state and Retry.

- [ ] **Step 3: Commit** — `feat: phone Projects app`.

---

### Task 8: Resume app with a PDF renderer

**Files:**
- Create: `src/hooks/useResume.js`, `src/phone/apps/ResumeApp.jsx`, `src/phone/apps/PdfPages.jsx`
- Modify: `src/windows/Resume.jsx`, `src/phone/apps/index.js` (`resume`), `package.json`

**Interfaces:**
- Produces: `useResume() → { resume, loading, error, retry }` — the fetch that is inside `windows/Resume.jsx` today (`fetchCurrentResume`, error text `'Unable to load resume'`), moved unchanged. `resume` is `null` or `{ url, downloadUrl }`.
- Produces: `PdfPages({ url, onError })` (default export) — renders every page of the PDF as a full-width canvas.

- [ ] **Step 1: Extract `useResume`** and use it in `windows/Resume.jsx`; the desktop window must behave exactly as before (loading, error + Retry, "No resume yet.", iframe, Download).

- [ ] **Step 2: Add the dependency.** `npm install pdfjs-dist`. Read the installed version's README / `package.json` exports for the current entry points before writing code; do not rely on memory for the API.

- [ ] **Step 3: `PdfPages`.** Imports `pdfjs-dist` and its worker (in Vite: import the worker file with `?url` and assign it to `GlobalWorkerOptions.workerSrc`). Loads the document from `url`, renders each page to a `<canvas>` scaled to the container width × `Math.min(devicePixelRatio, 2)`, top to bottom. Cancels the load and render tasks on unmount or `url` change. Any failure calls `onError(error)`.

- [ ] **Step 4: `ResumeApp`.** `AppScreen title="Resume"` with a toolbar holding `<a href={resume.downloadUrl} download="Resume.pdf">Download</a>`. Content: `const PdfPages = lazy(() => import('./PdfPages'))` inside `Suspense` (fallback: the loading state). States: loading; fetch error + Retry (`retry`); `No resume yet.`; render error — the text `Couldn't display the PDF.`, a Retry button that remounts `PdfPages`, and the Download button still present.

- [ ] **Step 5: Verify.** `npm run build`: the output lists a separate chunk containing pdf.js, and `grep -l "pdfjs" dist/assets/index-*.js` prints nothing. In `npm run dev` at 390×844: every page of the real resume is readable and scrolls; Download saves the file. Block the worker script's URL in DevTools and reopen: the render-error state appears and Download still works (Review Focus 4). Desktop Resume unchanged at 1440×900. `npm test`, eslint baseline.

- [ ] **Step 6: Commit** — `feat: phone Resume app rendering every PDF page`.

---

### Task 9: Music app and the volume capability check

**Files:**
- Create: `src/lib/volumeSupport.js`, `src/phone/apps/MusicApp.jsx`
- Modify: `src/phone/apps/index.js` (`music`), `src/phone/phone.css`
- Test: `src/lib/volumeSupport.test.js`

**Interfaces:**
- Produces: `canSetVolume(element) → boolean` — writes a probe value to `element.volume` (0.5, or 0.4 if it already is 0.5), reads it back, restores the old value; `false` if the read-back differs or anything throws. And `volumeIsSettable() → boolean`, which runs `canSetVolume` once on a fresh `new Audio()` and caches the answer (`false` when `Audio` is missing).
- Consumes: `library`, `audio`, `playTrack`, `togglePlay`, `nextTrack`, `previousTrack`, `seekTo`, `setVolume` from the system store; `albumTitleOf`, `artistOf`, `coverGradient`, `formatTime`, `trackById` from `src/lib/music.js`.

- [ ] **Step 1: Write the failing tests**

```js
it('accepts an element that keeps the volume it is given, and restores it', () => {
    const element = { volume: 1 };
    expect(canSetVolume(element)).toBe(true);
    expect(element.volume).toBe(1);
});
it('rejects an element that ignores volume writes (iOS)', () => {
    const element = { get volume() { return 1; }, set volume(value) {} };
    expect(canSetVolume(element)).toBe(false);
});
it('rejects an element whose volume setter throws', () => {
    const element = { get volume() { return 1; }, set volume(value) { throw new Error('no'); } };
    expect(canSetVolume(element)).toBe(false);
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `volumeSupport.js`. **Step 4: Run** `npm test` — PASS.

- [ ] **Step 5: `MusicApp`.** `AppScreen title="Music"`: the library as a list (cover or `coverGradient(albumTitleOf(track))` tile, title, `artistOf(track)`, `formatTime(track.duration)`), the current song highlighted; tapping a song calls `playTrack(id)` and opens the Now Playing sheet. A mini player bar (cover, title, play/pause, next) sits above the Home bar whenever `audio.currentTrackId` is set; tapping it opens the sheet. The sheet covers the app: a close chevron, large cover, title, artist, a scrubber (`<input type="range">` over `audio.duration` calling `seekTo`, with elapsed and remaining times), previous / play-pause / next, and a volume slider only when `volumeIsSettable()`. Empty library: `No songs yet.`

- [ ] **Step 6: Verify** at 390×844: play a song, scrub, next/previous; go home and open Skills — the music keeps playing; reopen Music — the sheet state and the playing song are intact. The first tap that starts playback produces sound (no autoplay block). `npm test`, eslint baseline.

- [ ] **Step 7: Commit** — `feat: phone Music app; hide volume where it cannot be set`.

---

### Task 10: Extract Safari's tab wiring into a shared hook

**Files:**
- Create: `src/hooks/useBrowserTabs.js`
- Modify: `src/windows/Browser.jsx`

**Interfaces:**
- Produces: `useBrowserTabs()` (default export) returning
  - `browser`, `tab`, `entry`, `dispatch` — the reducer state, `activeTab(browser)`, `currentEntry(tab)` and the reducer's dispatch;
  - `open(entry)` — `dispatch({ type: 'navigate', entry })`;
  - `go(text)` — the address-bar submit: blank text does nothing; otherwise `addressOrSearch` → `resolveEntry` (title = the typed text when it was a search) or `errorEntry(text)`, then `open`;
  - `frames` — one `{ id, key, hidden, props }` per tab that has a URL, an empty array while Safari is closed; `key = `${tab.id}:${tab.frame.key}``, `props = { title, ref, src, sandbox, allow: 'fullscreen', referrerPolicy: 'strict-origin-when-cross-origin', onLoad }`.
  The hook owns, moved verbatim from `Browser.jsx`: `PROXY_URL` / `PROXY_ORIGIN`, `IFRAME_SANDBOX`, the `frames` ref map, `directHosts`, the `message` listener with its `event.origin !== PROXY_ORIGIN` check and frame lookup by `event.source`, and the effect that turns `windows.safari.data` (`{ url, title }` or `{ newTab: true }`) into a new tab.

- [ ] **Step 1: Move the logic** into the hook. `Browser.jsx` keeps its markup, the `draft` state and class names; it calls `go(draft ?? '')` on submit and clears `draft` after `open`. The security-relevant lines (origin check, sandbox string, `normalizeAddress` on reported URLs) are moved, not rewritten: `git diff` should show them deleted in one file and added identically in the other.

- [ ] **Step 2: Verify the desktop Safari** at 1440×900 with `VITE_SAFARI_PROXY_URL` set: Favorites page; open a project site; type `github.com` (proxied) and click a link inside — the address bar and Back follow; type plain words — a Bing search; type `google.com/maps` — the blocked page and its search box; a `target="_blank"` link inside a proxied page opens a new tab; Projects → a project → Website.pages opens a new tab; File → New Tab; close and reopen Safari — tabs are still there; close the last tab. `npm test`, eslint baseline (the count for `Browser.jsx` must not change).

- [ ] **Step 3: Commit** — `refactor: move Safari tab wiring into useBrowserTabs`.

---

### Task 11: Safari app

**Files:**
- Create: `src/phone/apps/SafariApp.jsx`
- Modify: `src/phone/apps/index.js` (`safari`), `src/phone/phone.css`

**Interfaces:**
- Consumes: `useBrowserTabs` (Task 10); `FavoritesPage`, `CantOpenPage`, `BlockedPage` from `src/components/browser/`; `currentEntry`, `addressOrSearch`, `resolveEntry`, `errorEntry` from `src/lib/browser.js`.

- [ ] **Step 1: Build it.** `AppScreen flush`. The page area renders every item of `frames` as an `<iframe key={frame.key} hidden={frame.hidden} {...frame.props}>` filling the area, the progress bar while `tab.loading`, and the same three non-frame pages the desktop shows for an entry without a URL (Favorites, CantOpen, Blocked), wired exactly as in `windows/Browser.jsx`. The toolbar above the Home bar: Back (`disabled` at `tab.index === 0`), Forward (`disabled` at the last entry), an address field (`aria-label="Address"`, placeholder `Search or enter website name`, shows `entry.url`, selects all on focus, submits through `go`, blurs after submit), Reload when `entry.url` is set, and a Tabs button showing the tab count. The Tabs button opens a full-app grid of cards (the tab title from `currentEntry(tab).title`, a close button → `closeTab`), a `+` button → `newTab`, and Done; tapping a card dispatches `selectTab` and closes the grid. If `FavoritesPage` / `BlockedPage` / `CantOpenPage` overflow at 390px, fix them with phone-scoped CSS only.

- [ ] **Step 2: Verify** at 390×844 with the proxy URL set: the checks of Task 10 Step 2, on the phone (Projects → a project → Website opens Safari in front with that site). Sites render their mobile layouts. Scrolling inside a page does not trigger the Home bar or move the shell. Go home and return: the same page and tabs. Type in the address field: the on-screen keyboard (or DevTools equivalent) does not push the toolbar off screen.

- [ ] **Step 3: Commit** — `feat: phone Safari app`.

---

### Task 12: Spotlight

**Files:**
- Create: `src/phone/PhoneSpotlight.jsx`
- Modify: `src/phone/PhoneShell.jsx`, `src/phone/phone.css`

**Interfaces:**
- Consumes: `spotlightOpen`, `closeSpotlight`; `buildSpotlightIndex`, `searchSpotlight`, `SPOTLIGHT_GROUPS` from `src/lib/spotlight.js`; `phoneRegistry`, `phoneSpotlightEntries` (Task 3); `runMenuAction`; `useProjects`, `useSkills`, `library`. Read `components/system/Spotlight.jsx` for how the desktop builds its index and renders groups; mirror its data flow, not its markup.

- [ ] **Step 1: Build it.** A sheet that slides down from the top over a dimmed, blurred backdrop while `spotlightOpen`. The search field (`aria-label="Spotlight Search"`, placeholder `Search`) is focused on open. Index: `phoneSpotlightEntries(buildSpotlightIndex({ apps: phoneRegistry, projects, skills, tracks: library }))`; results from `searchSpotlight`, grouped under the `SPOTLIGHT_GROUPS` labels. With an empty query show the phone apps as suggestions. Tapping a result: `closeSpotlight()` then `runMenuAction(result.action)`. Closing: a Cancel button, a tap on the backdrop, Escape, the Home bar (`goHome` already closes it), or a swipe up on the sheet.

- [ ] **Step 2: Verify** at 390×844: open by the search pill and by swiping down on the home screen; the spotlight sound plays once; search a project → Safari or GitHub as on the desktop; search a skill → Skills; search a song → it plays and a Now Playing banner is recorded; search `about` → the result reads "About", not "About This Mac"; nothing mentions Mission Control. Open Spotlight then Control Center (status bar): Spotlight closes.

- [ ] **Step 3: Commit** — `feat: phone Spotlight`.

---

### Task 13: Control Center

**Files:**
- Create: `src/phone/PhoneControlCenter.jsx`
- Modify: `src/phone/PhoneShell.jsx`, `src/phone/phone.css`

**Interfaces:**
- Consumes: `controlCenterOpen`, `closeControlCenter`, `brightness` / `setBrightness`, `audio` and its actions, `focusMode` / `setFocusMode`, `soundEffects` / `setSoundEffects`, `notificationHistory`, `clearNotificationHistory`; `volumeIsSettable` (Task 9); `runMenuAction`. Read `components/system/ControlCenter.jsx` for the fields and ranges it uses (brightness 30–100%).

- [ ] **Step 1: Build it.** A panel sliding down from the top-right over a dimmed backdrop while `controlCenterOpen`. Modules: decorative Wi-Fi / Bluetooth / AirDrop tiles (local toggles, as on the desktop); Display slider (0.3–1); Sound slider only when `volumeIsSettable()`; Now Playing (cover, title, previous / play-pause / next; tapping the title opens Music via `runMenuAction({ type: 'openApp', id: 'music' })`); Focus toggle; Sound Effects toggle; the recent notifications from `notificationHistory` with a Clear button; and two buttons, **Lock** → `runMenuAction({ type: 'lock' })` and **Restart** → `runMenuAction({ type: 'restart' })`. Closing: backdrop tap, a swipe up on the panel, Escape, or the Home bar. Sliders use `touch-action: none` on the track so dragging them does not scroll or close the panel.

- [ ] **Step 2: Verify** at 390×844: open by tapping the right of the status bar, by swiping down from it, and by swiping down from the top-right of the home screen; open it from inside an app. Brightness dims the whole phone UI; Focus on → trigger a banner (start a song with Music closed): no banner, but it is listed here. Review Focus 5: with Skills in front, music playing and Control Center open, press **Lock** → lock screen, sheets closed, music still playing; unlock → Skills is in front. Then **Restart** → music stops, hello replays, lock screen, unlock → the home screen or the same app, no console errors.

- [ ] **Step 3: Commit** — `feat: phone Control Center with Lock and Restart`.

---

### Task 14: App switcher and banners

**Files:**
- Create: `src/phone/PhoneSwitcher.jsx`, `src/phone/PhoneBanner.jsx`
- Modify: `src/phone/PhoneShell.jsx`, `src/phone/phone.css`

**Interfaces:**
- Consumes: `missionControl` (truthy = switcher open), `openMissionControl`, `closeMissionControl`, `switchToApp(id)`, `closeWindow(id)`; `recentApps`; `phoneRegistry` for names and icons; `notifications`, `dismissNotification`, `NOTIFICATION_LIFETIME`; `getApp`; `swipeDirection`; `runMenuAction`.

- [ ] **Step 1: `PhoneSwitcher`.** While `missionControl` is set: a dimmed, blurred layer with one card per id in `recentApps`, most recent first, scrolling sideways (`touch-action: pan-x`, scroll snapping). A card shows the app icon and name above a plain dark preview tile with the icon centred (no live thumbnail). Tap a card → `switchToApp(id)` (which also closes the switcher). Drag a card up: it follows the finger; released with `swipeDirection === 'up'` it flies off and `closeWindow(id)` runs, otherwise it springs back. Each card also has a close button (`aria-label="Close {name}"`). Tapping outside the cards, Escape or the Home bar closes the switcher. With no open apps show `No Recent Apps` and close on any tap. Closing the last card closes the switcher.

- [ ] **Step 2: `PhoneBanner`.** Shows only the newest entry of `notifications`, under the status bar, sliding down. It leaves after `NOTIFICATION_LIFETIME`, then calls `dismissNotification(id)`; when a newer one arrives it replaces the current one. Tap → dismiss and `runMenuAction(notification.action)` when there is an action. A swipe up dismisses it. Icon from `getApp(notification.appId)?.icon ?? '/images/about.svg'`, as on the desktop. `role="status"`.

- [ ] **Step 3: Verify** at 390×844: open three apps; long-press the Home bar → switcher; swipe up on the Home bar and pause → switcher; a quick swipe up → home. Cards are in most-recent order; tap one → that app, in the state it was left; flick one up → it is gone and its state resets when reopened. After unlocking a fresh session the first welcome banner appears at about 4s and its tap opens Contact; a banner also shows while an app is in front. The notification sound plays once per banner. Nothing plays the minimize or restore sound when going home or switching.

- [ ] **Step 4: Commit** — `feat: phone app switcher and notification banners`.

---

### Task 15: Final pass, docs, and the owner's phone checklist

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md`, `src/phone/phone.css` (only for defects found)

- [ ] **Step 1: Full walkthrough** of the spec's Verification section at 390×844 and 360×740 (touch emulation), 768×1024, 1280×800 and 1440×900. Also: `prefers-reduced-motion` emulated — every animation is a fade or absent; keyboard only at 390px — every control is reachable by Tab and has a visible focus ring; a phone-sized window dragged across 640px in both directions with two apps open and music playing; device toolbar rotated to landscape — the Rotate card shows (emulate a coarse pointer) and music continues. Fix what fails.

- [ ] **Step 2: Confirm the desktop listeners are gone on the phone.** At 390px: Ctrl/Cmd+K, Ctrl+`, Ctrl+↑, right-click on the wallpaper and the top-right hot corner do nothing; right-click shows the browser's own menu.

- [ ] **Step 3: Update the docs.** `CLAUDE.md`: the two-shell switch in `App.jsx` and `PHONE_QUERY`; that boot now plays on every size and `index.html` no longer repeats a media query; `src/phone/` and its stylesheet rule; phone state (go home = minimize all, front app = focused visible window, switcher = `missionControl`); `fitOnScreen` vs `clampBounds`; `useBrowserTabs`, `useResume`, `contactLinks`; the `pdfjs-dist` lazy chunk; `soundCues`' phone option; the registry's `phone` field ("adding a window" now includes a phone placement and a `PHONE_APPS` entry). Remove the statements that small screens skip the boot. Mirror the structure and convention changes in `AGENTS.md`.

- [ ] **Step 4: Run** `npm test`, `npx eslint . --ignore-pattern .superpowers` (7 known errors only), `npm run build` (succeeds; pdf.js in its own chunk).

- [ ] **Step 5: Commit** — `docs: phone shell architecture; final phone fixes`.

**Owner's checklist after deploy** (real iPhone in Safari and an Android phone in Chrome, on the live site; fixes are follow-up work):

1. Hello → lock → unlock; nothing hidden under the notch or the bottom bar.
2. Scrolling the browser's address bar in and out does not move the Home bar off screen.
3. Swiping down on the home screen opens Spotlight, not pull-to-refresh.
4. The Home bar works without triggering the phone's own home gesture.
5. Resume: every page shows; Download works.
6. Music: the first tap plays; the volume slider is absent on the iPhone and present where it works.
7. Safari app: a project site, a proxied site (github.com) and a search all load.
8. Double-tapping does not zoom; long-pressing icons does not select text or open the image menu.
9. Rotating to landscape shows the Rotate card.
