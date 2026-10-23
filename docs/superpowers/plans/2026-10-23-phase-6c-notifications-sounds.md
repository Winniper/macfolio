# Phase 6c — Notifications and System Sounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add macOS-style notification banners and system sounds.
- **Banners** are stacked top-right, slide in, dismiss themselves after 5 s (hover pauses), and run an action on click.
- **Two scripted welcome banners** follow unlock: a greeting after about 4 s that opens Contact, and a Safari nudge after about 45 s, sent only if Safari is still unopened.
- **Sounds:** a startup chime on unlock, a whoosh on minimize and on restore, a blip for each notification, and a tick when Spotlight opens.

**Architecture:**
- **Notification state** is a short list in the system store. `notify()` and `dismissNotification()` go through pure helpers in `src/lib/notifications.js`. `Notifications.jsx` renders the list and owns each banner's lifetime.
- **The welcome schedule** is a pure `scheduleWelcome` with injected timers, driven by a small hook.
- **Sounds:**
  - `src/lib/soundCues.js` diffs store snapshots into cue names; it is pure and tested.
  - `src/lib/sounds.js` is a Web Audio player with injected dependencies. It does nothing until the first user gesture primes it, and never throws.
  - One `SoundEffects` component subscribes to both stores and plays the cues.
- **The sound files** are synthesized by `scripts/generate-sounds.mjs` from pure functions in `src/lib/synth.js`, so they're original and royalty-free. A test proves the committed files match the generator.

**Tech Stack:** React 19, Zustand 5 + Immer, Web Audio API, Node (sound generator), Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md`. This plan covers phase 6c of the build order (6a menus and 6b Spotlight are merged), and implements these parts of section 5b:
- "Notification toasts"
- "System sounds"

**Decisions:**
- **Sound files are synthesized, not downloaded.** `scripts/generate-sounds.mjs` writes mono 16-bit, 16 kHz WAVs. They're original work, so there's no licence question, and each one stays under 50 KB. Noise comes from a seeded PRNG, so the output is deterministic and regenerating produces byte-identical files. The owner can replace any file later, keeping the same name.
- **What waits for later phases:**
  - Phase 9: the empty-trash crunch, together with the Archive easter egg.
  - Phase 7 (Control Center): the "Sound Effects" toggle UI, the Focus tile that suppresses banners, and the notification history list. This phase adds only the store flag `soundEffects` (default `true`), so Phase 7 just wires up the UI.
  - Phases 7 and 9: system banners such as Now Playing and the easter-egg replies.
- **When the welcome banners run:**
  - They run once per page load and are triggered by the visitor unlocking (`locked → desktop`).
  - A same-tab refresh lands straight on the desktop, so the visitor doesn't see them again.
  - A lock, restart or unlock later in the same load doesn't repeat them.
- **Banners exist only on the desktop.** `notify()` ignores calls outside the desktop phase, and lock/restart clear the visible banners. A scripted timer that fires while the screen is locked is simply dropped.
- **Stack size:** at most 3 banners are visible. The newest goes on top, and the oldest is dropped.
- **Time label:** banners say "now". They live for 5 s, so a clock would never change.
- **Audio unlocking:** the first `pointerdown` or `keydown` primes the audio context. On a first visit that's the boot or lock-screen gesture, so the startup chime (which plays when `unlock()` runs, 0.6 s later) is allowed. Every later gesture re-primes the context, which resumes it if the browser suspended it.

## Global Constraints

- **Notification toasts** (`system/Notifications.jsx`, `notify({ appId, title, body, action })` in the system store).
  - macOS-style banners stacked top-right (icon, title, body, time). They slide in, auto-dismiss after 5 s, pause on hover, and run `action` on click.
  - Scripted banners, with copy in constants:
    - About 4 s after unlock: *Messages: "Hey, I'm Debaditya 👋 Have a look around"* → opens Contact.
    - About 45 s in, only if Safari hasn't been opened: *Safari: "Want to see my projects running live?"* → opens Safari.
- **System sounds** (`src/lib/sounds.js`, Web Audio).
  - Startup chime on lock-screen dismissal (the first allowed user gesture), minimize/restore whoosh, notification blip and Spotlight tick.
  - Files live under `public/sounds/`, each < 50 KB. Apple's chime is not used.
- Desktop shortcuts and global listeners check `isDesktopPhase(useSystemStore.getState())`.
- **Tests:** Vitest covers pure logic and stores only. Never import a window or component, or `src/lib/firebase.js`, from a test. UI is verified in Chrome by the controller.
- **Lint:** `npx eslint . --ignore-pattern .superpowers` stays at 10 errors and 0 warnings.
- **Files to leave alone:** never edit or commit `._*` files, or the untracked `plan.md`, `page-render-check.png` and `website-screenshot.png`. Stage files by path.
- **Commits:** messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The branch is `feature/notifications`.

## Review Focus

1. **Lock or restart while a banner is showing or a welcome timer is pending.** No banner may appear over the boot or lock screen. Pinned in Task 1: `notify` ignores non-desktop phases, and lock/restart clear banners.
2. **A burst of notifications.** The stack stays at 3, newest on top, and nothing piles up off-screen. Pinned in Task 1 (`addNotification` cap).
3. **No audio permission yet, no Web Audio support, or a sound file that fails to load.** All of these stay silent and never throw, and a failed load retries next time. Pinned in Task 3 (sound player tests).
4. **Safari opened before the 45 s nudge.** The nudge must not appear. Pinned in Task 1 (`scheduleWelcome` test); verified in Chrome in Task 2.
5. **Hovering a banner.** It must pause auto-dismiss, and leaving resumes with the remaining time rather than a fresh 5 s. With reduced motion, banners must still dismiss. Verified in Chrome (Task 2).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/notifications.js` + test (create) | `MAX_NOTIFICATIONS`, `NOTIFICATION_LIFETIME`, `createNotification`, `addNotification`, `scheduleWelcome` |
| `src/constants/index.js` (modify) | `welcomeNotifications` copy |
| `src/store/system.js` + test (modify) | `notifications`, `nextNotificationId`, `notify`, `dismissNotification`, `soundEffects`, `setSoundEffects`; lock and restart clear banners |
| `src/hooks/useWelcomeNotifications.js` (create) | Schedules the welcome banners on the first unlock |
| `src/components/system/Notifications.jsx` (create) | Banner stack: lifetime, hover pause, click, close |
| `src/lib/synth.js` + test (create) | `SAMPLE_RATE`, `synthesizers`, `renderSound`, `encodeWav` |
| `scripts/generate-sounds.mjs` (create), `public/sounds/*.wav` (generated) | Writes the sound files |
| `src/lib/sounds.js` + test (create) | `SOUND_NAMES`, `CUE_VOLUME`, `createSoundPlayer`, `systemSounds` |
| `src/lib/soundCues.js` + test (create) | `soundSnapshot`, `soundCues` |
| `src/lib/soundFiles.test.js` (create) | Committed files exist, are < 50 KB, and match the generator |
| `src/components/system/SoundEffects.jsx` (create) | Primes audio on gestures, plays cues on store changes |
| `src/App.jsx`, `src/index.css`, `src/components/system/DesktopContextMenu.jsx`, `package.json`, `CLAUDE.md`, spec (modify) | Mount, styles, native-menu area, `sounds` script, docs |

---

### Task 1: Notification logic, welcome schedule and store

**Files:**
- Create: `src/lib/notifications.js`, `src/lib/notifications.test.js`
- Modify: `src/constants/index.js`, `src/store/system.js`, `src/store/system.test.js`

**Interfaces:**
- Consumes: the system store's `bootPhase`.
- Produces:
  - **Constants:** `NOTIFICATION_LIFETIME = 5000` (ms) and `MAX_NOTIFICATIONS = 3`.
  - **`createNotification({ appId, title, body?, action? }, { id }) => Notification`**, where `Notification = { id: number, appId: string, title: string, body: string, action: object | null }`.
  - **`addNotification(list, notification, max = MAX_NOTIFICATIONS)`** returns a new array with the newest last, capped at the newest `max`.
  - **`scheduleWelcome(entries, { setTimer, wasOpened, notify })`** returns the timer handles. Each entry is `{ delay, unlessOpened?, appId, title, body, action }`.
  - **`welcomeNotifications`**, exported from `src/constants/index.js`.
  - **System store:** `notifications: Notification[]`, `nextNotificationId: number`, `notify(input) => id | null`, `dismissNotification(id)`, `soundEffects: boolean` (default `true`) and `setSoundEffects(on)`. `lock` and `restart` empty `notifications`.

- [ ] **Step 1: Write the failing tests.**

Create `src/lib/notifications.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MAX_NOTIFICATIONS, addNotification, createNotification, scheduleWelcome } from './notifications';
import { welcomeNotifications } from '../constants';

afterEach(() => {
    vi.useRealTimers();
});

describe('createNotification', () => {
    it('keeps the fields a banner needs, with defaults', () => {
        expect(createNotification({ appId: 'safari', title: '  Safari ' }, { id: 7 })).toEqual({
            id: 7,
            appId: 'safari',
            title: 'Safari',
            body: '',
            action: null,
        });
        expect(createNotification(
            { appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' }, extra: 1 },
            { id: 1 },
        )).toEqual({ id: 1, appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' } });
    });
});

describe('addNotification', () => {
    it('appends and keeps only the newest few', () => {
        const make = (id) => ({ id, appId: 'safari', title: `n${id}`, body: '', action: null });
        let list = [];
        [1, 2, 3, 4, 5].forEach((id) => { list = addNotification(list, make(id)); });
        expect(MAX_NOTIFICATIONS).toBe(3);
        expect(list.map((n) => n.id)).toEqual([3, 4, 5]);
        expect(addNotification([make(1)], make(2), 1).map((n) => n.id)).toEqual([2]);
    });
});

describe('scheduleWelcome', () => {
    const entries = [
        { delay: 4000, appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' } },
        { delay: 45000, unlessOpened: 'safari', appId: 'safari', title: 'Safari', body: 'Look', action: { type: 'openApp', id: 'safari' } },
    ];

    it('sends each banner after its delay, without scheduling fields', () => {
        vi.useFakeTimers();
        const notify = vi.fn();
        const handles = scheduleWelcome(entries, { setTimer: setTimeout, wasOpened: () => false, notify });

        expect(handles).toHaveLength(2);
        vi.advanceTimersByTime(3999);
        expect(notify).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(notify).toHaveBeenLastCalledWith({ appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' } });
        vi.advanceTimersByTime(41000);
        expect(notify).toHaveBeenCalledTimes(2);
        expect(notify).toHaveBeenLastCalledWith({ appId: 'safari', title: 'Safari', body: 'Look', action: { type: 'openApp', id: 'safari' } });
    });

    it('skips a nudge for an app the visitor already opened', () => {
        vi.useFakeTimers();
        const notify = vi.fn();
        const opened = new Set();
        scheduleWelcome(entries, { setTimer: setTimeout, wasOpened: (id) => opened.has(id), notify });

        vi.advanceTimersByTime(4000);
        opened.add('safari');
        vi.advanceTimersByTime(41000);
        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify.mock.calls[0][0].title).toBe('Messages');
    });
});

describe('welcomeNotifications', () => {
    it('greets after about 4s and nudges toward Safari after about 45s', () => {
        expect(welcomeNotifications).toEqual([
            {
                delay: 4000,
                appId: 'contact',
                title: 'Messages',
                body: "Hey, I'm Debaditya 👋 Have a look around",
                action: { type: 'openApp', id: 'contact' },
            },
            {
                delay: 45000,
                unlessOpened: 'safari',
                appId: 'safari',
                title: 'Safari',
                body: 'Want to see my projects running live?',
                action: { type: 'openApp', id: 'safari' },
            },
        ]);
    });
});
```

That's 5 tests.

Append to `src/store/system.test.js`:

```js
describe('notifications', () => {
    beforeEach(() => {
        useSystemStore.setState({ bootPhase: 'desktop' });
    });

    it('adds banners with increasing ids', () => {
        const first = system().notify({ appId: 'contact', title: 'Messages', body: 'Hi' });
        const second = system().notify({ appId: 'safari', title: 'Safari' });
        expect(second).toBe(first + 1);
        expect(system().notifications.map((n) => [n.id, n.title])).toEqual([[first, 'Messages'], [second, 'Safari']]);
    });

    it('keeps at most three on screen', () => {
        ['a', 'b', 'c', 'd'].forEach((title) => system().notify({ appId: 'safari', title }));
        expect(system().notifications.map((n) => n.title)).toEqual(['b', 'c', 'd']);
    });

    it('ignores banners off the desktop or without a title', () => {
        expect(system().notify({ appId: 'safari', title: '   ' })).toBeNull();
        expect(system().notify({ appId: 'safari' })).toBeNull();
        useSystemStore.setState({ bootPhase: 'locked' });
        expect(system().notify({ appId: 'safari', title: 'Safari' })).toBeNull();
        expect(system().notifications).toEqual([]);
    });

    it('dismisses one banner by id', () => {
        const first = system().notify({ appId: 'contact', title: 'One' });
        system().notify({ appId: 'safari', title: 'Two' });
        system().dismissNotification(first);
        expect(system().notifications.map((n) => n.title)).toEqual(['Two']);
        system().dismissNotification(999);
        expect(system().notifications).toHaveLength(1);
    });

    it('clears banners on lock and restart', () => {
        system().notify({ appId: 'safari', title: 'Safari' });
        system().lock();
        expect(system().notifications).toEqual([]);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().notify({ appId: 'safari', title: 'Safari' });
        system().restart();
        expect(system().notifications).toEqual([]);
    });
});
```

That's 5 tests.

- [ ] **Step 2: Run the tests to verify they fail.**

Run `npm test`. Expected: FAIL. `./notifications` doesn't resolve, `welcomeNotifications` is undefined, and `notify` is not a function.

- [ ] **Step 3: Create `src/lib/notifications.js`.**

```js
// Notification banners (macOS style). Pure helpers; the list itself lives in
// the system store and Notifications.jsx renders it.

export const NOTIFICATION_LIFETIME = 5000;
export const MAX_NOTIFICATIONS = 3;

export const createNotification = ({ appId, title, body = '', action = null }, { id }) => ({
    id,
    appId,
    title: title.trim(),
    body,
    action,
});

// Newest last; older banners fall off so the stack never grows off-screen.
export const addNotification = (list, notification, max = MAX_NOTIFICATIONS) =>
    [...list, notification].slice(-max);

// The welcome banners after unlock. `unlessOpened` skips a nudge toward an
// app the visitor has already found on their own.
export const scheduleWelcome = (entries, { setTimer, wasOpened, notify }) =>
    entries.map(({ delay, unlessOpened, ...notification }) => setTimer(() => {
        if (unlessOpened && wasOpened(unlessOpened)) return;
        notify(notification);
    }, delay));
```

- [ ] **Step 4: Add the welcome copy.** In `src/constants/index.js`, add this after the `profile` object:

```js
// Banners sent once per page load, after the visitor unlocks (Phase 6c).
const welcomeNotifications = [
    {
        delay: 4000,
        appId: 'contact',
        title: 'Messages',
        body: "Hey, I'm Debaditya 👋 Have a look around",
        action: { type: 'openApp', id: 'contact' },
    },
    {
        delay: 45000,
        unlessOpened: 'safari',
        appId: 'safari',
        title: 'Safari',
        body: 'Want to see my projects running live?',
        action: { type: 'openApp', id: 'safari' },
    },
];
```

Then add `welcomeNotifications,` to the file's `export { … }` list.

- [ ] **Step 5: Extend `src/store/system.js`.**
- Add the import: `import { addNotification, createNotification } from '../lib/notifications';`
- Replace the top comment with: `// OS-level state that isn't about a single window: boot phase, Mission Control, Spotlight, notifications, the sound-effects switch and the desktop Clean Up counter; Control Center and audio in later phases.`
- In `createInitialSystemState`, add after `spotlightOpen: false,`:

```js
  notifications: [],
  nextNotificationId: 1,
  // Phase 7's Control Center toggles this; on by default.
  soundEffects: true,
```

- Add these actions after `toggleSpotlight`:

```js
    // Banners exist only on the desktop: a scripted one that fires while the
    // screen is locked is simply dropped.
    notify: (input) => {
      const { bootPhase, nextNotificationId: id } = get();

      if (bootPhase !== 'desktop' || typeof input?.title !== 'string' || !input.title.trim()) return null;

      set((state) => {
        state.nextNotificationId += 1;
        state.notifications = addNotification(state.notifications, createNotification(input, { id }));
      });
      return id;
    },

    dismissNotification: (id) =>
      set((state) => {
        state.notifications = state.notifications.filter((notification) => notification.id !== id);
      }),

    setSoundEffects: (on) =>
      set((state) => {
        state.soundEffects = Boolean(on);
      }),
```

- In both `lock` and `restart`, add `state.notifications = [];` next to `state.spotlightOpen = false;`.

- [ ] **Step 6: Run the checks.**
- `npm test`: expect 209 passing (199 + 5 + 5).
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/notifications.js src/lib/notifications.test.js src/constants/index.js src/store/system.js src/store/system.test.js
git commit -m "feat: notification state, welcome schedule and sound-effects flag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Notification banners and welcome banners

**Files:**
- Create: `src/components/system/Notifications.jsx`, `src/hooks/useWelcomeNotifications.js`
- Modify: `src/App.jsx`, `src/index.css`, `src/components/system/DesktopContextMenu.jsx`

**Interfaces:**
- Consumes:
  - From Task 1: `notifications`, `notify`, `dismissNotification`, `NOTIFICATION_LIFETIME`, `scheduleWelcome` and `welcomeNotifications`.
  - From Phase 6a: `runMenuAction`.
  - From the registry: `getApp`.
- Produces: `<Notifications />`, mounted once in `App.jsx`, and the `useWelcomeNotifications()` hook.

- [ ] **Step 1: Create the welcome hook.** Create `src/hooks/useWelcomeNotifications.js`:

```js
import { useEffect } from 'react';

import { welcomeNotifications } from '../constants';
import { scheduleWelcome } from '../lib/notifications';
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';

// Once per page load, when the visitor unlocks (locked → desktop). A same-tab
// refresh lands straight on the desktop, so they are not shown again.
const useWelcomeNotifications = () => {
    useEffect(() => {
        let scheduled = false;
        let timers = [];
        const opened = new Set();

        const unsubscribeWindows = useWindowStore.subscribe((state) => {
            Object.entries(state.windows).forEach(([id, entry]) => {
                if (entry.isOpen) opened.add(id);
            });
        });

        const unsubscribeSystem = useSystemStore.subscribe((state, previous) => {
            if (scheduled || previous.bootPhase !== 'locked' || state.bootPhase !== 'desktop') return;

            scheduled = true;
            timers = scheduleWelcome(welcomeNotifications, {
                setTimer: (callback, delay) => window.setTimeout(callback, delay),
                wasOpened: (id) => opened.has(id),
                notify: (notification) => useSystemStore.getState().notify(notification),
            });
        });

        return () => {
            unsubscribeWindows();
            unsubscribeSystem();
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, []);
};

export default useWelcomeNotifications;
```

- [ ] **Step 2: Create `src/components/system/Notifications.jsx`.**

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';

import { getApp } from '../../constants/apps';
import useWelcomeNotifications from '../../hooks/useWelcomeNotifications';
import { runMenuAction } from '../../lib/menuActions';
import { NOTIFICATION_LIFETIME } from '../../lib/notifications';
import useSystemStore from '../../store/system';

// One banner: leaves after NOTIFICATION_LIFETIME; hovering pauses the clock and
// leaving resumes it with the time that was left.
const NotificationBanner = ({ notification }) => {
    const dismissNotification = useSystemStore((state) => state.dismissNotification);
    const [leaving, setLeaving] = useState(false);
    const remaining = useRef(NOTIFICATION_LIFETIME);
    const startedAt = useRef(0);
    const timer = useRef(null);

    const resume = useCallback(() => {
        startedAt.current = Date.now();
        timer.current = window.setTimeout(() => setLeaving(true), remaining.current);
    }, []);

    const pause = () => {
        window.clearTimeout(timer.current);
        remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };

    useEffect(() => {
        resume();
        return () => window.clearTimeout(timer.current);
    }, [resume]);

    const dismiss = () => dismissNotification(notification.id);

    const open = () => {
        dismiss();
        if (notification.action) runMenuAction(notification.action);
    };

    const icon = getApp(notification.appId)?.icon ?? '/images/about.svg';

    return (
        <div
            className={`notification${leaving ? ' is-leaving' : ''}`}
            role="status"
            onPointerEnter={() => { if (!leaving) pause(); }}
            onPointerLeave={() => { if (!leaving) resume(); }}
            // The slide-in also ends with animationend; only the slide-out removes it.
            onAnimationEnd={() => { if (leaving) dismiss(); }}
        >
            <button type="button" className="notification-open" onClick={open}>
                <img src={icon} alt="" />
                <span className="notification-text">
                    <span className="notification-head">
                        <span className="notification-title">{notification.title}</span>
                        <span className="notification-time">now</span>
                    </span>
                    {notification.body && <span className="notification-body">{notification.body}</span>}
                </span>
            </button>
            <button type="button" className="notification-close" aria-label="Dismiss notification" onClick={dismiss}>
                ×
            </button>
        </div>
    );
};

// Stacked top-right, newest on top.
const Notifications = () => {
    const notifications = useSystemStore((state) => state.notifications);

    useWelcomeNotifications();

    return (
        <div className="notifications" aria-live="polite">
            {[...notifications].reverse().map((notification) => (
                <NotificationBanner key={notification.id} notification={notification} />
            ))}
        </div>
    );
};

export default Notifications;
```

- [ ] **Step 3: Mount it.** In `src/App.jsx`:
- Add `import Notifications from "@components/system/Notifications"` next to the other `@components/system` imports.
- Render `<Notifications />` right after `<Spotlight />`.

- [ ] **Step 4: Keep the native menu on banners.** In `src/components/system/DesktopContextMenu.jsx`, append `, .notifications` to the `NATIVE_MENU_AREAS` selector string.

- [ ] **Step 5: Add the styles.** Append to `src/index.css`, after the Spotlight rules:

```css
/* Notification banners: top-right under the menu bar; above windows and
   Mission Control, below Spotlight (140000), the context menu (150000) and
   boot/lock (200000). The container lets clicks through to the desktop. */
.notifications {
  position: fixed;
  top: 36px;
  right: 12px;
  z-index: 130000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(344px, calc(100vw - 24px));
  pointer-events: none;
}
.notification {
  position: relative;
  display: flex;
  border-radius: 16px;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(40 40 40 / 0.82);
  backdrop-filter: blur(30px) saturate(1.6);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
  color: white;
  pointer-events: auto;
  animation: notification-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
}
.notification.is-leaving {
  animation: notification-out 0.25s ease-in forwards;
}
.notification-open {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  color: inherit;
  cursor: default;
}
.notification-open img {
  flex: none;
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.notification-text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}
.notification-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}
.notification-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notification-time {
  flex: none;
  font-size: 12px;
  font-weight: 400;
  color: rgb(255 255 255 / 0.55);
}
.notification-body {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.35;
  color: rgb(255 255 255 / 0.85);
}
.notification-close {
  position: absolute;
  top: -6px;
  left: -6px;
  display: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.2);
  background: rgb(60 60 60 / 0.95);
  font-size: 13px;
  line-height: 17px;
  color: white;
}
.notification:hover .notification-close,
.notification:focus-within .notification-close {
  display: block;
}
@keyframes notification-in {
  from {
    transform: translateX(calc(100% + 24px));
    opacity: 0;
  }
}
@keyframes notification-out {
  to {
    transform: translateX(calc(100% + 24px));
    opacity: 0;
  }
}
/* Still animates for 1ms so animationend fires and the banner is removed. */
@media (prefers-reduced-motion: reduce) {
  .notification,
  .notification.is-leaving {
    animation-duration: 1ms;
  }
}
```

- [ ] **Step 6: Run the checks.**
- `npm test`: 209 passing.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 7: Commit.**

```bash
git add src/components/system/Notifications.jsx src/hooks/useWelcomeNotifications.js src/App.jsx src/index.css src/components/system/DesktopContextMenu.jsx
git commit -m "feat: notification banners and welcome banners after unlock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Chrome checks (controller).** Start from a fresh tab: run `sessionStorage.clear()` and reload, so the boot and lock screens play.
- **Greeting:** about 4 s after unlock, the Messages banner slides in top-right with the Contact icon, its body text and "now".
- **Clicking a banner:** it opens Contact and removes the banner.
- **Auto-dismiss:** a banner leaves by itself after about 5 s. Hovering pauses it, and leaving resumes with the remaining time.
- **Close button:** the × shows on hover and dismisses the banner.
- **Safari nudge:** with Safari unopened, it arrives about 45 s after unlock. In a second run, open Safari first, and no nudge should appear.
- **Refresh:** after a refresh, no welcome banners appear.
- **Stack:** calling `notify` 4 times via the store shows at most 3 banners, newest on top.
- **Lock:** locking with a banner up clears it.
- **Right-click on a banner:** the native menu appears.
- **Reduced motion:** with it emulated, banners still disappear.

---

### Task 3: System sounds

**Files:**
- Create: `src/lib/synth.js`, `src/lib/synth.test.js`, `scripts/generate-sounds.mjs`, `public/sounds/{startup,minimize,restore,notification,spotlight}.wav` (generated), `src/lib/sounds.js`, `src/lib/sounds.test.js`, `src/lib/soundCues.js`, `src/lib/soundCues.test.js`, `src/lib/soundFiles.test.js`, `src/components/system/SoundEffects.jsx`
- Modify: `package.json` (the `sounds` script), `src/App.jsx`, `src/store/system.test.js`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md`

**Interfaces:**
- Consumes:
  - From Task 1: `notifications`, `soundEffects` and `setSoundEffects`.
  - From the system store: `bootPhase` and `spotlightOpen`.
  - From the window store: `windows` and `minimizedStack`.
- Produces:
  - **Synth:** `SAMPLE_RATE = 16000`, `synthesizers: Record<SoundName, () => Float32Array>`, `renderSound(name) => Float32Array` (peak-normalized), and `encodeWav(samples, sampleRate) => Uint8Array`.
  - **Sound names:** `SOUND_NAMES = ['startup', 'minimize', 'restore', 'notification', 'spotlight']`.
  - **Volumes:** `CUE_VOLUME: Record<SoundName, number>`.
  - **Player:** `createSoundPlayer({ createContext?, loadBuffer? }) => { prime(): void, play(name, volume?): Promise<void> }`, and the shared instance `systemSounds`.
  - **Cues:** `soundSnapshot(windowState, systemState) => Snapshot` and `soundCues(previous, next) => SoundName[]`.

- [ ] **Step 1: Write the failing tests.**

`src/lib/synth.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SAMPLE_RATE, encodeWav, renderSound, synthesizers } from './synth';
import { SOUND_NAMES } from './sounds';

const text = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));

describe('synthesizers', () => {
    it('has one for every system sound', () => {
        expect(Object.keys(synthesizers).sort()).toEqual([...SOUND_NAMES].sort());
    });

    it('renders short, audible, in-range sounds', () => {
        SOUND_NAMES.forEach((name) => {
            const samples = renderSound(name);
            const peak = Math.max(...samples.map(Math.abs));
            expect(samples.length / SAMPLE_RATE, name).toBeLessThan(1.5);
            expect(peak, name).toBeGreaterThan(0.1);
            expect(peak, name).toBeLessThanOrEqual(1);
        });
    });

    it('is deterministic, so regenerating gives identical files', () => {
        SOUND_NAMES.forEach((name) => {
            expect(Array.from(renderSound(name)), name).toEqual(Array.from(renderSound(name)));
        });
    });
});

describe('encodeWav', () => {
    it('writes a 16-bit mono PCM WAV', () => {
        const bytes = encodeWav(new Float32Array([0, 0.5, -0.5]), 16000);
        const view = new DataView(bytes.buffer);
        expect(bytes.length).toBe(44 + 3 * 2);
        expect(text(bytes, 0, 4)).toBe('RIFF');
        expect(view.getUint32(4, true)).toBe(36 + 6);
        expect(text(bytes, 8, 4)).toBe('WAVE');
        expect(text(bytes, 12, 4)).toBe('fmt ');
        expect(view.getUint16(20, true)).toBe(1);
        expect(view.getUint16(22, true)).toBe(1);
        expect(view.getUint32(24, true)).toBe(16000);
        expect(view.getUint32(28, true)).toBe(32000);
        expect(view.getUint16(34, true)).toBe(16);
        expect(text(bytes, 36, 4)).toBe('data');
        expect(view.getUint32(40, true)).toBe(6);
        expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([0, 16384, -16384]);
    });

    it('clamps samples outside -1..1', () => {
        const view = new DataView(encodeWav(new Float32Array([2, -2]), 16000).buffer);
        expect([view.getInt16(44, true), view.getInt16(46, true)]).toEqual([32767, -32767]);
    });
});
```

Note on the expected values:
- `0.5 * 32767 = 16383.5` and `Math.round(16383.5) = 16384`.
- `Math.round(-16383.5) = -16383` in JavaScript, because `Math.round` rounds .5 toward +∞.

So encode with `Math.round(Math.abs(s) * 32767) * Math.sign(s)` to keep encoding symmetric, which gives `-16384`. The implementation in Step 3 does exactly this.

That's 5 tests.

`src/lib/sounds.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { CUE_VOLUME, SOUND_NAMES, createSoundPlayer } from './sounds';

const fakeContext = () => {
    const started = [];
    const context = {
        state: 'suspended',
        destination: { name: 'speakers' },
        resume: vi.fn(() => { context.state = 'running'; return Promise.resolve(); }),
        createBufferSource: () => {
            const source = { buffer: null, connect: vi.fn(), start: vi.fn(() => started.push(source.buffer)) };
            return source;
        },
        createGain: () => ({ gain: { value: 1 }, connect: vi.fn() }),
    };
    return { context, started };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createSoundPlayer', () => {
    it('stays silent and creates no audio context before the first gesture', async () => {
        const createContext = vi.fn();
        const player = createSoundPlayer({ createContext, loadBuffer: vi.fn() });
        await player.play('startup');
        expect(createContext).not.toHaveBeenCalled();
    });

    it('creates one context on the first gesture, resumes it, and preloads every sound', async () => {
        const { context } = fakeContext();
        const createContext = vi.fn(() => context);
        const loadBuffer = vi.fn(async (_context, name) => `buffer:${name}`);
        const player = createSoundPlayer({ createContext, loadBuffer });

        player.prime();
        player.prime();
        await flush();

        expect(createContext).toHaveBeenCalledTimes(1);
        expect(context.resume).toHaveBeenCalled();
        expect(loadBuffer.mock.calls.map(([, name]) => name)).toEqual(SOUND_NAMES);
    });

    it('plays a sound at its cue volume, loading each file once', async () => {
        const { context, started } = fakeContext();
        const loadBuffer = vi.fn(async (_context, name) => `buffer:${name}`);
        const gains = [];
        const createGain = context.createGain;
        context.createGain = () => { const gain = createGain(); gains.push(gain); return gain; };
        const player = createSoundPlayer({ createContext: () => context, loadBuffer });

        player.prime();
        await player.play('minimize');
        await player.play('minimize');

        expect(started).toEqual(['buffer:minimize', 'buffer:minimize']);
        expect(gains[0].gain.value).toBe(CUE_VOLUME.minimize);
        expect(loadBuffer.mock.calls.filter(([, name]) => name === 'minimize')).toHaveLength(1);
    });

    it('stays silent when a file fails to load, then retries next time', async () => {
        const { context, started } = fakeContext();
        const loadBuffer = vi.fn(async (_context, name) => `buffer:${name}`)
            .mockRejectedValueOnce(new Error('404'));
        const player = createSoundPlayer({ createContext: () => context, loadBuffer });

        player.prime();
        await flush();
        await expect(player.play('startup')).resolves.toBeUndefined();
        await player.play('startup');
        // The failed preload was forgotten: the first play reloaded, the second reused it.
        expect(started).toEqual(['buffer:startup', 'buffer:startup']);
    });

    it('does nothing where Web Audio is missing or blocked', async () => {
        const throwing = createSoundPlayer({ createContext: () => { throw new Error('blocked'); }, loadBuffer: vi.fn() });
        expect(() => throwing.prime()).not.toThrow();
        await expect(throwing.play('startup')).resolves.toBeUndefined();

        const missing = createSoundPlayer({ createContext: () => null, loadBuffer: vi.fn() });
        expect(() => missing.prime()).not.toThrow();
        await expect(missing.play('startup')).resolves.toBeUndefined();
    });

    it('ignores unknown sounds', async () => {
        const { context, started } = fakeContext();
        const player = createSoundPlayer({ createContext: () => context, loadBuffer: vi.fn(async () => 'buffer') });
        player.prime();
        await player.play('boing');
        expect(started).toEqual([]);
    });
});
```

In the "fails to load" test, `prime()` preloads `startup` first, and that load rejects. The player must forget the rejected promise, so the first `play` reloads it and the second reuses the cached buffer.

That's 6 tests.

`src/lib/soundCues.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { soundCues, soundSnapshot } from './soundCues';

const snap = (overrides = {}) => ({
    bootPhase: 'desktop',
    spotlightOpen: false,
    notificationIds: [],
    minimized: [],
    visible: [],
    ...overrides,
});

describe('soundSnapshot', () => {
    it('keeps only what sounds react to', () => {
        const windowState = {
            minimizedStack: ['resume'],
            windows: {
                finder: { isOpen: true, isMinimized: false },
                resume: { isOpen: true, isMinimized: true },
                safari: { isOpen: false, isMinimized: false },
            },
        };
        const systemState = { bootPhase: 'desktop', spotlightOpen: true, notifications: [{ id: 4 }, { id: 5 }] };
        expect(soundSnapshot(windowState, systemState)).toEqual({
            bootPhase: 'desktop',
            spotlightOpen: true,
            notificationIds: [4, 5],
            minimized: ['resume'],
            visible: ['finder'],
        });
    });
});

describe('soundCues', () => {
    it('chimes only when the visitor unlocks', () => {
        expect(soundCues(snap({ bootPhase: 'locked' }), snap())).toEqual(['startup']);
        expect(soundCues(snap({ bootPhase: 'booting' }), snap({ bootPhase: 'locked' }))).toEqual([]);
        expect(soundCues(snap({ bootPhase: 'booting' }), snap())).toEqual([]);
    });

    it('whooshes when a window minimizes', () => {
        expect(soundCues(snap({ visible: ['finder'] }), snap({ minimized: ['finder'] }))).toEqual(['minimize']);
    });

    it('whooshes back on restore, but not when a minimized window is closed', () => {
        expect(soundCues(snap({ minimized: ['finder'] }), snap({ visible: ['finder'] }))).toEqual(['restore']);
        expect(soundCues(snap({ minimized: ['finder'] }), snap())).toEqual([]);
    });

    it('blips once per new notification batch', () => {
        expect(soundCues(snap({ notificationIds: [1] }), snap({ notificationIds: [1, 2] }))).toEqual(['notification']);
        expect(soundCues(snap({ notificationIds: [1, 2] }), snap({ notificationIds: [2] }))).toEqual([]);
    });

    it('ticks when Spotlight opens', () => {
        expect(soundCues(snap(), snap({ spotlightOpen: true }))).toEqual(['spotlight']);
        expect(soundCues(snap({ spotlightOpen: true }), snap())).toEqual([]);
    });

    it('stays quiet for unrelated changes', () => {
        const before = snap({ visible: ['finder'], notificationIds: [3] });
        expect(soundCues(before, snap({ visible: ['finder', 'resume'], notificationIds: [3] }))).toEqual([]);
        expect(soundCues(before, before)).toEqual([]);
    });
});
```

That's 7 tests.

`src/lib/soundFiles.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, encodeWav, renderSound } from './synth';
import { SOUND_NAMES } from './sounds';

const soundPath = (name) => fileURLToPath(new URL(`../../public/sounds/${name}.wav`, import.meta.url));

describe('committed sound files', () => {
    it('exist, stay under 50 KB, and match the generator (npm run sounds)', () => {
        SOUND_NAMES.forEach((name) => {
            expect(statSync(soundPath(name)).size, name).toBeLessThan(50 * 1024);
            expect(new Uint8Array(readFileSync(soundPath(name))), name).toEqual(encodeWav(renderSound(name), SAMPLE_RATE));
        });
    });
});
```

That's 1 test.

Append inside the `describe('notifications', …)` block of `src/store/system.test.js`:

```js
    it('has sound effects on by default and can switch them', () => {
        expect(system().soundEffects).toBe(true);
        system().setSoundEffects(false);
        expect(system().soundEffects).toBe(false);
        system().setSoundEffects(true);
        expect(system().soundEffects).toBe(true);
    });
```

That's 1 test.

- [ ] **Step 2: Run the tests to verify they fail.** Run `npm test`. Expected: FAIL, because `./synth`, `./sounds` and `./soundCues` don't resolve. The `setSoundEffects` test passes already (Task 1 added it); that's fine.

- [ ] **Step 3: Create `src/lib/synth.js`.**

```js
// Synthesizes the system sounds that scripts/generate-sounds.mjs writes to
// public/sounds/. Original and royalty-free; noise is seeded, so regenerating
// produces byte-identical files.

export const SAMPLE_RATE = 16000;

const length = (seconds) => Math.round(seconds * SAMPLE_RATE);
const tone = (frequency, t) => Math.sin(2 * Math.PI * frequency * t);
// Linear attack, then exponential decay with time constant `decay` (seconds).
const envelope = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

const render = (seconds, sampleAt) => {
    const samples = new Float32Array(length(seconds));
    for (let i = 0; i < samples.length; i += 1) samples[i] = sampleAt(i / SAMPLE_RATE);
    return samples;
};

// mulberry32: tiny seeded PRNG giving uniform noise in -1..1.
const seededNoise = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    };
};

// Noise through a one-pole low-pass whose cutoff sweeps from `from` to `to` Hz,
// swelling in and out.
const whoosh = (seconds, from, to, seed) => {
    const random = seededNoise(seed);
    const samples = new Float32Array(length(seconds));
    let low = 0;

    for (let i = 0; i < samples.length; i += 1) {
        const progress = i / samples.length;
        const cutoff = from + (to - from) * progress;
        const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
        low += alpha * (random() - low);
        samples[i] = low * Math.sin(Math.PI * progress);
    }
    return samples;
};

export const synthesizers = {
    // A soft C-major swell, nothing like Apple's chime.
    startup: () => render(1.3, (t) => {
        const chord = [261.63, 329.63, 392.0, 523.25];
        const sum = chord.reduce((total, frequency, i) => total + tone(frequency, t) * (1 - i * 0.15), 0);
        return sum * envelope(t, 0.06, 0.45);
    }),
    minimize: () => whoosh(0.28, 3200, 400, 1),
    restore: () => whoosh(0.28, 400, 3200, 2),
    notification: () => render(0.32, (t) => {
        const first = t < 0.14 ? tone(988, t) * envelope(t, 0.005, 0.05) : 0;
        const second = t >= 0.12 ? tone(1319, t - 0.12) * envelope(t - 0.12, 0.005, 0.07) : 0;
        return first + second;
    }),
    spotlight: () => render(0.06, (t) => tone(1800, t) * envelope(t, 0.002, 0.012)),
};

const PEAKS = { startup: 0.7, minimize: 0.6, restore: 0.6, notification: 0.6, spotlight: 0.5 };

export const renderSound = (name) => {
    const samples = synthesizers[name]();
    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0) || 1;
    return samples.map((sample) => (sample / peak) * PEAKS[name]);
};

// 16-bit mono PCM. Symmetric rounding, clamped to -1..1.
export const encodeWav = (samples, sampleRate) => {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const writeText = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));

    writeText(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    samples.forEach((sample, i) => {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(44 + i * 2, Math.sign(clamped) * Math.round(Math.abs(clamped) * 32767), true);
    });
    return bytes;
};
```

- [ ] **Step 4: Create the generator and generate the files.**

`scripts/generate-sounds.mjs`:

```js
// Regenerates public/sounds/*.wav from src/lib/synth.js: `npm run sounds`.
// src/lib/soundFiles.test.js fails if the committed files drift from this.
import { mkdirSync, writeFileSync } from 'node:fs';

import { SAMPLE_RATE, encodeWav, renderSound } from '../src/lib/synth.js';
import { SOUND_NAMES } from '../src/lib/sounds.js';

const directory = new URL('../public/sounds/', import.meta.url);

mkdirSync(directory, { recursive: true });

SOUND_NAMES.forEach((name) => {
    const bytes = encodeWav(renderSound(name), SAMPLE_RATE);
    writeFileSync(new URL(`${name}.wav`, directory), bytes);
    console.log(`${name}.wav  ${(bytes.length / 1024).toFixed(1)} KB`);
});
```

In `package.json` `scripts`, add `"sounds": "node scripts/generate-sounds.mjs"` after `"test"`.

`src/lib/sounds.js` must exist before the script can run. Write Step 5 first, then run `npm run sounds`. Expect the five files to be listed, each under 50 KB; startup is about 40.7 KB.

- [ ] **Step 5: Create `src/lib/sounds.js`.**

```js
// System sounds over Web Audio. Silent until the first user gesture primes it
// (browser autoplay rules), and never throws: no Web Audio, a blocked context
// or a missing file just means no sound.

export const SOUND_NAMES = ['startup', 'minimize', 'restore', 'notification', 'spotlight'];

export const CUE_VOLUME = { startup: 0.5, minimize: 0.35, restore: 0.35, notification: 0.4, spotlight: 0.25 };

const defaultCreateContext = () => {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return AudioContext ? new AudioContext() : null;
};

const defaultLoadBuffer = async (context, name) => {
    const response = await fetch(`/sounds/${name}.wav`);
    if (!response.ok) throw new Error(`Missing sound: ${name}`);
    return context.decodeAudioData(await response.arrayBuffer());
};

export const createSoundPlayer = ({ createContext = defaultCreateContext, loadBuffer = defaultLoadBuffer } = {}) => {
    let context = null;
    let unavailable = false;
    const buffers = new Map();

    // A failed load is forgotten so the next play retries it.
    const load = (name) => {
        if (!buffers.has(name)) {
            const pending = loadBuffer(context, name);
            buffers.set(name, pending);
            pending.catch(() => buffers.delete(name));
        }
        return buffers.get(name);
    };

    return {
        // Call from a user gesture (pointerdown/keydown): creates the context
        // once, resumes it if the browser suspended it, and preloads every sound.
        prime() {
            if (unavailable) return;

            if (!context) {
                try {
                    context = createContext();
                } catch {
                    context = null;
                }
                if (!context) {
                    unavailable = true;
                    return;
                }
                SOUND_NAMES.forEach((name) => load(name).catch(() => {}));
            }

            if (context.state === 'suspended') context.resume?.().catch?.(() => {});
        },

        async play(name, volume = CUE_VOLUME[name]) {
            if (!context || !SOUND_NAMES.includes(name)) return;

            try {
                const buffer = await load(name);
                const source = context.createBufferSource();
                const gain = context.createGain();

                source.buffer = buffer;
                gain.gain.value = volume;
                source.connect(gain);
                gain.connect(context.destination);
                source.start(0);
            } catch {
                // Missing or undecodable file: stay silent.
            }
        },
    };
};

// Shared by SoundEffects; creating it touches no browser API.
export const systemSounds = createSoundPlayer();
```

Now run `npm run sounds` (Step 4) and check that `public/sounds/` has the 5 files.

- [ ] **Step 6: Create `src/lib/soundCues.js`.**

```js
// Which system sound to play when the stores change, from two snapshots.

export const soundSnapshot = (windowState, systemState) => ({
    bootPhase: systemState.bootPhase,
    spotlightOpen: systemState.spotlightOpen,
    notificationIds: systemState.notifications.map((notification) => notification.id),
    minimized: windowState.minimizedStack,
    visible: Object.keys(windowState.windows)
        .filter((id) => windowState.windows[id].isOpen && !windowState.windows[id].isMinimized),
});

export const soundCues = (previous, next) => {
    const cues = [];

    if (previous.bootPhase === 'locked' && next.bootPhase === 'desktop') cues.push('startup');
    if (next.minimized.some((id) => !previous.minimized.includes(id))) cues.push('minimize');
    // Leaving the dock counts as a restore only if the window is back on screen
    // (closing a minimized window also takes it off the dock).
    if (previous.minimized.some((id) => !next.minimized.includes(id) && next.visible.includes(id))) cues.push('restore');
    if (next.notificationIds.some((id) => !previous.notificationIds.includes(id))) cues.push('notification');
    if (!previous.spotlightOpen && next.spotlightOpen) cues.push('spotlight');

    return cues;
};
```

- [ ] **Step 7: Create `src/components/system/SoundEffects.jsx`.**

```jsx
import { useEffect } from 'react';

import { soundCues, soundSnapshot } from '../../lib/soundCues';
import { systemSounds } from '../../lib/sounds';
import useSystemStore from '../../store/system';
import useWindowStore from '../../store/window';

// Plays the system sounds. Every pointer/key press primes audio (the first one
// is the boot/lock-screen gesture, so the startup chime is allowed); store
// changes become cues.
const SoundEffects = () => {
    useEffect(() => {
        const prime = () => systemSounds.prime();
        const snapshot = () => soundSnapshot(useWindowStore.getState(), useSystemStore.getState());
        let previous = snapshot();

        const check = () => {
            const next = snapshot();
            const cues = soundCues(previous, next);

            previous = next;
            if (!useSystemStore.getState().soundEffects) return;
            cues.forEach((cue) => systemSounds.play(cue));
        };

        window.addEventListener('pointerdown', prime, true);
        window.addEventListener('keydown', prime, true);
        const unsubscribeWindows = useWindowStore.subscribe(check);
        const unsubscribeSystem = useSystemStore.subscribe(check);

        return () => {
            window.removeEventListener('pointerdown', prime, true);
            window.removeEventListener('keydown', prime, true);
            unsubscribeWindows();
            unsubscribeSystem();
        };
    }, []);

    return null;
};

export default SoundEffects;
```

In `src/App.jsx`:
- Add `import SoundEffects from "@components/system/SoundEffects"`.
- Render `<SoundEffects />` right after `<Notifications />`.

- [ ] **Step 8: Update the docs.**

In `CLAUDE.md`, after the Spotlight bullet, add:

`- **Notifications and sounds:** `notify({ appId, title, body, action })` (system store) shows a banner (`components/system/Notifications.jsx`, max 3, 5 s, hover pauses, click runs the `runMenuAction` action); it only works on the desktop, and lock/restart clear banners. Two welcome banners (`welcomeNotifications` in constants) are scheduled once per page load when the visitor unlocks. `SoundEffects` turns store changes into cues (`src/lib/soundCues.js`) for the Web Audio player (`src/lib/sounds.js`), which stays silent until the first user gesture. The `.wav` files in `public/sounds/` are synthesized by `npm run sounds` (`scripts/generate-sounds.mjs` + `src/lib/synth.js`); `soundFiles.test.js` fails if they drift from the generator, so regenerate after editing `synth.js`. `soundEffects` (system store) is the on/off switch for Phase 7's Control Center.`

Also in the Commands block, add a line: `npm run sounds    # regenerate public/sounds/*.wav from src/lib/synth.js`.

In the spec, under section 5b's "System sounds", add an indented note: `  - *Phase 6c note:* the files are synthesized by `scripts/generate-sounds.mjs` (original, royalty-free, deterministic). The empty-trash crunch comes with the Archive easter egg (Phase 9); the Sound Effects toggle UI, the Focus tile and notification history come with Control Center (Phase 7).`

- [ ] **Step 9: Run the checks.**
- `npm test`: expect 229 passing. That's 209 plus 5 synth, 6 sounds, 7 soundCues, 1 sound files and 1 system store.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors. The generator uses `console.log` and Node imports only, with no `process` or `Buffer` globals.
- `npm run build`: passes.
- `ls -l public/sounds`: 5 files, each under 50 KB.

- [ ] **Step 10: Commit.**

```bash
git add src/lib/synth.js src/lib/synth.test.js scripts/generate-sounds.mjs public/sounds/startup.wav public/sounds/minimize.wav public/sounds/restore.wav public/sounds/notification.wav public/sounds/spotlight.wav src/lib/sounds.js src/lib/sounds.test.js src/lib/soundCues.js src/lib/soundCues.test.js src/lib/soundFiles.test.js src/components/system/SoundEffects.jsx src/App.jsx src/store/system.test.js package.json CLAUDE.md docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md
git commit -m "feat: synthesized system sounds for unlock, minimize, restore, notifications and Spotlight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11: Chrome checks (controller).**
- **Startup chime:** after `sessionStorage.clear()` and a reload, clicking through boot and lock plays the chime on unlock.
- **Minimize and restore:** minimizing a window whooshes, and restoring it from the dock whooshes back.
- **Closing from the dock:** closing a minimized window plays nothing.
- **Notification:** the welcome banner blips.
- **Spotlight:** Cmd+K ticks.
- **Sound Effects off:** after `setSoundEffects(false)` via the store, nothing plays.
- **Console:** stays free of errors and warnings throughout.
