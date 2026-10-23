# Phase 7 — Music, Audio Controller and Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three things:
- **A Music app** modeled on Apple Music. It has a player bar with transport, an LCD and a volume slider, a sidebar (Listen Now, Library → Songs / Albums), album grids and a song table.
- **One audio controller** that keeps playing after the window closes. It is driven from Music, Spotlight and Control Center, and posts a "Now Playing" banner when a track starts while Music is closed.
- **A working Control Center**, with:
  - the Sound slider (music volume);
  - the Display slider (dimming);
  - a Now Playing mini player;
  - a Focus tile that suppresses banners;
  - a Sound Effects toggle;
  - recent notification history;
  - decorative Wi-Fi, Bluetooth and AirDrop tiles.

**Architecture:**
- **Playback state** lives in the system store (`audio`). Actions such as `playTrack`, `togglePlay`, `nextTrack`, `previousTrack`, `seekTo` and `setVolume` are pure state changes and are unit-tested. Pure helpers live in `src/lib/music.js`.
- **`AudioController`** is mounted once. It owns the only `<audio>` element and mirrors the store into it: source, play/pause, volume and seeks. It mirrors the element back into the store: position, duration and track end.
- **The Music window and Control Center** only read the store and call its actions.
- **Placeholder tracks** are original loops synthesized by `scripts/generate-music.mjs` from `src/lib/musicSynth.js`, the same approach as the system sounds. The owner swaps them for real MP3s by editing the `tracks` list.

**Tech Stack:** React 19, Zustand 5 + Immer, the HTML `<audio>` element, lucide-react, Node (generator), Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md`. This plan covers:
- Section 4, "Music".
- Section 5, "Control Center".
- Section 5b, "Now Playing" banners and the Focus tile.
- Section 1, the system store audio state.
- Build-order phase 7.

**Decisions:**
- **Placeholder music**, as the user chose: 3 original 18-second loops (16 kHz mono WAV, about 563 KB each) across 2 albums. The artist is "Studio Placeholder" and the covers are gradient tiles. Real tracks replace them by editing `tracks` in `src/constants/index.js` and dropping files in `public/music/`. `cover` takes an image path; `null` means a gradient.
- **No "Browse" view.** The spec's sidebar lists Listen Now and Browse, but there is no catalog to browse. Listen Now shows the albums, and Library has Songs and Albums.
- **Clicking a song plays it.** Apple's double-click is unfriendly to visitors who don't expect it.
- **Next and previous keep the current play/pause state**, like Apple Music.
  - Next at the last track stops playback and rewinds.
  - Previous more than 3 s into a track restarts it.
  - Previous at the first track rewinds.
- **The store is the source of truth.** The `<audio>` element's own `pause` event is not mirrored back, because changing `src` fires it and that would stop the next track. Hardware media keys go through `navigator.mediaSession` action handlers to the same store actions. A `play()` refused by autoplay rules (any error but `AbortError`, which only means a newer load interrupted it) sets `isPlaying` back to false.
- **Lock and restart don't stop the music**, the same as a real Mac.
- **Control Center** opens from the menu-bar Control Center icon (`/icons/mode.svg`, the existing fourth status icon). Control Center, Spotlight and Mission Control close each other, and lock/restart close Control Center.
- **Focus** suppresses banners, so there is no notification blip either. Each notification still goes to `notificationHistory`, which keeps the newest 10, survives lock, and can be cleared.
- **The Display slider dims from 100% down to 30%**, using a black overlay that ignores the pointer, at z 190000 (above everything except boot/lock).
- **The Wi-Fi, Bluetooth and AirDrop tiles are decorative**, as in the spec. They flip their look locally and do nothing.
- **Spotlight indexes songs** in a new "Songs" group. Choosing one plays it, through the new `playTrack` menu action.
- **Tests** cover the pure logic and the store. The generated music files are byte-checked against the generator with a 600 KB cap each.

## Global Constraints

- **Music:**
  - Apple-Music-style UI: a sidebar (Listen Now, Library → Songs / Albums), an album-art grid or song table (title, artist, album, time), and a top player bar with transport, an LCD now-playing area (cover, title, scrubber, elapsed/remaining) and volume.
  - `tracks` in constants: `{ id, title, artist, album, cover, src, duration }`. Files live in `public/music/`.
- **`AudioController`**, mounted once in `App.jsx`, owns the single `<audio>` element and syncs with the system store.
  - Playback continues when the window closes.
  - Control Center and Spotlight drive the same player.
- **Control Center:**
  - Real: the Sound slider (music volume), the Display slider (dimming overlay) and the Now Playing mini-player.
  - Decorative: the Wi-Fi, Bluetooth, AirDrop and Focus tiles. The Focus tile becomes real: it suppresses banners.
  - A "Sound Effects" toggle, independent of the music volume.
  - Recent notification history listed at the bottom.
- **System banners:** "Now Playing" appears when a track starts while Music is closed.
- **Errors:** an `audio.play()` rejection (autoplay policy) is caught and leaves the player paused. Missing covers fall back to gradient tiles.
- **New apps** go on the desktop (`placement: ['desktop']`), not the dock.
- **Window components:**
  - put `data-titlebar` on the header;
  - make the root fill the section;
  - never clip or position the `<section>` in CSS;
  - export Terminal-style: `const XWindow = WindowWrapper(X, 'key'); export default XWindow;`.
- **Shortcuts and listeners:** desktop shortcuts and global listeners check `isDesktopPhase(useSystemStore.getState())`.
- **Tests:** Vitest covers pure logic and stores only. Never import a window or component, or `src/lib/firebase.js`, from a test. UI is verified in Chrome by the controller.
- **Lint:** `npx eslint . --ignore-pattern .superpowers` stays at 10 errors and 0 warnings. Never edit or commit `._*` files, or the untracked `plan.md`, `page-render-check.png` and `website-screenshot.png`. Stage by path.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The branch is `feature/music-control-center`.

## Review Focus

1. **Next, previous or ended at either end of the list.** These must not throw or play nothing. Next at the end stops and rewinds, previous at the start rewinds, and previous after 3 s restarts. Pinned in Task 1 (store tests).
2. **Seeking past the end or below 0, a NaN duration, or a volume outside 0..1.** All must be clamped. Pinned in Task 1.
3. **Autoplay refusal or a missing file.** The UI must show paused, never "playing" while silent. A quick track change must *not* pause, because that rejection is an `AbortError`. Verified in Chrome (Task 3); the logic is in `AudioController`.
4. **Focus on.** Banners and blips stop, but notifications still reach the history. Pinned in Task 4.
5. **Overlay stacking.** Control Center must never stack with Spotlight or Mission Control, and must close on lock and restart. Pinned in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/music.js` + test (create) | `formatTime`, `trackById`, `adjacentTrackId`, `clampVolume`, `albumsOf`, `coverGradient`, `nowPlayingNotification` |
| `src/constants/index.js` (modify) | `tracks` |
| `src/constants/apps.js` + test, `public/images/music.svg` (modify/create) | `music` registry entry and icon |
| `src/store/system.js` + test (modify) | `audio` state and actions (Task 1). Control Center, brightness, Focus and history (Task 4) |
| `src/lib/menuActions.js` + test (modify) | `playTrack` action |
| `src/lib/spotlight.js` + test (modify) | "Songs" group |
| `src/lib/musicSynth.js` + test, `scripts/generate-music.mjs`, `public/music/*.wav` (create) | Placeholder tracks |
| `src/components/system/AudioController.jsx` (create) | The single `<audio>` element and Media Session |
| `src/windows/Music.jsx` (create), `src/windows/index.js`, `src/App.jsx` (modify) | Music window |
| `src/components/system/ControlCenter.jsx`, `src/components/system/DisplayDimmer.jsx` (create) | Control Center panel, dimming overlay |
| `src/components/Navbar.jsx`, `src/components/system/Spotlight.jsx`, `src/components/system/DesktopContextMenu.jsx`, `src/lib/notifications.js` (modify) | Control Center toggle, songs in Spotlight, native-menu areas, `HISTORY_LIMIT` |
| `src/index.css`, `package.json`, `CLAUDE.md`, `AGENTS.md`, spec (modify) | Styles, `music` script, docs |

---

### Task 1: Music data, playback state, registry entry, songs in Spotlight

**Files:**
- Create: `src/lib/music.js`, `src/lib/music.test.js`, `public/images/music.svg`
- Modify: `src/constants/index.js`, `src/constants/apps.js`, `src/constants/apps.test.js`, `src/store/system.js`, `src/store/system.test.js`, `src/lib/menuActions.js`, `src/lib/menuActions.test.js`, `src/lib/spotlight.js`, `src/lib/spotlight.test.js`

**Interfaces:**
- Consumes: the registry, the system store, `runMenuAction`, `buildSpotlightIndex`.
- Produces:
  - **Track list:** `tracks` is a `Track[]`, where `Track = { id, title, artist, album, cover: string | null, src: string, duration: number }`. It is exported from `src/constants/index.js`.
  - **Helpers in `src/lib/music.js`:**
    - `formatTime(seconds) => 'm:ss'`
    - `trackById(list, id) => Track | null`
    - `adjacentTrackId(list, id, step) => string | null`
    - `clampVolume(v) => number` (0..1)
    - `albumsOf(list) => Array<{ title, artist, cover, tracks }>`
    - `coverGradient(seed) => css string`
    - `nowPlayingNotification(track) => notify input`
  - **System store state:** `audio: { currentTrackId: string | null, isPlaying: boolean, volume: number, position: number, duration: number, seekNonce: number }`. `seekNonce` bumps only on seeks the visitor or the player asked for.
  - **System store actions:** `playTrack(id)`, `togglePlay()`, `setPlaying(bool)`, `nextTrack()`, `previousTrack()`, `seekTo(seconds)`, `setAudioPosition(seconds)`, `setAudioDuration(seconds)`, `setVolume(v)`.
  - **Menu action:** `{ type: 'playTrack', id }`.
  - **Registry entry:** `music`, with `placement: ['desktop']`, icon `/images/music.svg`, `desktopPosition` `{ top: 360, left: 20 }`, `defaultBounds` `{ x: 240, y: 90, w: 900, h: 560 }` and `minSize` `{ w: 640, h: 400 }`.
  - **Spotlight:** a `{ id: 'tracks', label: 'Songs' }` group. `buildSpotlightIndex({ …, tracks })` adds songs, and `tracks` defaults to `[]`.

- [ ] **Step 1: Write the failing tests.**

Create `src/lib/music.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
    adjacentTrackId, albumsOf, clampVolume, coverGradient, formatTime, nowPlayingNotification, trackById,
} from './music';
import { tracks } from '../constants';

const list = [
    { id: 'a', title: 'A', artist: 'X', album: 'One', cover: null },
    { id: 'b', title: 'B', artist: 'X', album: 'Two', cover: '/b.jpg' },
    { id: 'c', title: 'C', artist: 'X', album: 'One', cover: null },
];

describe('formatTime', () => {
    it('shows minutes and two-digit seconds, and 0:00 for anything unusable', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(59.9)).toBe('0:59');
        expect(formatTime(3600)).toBe('60:00');
        expect(formatTime(-4)).toBe('0:00');
        expect(formatTime(NaN)).toBe('0:00');
        expect(formatTime(undefined)).toBe('0:00');
        expect(formatTime(Infinity)).toBe('0:00');
    });
});

describe('track helpers', () => {
    it('finds tracks and their neighbours, or nothing', () => {
        expect(trackById(list, 'b').title).toBe('B');
        expect(trackById(list, 'z')).toBeNull();
        expect(adjacentTrackId(list, 'a', 1)).toBe('b');
        expect(adjacentTrackId(list, 'b', -1)).toBe('a');
        expect(adjacentTrackId(list, 'c', 1)).toBeNull();
        expect(adjacentTrackId(list, 'a', -1)).toBeNull();
        expect(adjacentTrackId(list, 'z', 1)).toBeNull();
        expect(adjacentTrackId(list, null, 1)).toBeNull();
    });

    it('keeps volume between 0 and 1', () => {
        expect(clampVolume(0.4)).toBe(0.4);
        expect(clampVolume(3)).toBe(1);
        expect(clampVolume(-1)).toBe(0);
        expect(clampVolume('x')).toBe(0);
    });

    it('groups tracks into albums in first-appearance order', () => {
        expect(albumsOf(list).map((album) => [album.title, album.cover, album.tracks.map((track) => track.id)])).toEqual([
            ['One', null, ['a', 'c']],
            ['Two', '/b.jpg', ['b']],
        ]);
    });

    it('draws a stable gradient per album', () => {
        expect(coverGradient('Desk Sessions')).toBe(coverGradient('Desk Sessions'));
        expect(coverGradient('Desk Sessions')).not.toBe(coverGradient('Side Projects'));
        expect(coverGradient('Desk Sessions')).toMatch(/^linear-gradient\(/);
    });

    it('announces a track that starts while Music is closed', () => {
        expect(nowPlayingNotification({ title: 'First Light', artist: 'Studio Placeholder' })).toEqual({
            appId: 'music',
            title: 'Now Playing',
            body: 'First Light — Studio Placeholder',
            action: { type: 'openApp', id: 'music' },
        });
    });
});

describe('tracks', () => {
    it('lists playable placeholder tracks with unique ids', () => {
        expect(tracks.length).toBeGreaterThanOrEqual(2);
        expect(new Set(tracks.map((track) => track.id)).size).toBe(tracks.length);
        tracks.forEach((track) => {
            expect(track, track.id).toMatchObject({
                title: expect.any(String),
                artist: expect.any(String),
                album: expect.any(String),
                src: `/music/${track.id}.wav`,
            });
            expect(track.duration, track.id).toBeGreaterThan(0);
        });
    });
});
```

That's 7 tests.

Append to `src/store/system.test.js`. Add `import { tracks } from '../constants';` to the file's imports.

```js
describe('music playback', () => {
    const [first, second, third] = tracks;

    it('starts stopped, at the default volume, with nothing loaded', () => {
        expect(system().audio).toEqual({
            currentTrackId: null, isPlaying: false, volume: 0.6, position: 0, duration: 0, seekNonce: 0,
        });
    });

    it('plays a track from the start and ignores unknown ones', () => {
        system().playTrack(second.id);
        expect(system().audio).toMatchObject({ currentTrackId: second.id, isPlaying: true, position: 0, seekNonce: 1 });
        system().playTrack('nope');
        expect(system().audio.currentTrackId).toBe(second.id);
    });

    it('toggles play, starting the first track when nothing is loaded', () => {
        system().togglePlay();
        expect(system().audio).toMatchObject({ currentTrackId: first.id, isPlaying: true });
        system().togglePlay();
        expect(system().audio.isPlaying).toBe(false);
        system().togglePlay();
        expect(system().audio.isPlaying).toBe(true);
    });

    it('skips forward keeping play state, and stops at the end of the list', () => {
        system().playTrack(second.id);
        system().nextTrack();
        expect(system().audio).toMatchObject({ currentTrackId: third.id, isPlaying: true });
        system().setAudioPosition(5);
        system().nextTrack();
        expect(system().audio).toMatchObject({ currentTrackId: third.id, isPlaying: false, position: 0 });
    });

    it('goes back a track, or restarts one more than 3 seconds in', () => {
        system().playTrack(second.id);
        system().setAudioPosition(10);
        const nonce = system().audio.seekNonce;
        system().previousTrack();
        expect(system().audio).toMatchObject({ currentTrackId: second.id, position: 0, seekNonce: nonce + 1 });
        system().previousTrack();
        expect(system().audio.currentTrackId).toBe(first.id);
        system().previousTrack();
        expect(system().audio).toMatchObject({ currentTrackId: first.id, position: 0 });
    });

    it('clamps volume and seeks, counting only the seeks someone asked for', () => {
        system().setVolume(2);
        expect(system().audio.volume).toBe(1);
        system().setVolume(-1);
        expect(system().audio.volume).toBe(0);

        system().playTrack(first.id);
        system().setAudioDuration(18);
        const nonce = system().audio.seekNonce;
        system().setAudioPosition(4);
        expect(system().audio).toMatchObject({ position: 4, seekNonce: nonce });
        system().seekTo(30);
        expect(system().audio).toMatchObject({ position: 18, seekNonce: nonce + 1 });
        system().seekTo(-5);
        expect(system().audio.position).toBe(0);
        system().setAudioDuration(NaN);
        expect(system().audio.duration).toBe(0);
    });

    it('can be paused and resumed from outside (media keys, a refused play)', () => {
        system().setPlaying(true);
        expect(system().audio.isPlaying).toBe(false);
        system().playTrack(first.id);
        system().setPlaying(false);
        expect(system().audio.isPlaying).toBe(false);
        system().setPlaying(true);
        expect(system().audio.isPlaying).toBe(true);
    });
});
```

That's 7 tests.

Append inside the `describe('runMenuAction', …)` block of `src/lib/menuActions.test.js`. Add `import { tracks } from '../constants';` to its imports.

```js
    it('plays a song', () => {
        runMenuAction({ type: 'playTrack', id: tracks[0].id });
        expect(system().audio).toMatchObject({ currentTrackId: tracks[0].id, isPlaying: true });
    });
```

That's 1 test.

In `src/lib/spotlight.test.js`, change the expected app id list in `'indexes every app that does something, but not the Archive'` to:

```js
        expect(ids).toEqual(['app:finder', 'app:contact', 'app:terminal', 'app:resume', 'app:safari', 'app:music', 'app:missionControl', 'app:about']);
```

Then add this test to the `buildSpotlightIndex` describe:

```js
    it('lists songs that play when chosen', () => {
        const index = buildSpotlightIndex({
            apps: [],
            tracks: [{ id: 't1', title: 'First Light', artist: 'Studio Placeholder', album: 'Desk Sessions' }],
        });
        expect(index).toEqual([{
            id: 'track:t1',
            group: 'tracks',
            title: 'First Light',
            subtitle: 'Studio Placeholder — Desk Sessions',
            icon: '/images/music.svg',
            keywords: ['Studio Placeholder', 'Desk Sessions'],
            action: { type: 'playTrack', id: 't1' },
        }]);
        expect(titles(searchSpotlight(index, 'desk'))).toEqual([['tracks', ['First Light']]]);
    });
```

That's 1 test. The `titles` helper is already defined at the top of that file.

In `src/constants/apps.test.js`:
- In `'derives desktop items using label and desktopIcon overrides'`, append `{ id: 'music', title: 'Music', icon: '/images/music.svg', position: { top: 360, left: 20 } },` after the safari item.
- In `'builds a closed window entry for every windowed app only'`, change the key list to `['about', 'contact', 'finder', 'music', 'resume', 'safari', 'terminal']`.

- [ ] **Step 2: Run the tests to verify they fail.** Run `npm test`. Expected: FAIL. `./music` doesn't resolve, `tracks` is undefined, and the store actions, the `playTrack` action, the Songs group and the registry entry are all missing.

- [ ] **Step 3: Create `src/lib/music.js`.**

```js
// Pure helpers for the Music app and its player (state lives in the system
// store; AudioController drives the <audio> element).

export const formatTime = (seconds) => {
    const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const trackById = (list, id) => list.find((track) => track.id === id) ?? null;

export const adjacentTrackId = (list, id, step) => {
    const index = list.findIndex((track) => track.id === id);
    if (index === -1) return null;
    return list[index + step]?.id ?? null;
};

export const clampVolume = (volume) => Math.min(1, Math.max(0, Number(volume) || 0));

export const albumsOf = (list) => list.reduce((albums, track) => {
    let album = albums.find((entry) => entry.title === track.album);
    if (!album) {
        album = { title: track.album, artist: track.artist, cover: track.cover ?? null, tracks: [] };
        albums.push(album);
    }
    album.tracks.push(track);
    return albums;
}, []);

// Stand-in artwork until real covers exist: a gradient whose hue comes from the name.
export const coverGradient = (seed) => {
    const hue = [...String(seed)].reduce((value, char) => (value * 31 + char.charCodeAt(0)) % 360, 7);
    return `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 50) % 360} 75% 34%))`;
};

export const nowPlayingNotification = (track) => ({
    appId: 'music',
    title: 'Now Playing',
    body: `${track.title} — ${track.artist}`,
    action: { type: 'openApp', id: 'music' },
});
```

- [ ] **Step 4: Add the tracks.** In `src/constants/index.js`, add this after `welcomeNotifications`, and add `tracks,` to the `export { … }` list:

```js
// Music library. Placeholder loops generated by `npm run music`
// (scripts/generate-music.mjs); to use real songs, put the files in
// public/music/, list them here, and set `cover` to an image path (null draws
// a gradient tile).
const tracks = [
    { id: 'first-light', title: 'First Light', artist: 'Studio Placeholder', album: 'Desk Sessions', cover: null, src: '/music/first-light.wav', duration: 18 },
    { id: 'night-shift', title: 'Night Shift', artist: 'Studio Placeholder', album: 'Desk Sessions', cover: null, src: '/music/night-shift.wav', duration: 18 },
    { id: 'paper-planes', title: 'Paper Planes', artist: 'Studio Placeholder', album: 'Side Projects', cover: null, src: '/music/paper-planes.wav', duration: 18 },
];
```

- [ ] **Step 5: Add the registry entry and icon.**

In `src/constants/apps.js`, add this entry right after the `safari` entry:

```js
    {
        id: 'music',
        title: 'Music',
        keywords: ['songs', 'audio', 'player', 'tunes', 'playlist'],
        icon: '/images/music.svg',
        placement: ['desktop'],
        desktopPosition: { top: 360, left: 20 },
        defaultBounds: { x: 240, y: 90, w: 900, h: 560 },
        minSize: { w: 640, h: 400 },
    },
```

None of these keywords contains "res" or starts with "pr", so Spotlight's existing search tests still hold.

Create `public/images/music.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="music-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fd5c7c"/>
      <stop offset="1" stop-color="#f4213f"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="240" height="240" rx="56" fill="url(#music-bg)"/>
  <path d="M104 72 L184 56 V82 L104 98 Z" fill="#fff"/>
  <rect x="104" y="72" width="14" height="104" fill="#fff"/>
  <rect x="170" y="56" width="14" height="104" fill="#fff"/>
  <ellipse cx="92" cy="178" rx="26" ry="20" fill="#fff"/>
  <ellipse cx="158" cy="162" rx="26" ry="20" fill="#fff"/>
</svg>
```

- [ ] **Step 6: Add playback to `src/store/system.js`.**
- Add the imports `import { tracks } from '../constants';` and `import { adjacentTrackId, clampVolume, trackById } from '../lib/music';`.
- In `createInitialSystemState`, add:

```js
  audio: { currentTrackId: null, isPlaying: false, volume: 0.6, position: 0, duration: 0, seekNonce: 0 },
```

- Above `const useSystemStore`, add:

```js
// Starts `id` from the beginning; seekNonce tells AudioController to seek.
const loadTrack = (state, id, play) => {
  state.audio.currentTrackId = id;
  state.audio.isPlaying = play;
  state.audio.position = 0;
  state.audio.duration = 0;
  state.audio.seekNonce += 1;
};

const rewind = (state) => {
  state.audio.position = 0;
  state.audio.seekNonce += 1;
};
```

- Add these actions after `setSoundEffects`:

```js
    // Music. The store is the source of truth; AudioController mirrors it into
    // the single <audio> element. Lock/restart leave the music playing.
    playTrack: (id) =>
      set((state) => {
        if (trackById(tracks, id)) loadTrack(state, id, true);
      }),

    togglePlay: () =>
      set((state) => {
        if (!state.audio.currentTrackId) {
          if (tracks[0]) loadTrack(state, tracks[0].id, true);
          return;
        }
        state.audio.isPlaying = !state.audio.isPlaying;
      }),

    setPlaying: (playing) =>
      set((state) => {
        state.audio.isPlaying = Boolean(playing) && Boolean(state.audio.currentTrackId);
      }),

    // Next/previous keep play/pause, like Apple Music.
    nextTrack: () =>
      set((state) => {
        const { currentTrackId, isPlaying } = state.audio;
        if (!currentTrackId) return;

        const next = adjacentTrackId(tracks, currentTrackId, 1);
        if (next) {
          loadTrack(state, next, isPlaying);
        } else {
          state.audio.isPlaying = false;
          rewind(state);
        }
      }),

    previousTrack: () =>
      set((state) => {
        const { currentTrackId, position, isPlaying } = state.audio;
        if (!currentTrackId) return;

        const previous = position > 3 ? null : adjacentTrackId(tracks, currentTrackId, -1);
        if (previous) loadTrack(state, previous, isPlaying);
        else rewind(state);
      }),

    seekTo: (seconds) =>
      set((state) => {
        if (!state.audio.currentTrackId) return;
        const end = state.audio.duration || Infinity;
        state.audio.position = Math.min(end, Math.max(0, Number(seconds) || 0));
        state.audio.seekNonce += 1;
      }),

    // From the <audio> element: no seekNonce bump, so nothing echoes back.
    setAudioPosition: (seconds) =>
      set((state) => {
        state.audio.position = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      }),

    setAudioDuration: (seconds) =>
      set((state) => {
        state.audio.duration = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
      }),

    setVolume: (volume) =>
      set((state) => {
        state.audio.volume = clampVolume(volume);
      }),
```

- [ ] **Step 7: Add the `playTrack` menu action.** In `src/lib/menuActions.js`, add before `default:`:

```js
        case 'playTrack':
            system.playTrack(action.id);
            break;
```

- [ ] **Step 8: Add songs to Spotlight.** In `src/lib/spotlight.js`:
- Append `{ id: 'tracks', label: 'Songs' },` to `SPOTLIGHT_GROUPS`.
- Change the top comment's last sentence to `Notes join in Phase 8.`
- Add, before `buildSpotlightIndex`:

```js
const trackEntries = (list) => list
    .filter((track) => isText(track?.title))
    .map((track) => ({
        id: `track:${track.id}`,
        group: 'tracks',
        title: track.title.trim(),
        subtitle: [track.artist, track.album].filter(isText).join(' — '),
        icon: '/images/music.svg',
        keywords: [track.artist, track.album].filter(isText),
        action: { type: 'playTrack', id: track.id },
    }));
```

- Change `buildSpotlightIndex` to:

```js
export const buildSpotlightIndex = ({ apps = APPS, projects = [], skills = [], tracks = [] } = {}) => [
    ...appEntries(apps),
    ...projectEntries(projects),
    ...skillEntries(skills),
    ...trackEntries(tracks),
];
```

- [ ] **Step 9: Run the checks.**
- `npm test`: expect 247 passing. That's 231 plus 7 music, 7 store, 1 menuActions and 1 spotlight; the apps.test edits change existing tests.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 10: Commit.**

```bash
git add src/lib/music.js src/lib/music.test.js public/images/music.svg src/constants/index.js src/constants/apps.js src/constants/apps.test.js src/store/system.js src/store/system.test.js src/lib/menuActions.js src/lib/menuActions.test.js src/lib/spotlight.js src/lib/spotlight.test.js
git commit -m "feat: music library, playback state, Music registry entry and songs in Spotlight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Placeholder tracks

**Files:**
- Create: `src/lib/musicSynth.js`, `src/lib/musicSynth.test.js`, `scripts/generate-music.mjs`, `public/music/first-light.wav`, `public/music/night-shift.wav`, `public/music/paper-planes.wav` (generated)
- Modify: `package.json` (the `music` script)

**Interfaces:**
- Consumes: `SAMPLE_RATE` and `encodeWav` from `src/lib/synth.js` (Phase 6c), and `tracks` (Task 1).
- Produces:
  - `PIECES: Record<trackId, { seconds, bpm, chords }>`
  - `renderPiece(id) => Float32Array`, peak-normalized to 0.6.

- [ ] **Step 1: Write the failing test.** Create `src/lib/musicSynth.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PIECES, renderPiece } from './musicSynth';
import { SAMPLE_RATE, encodeWav } from './synth';
import { tracks } from '../constants';

const filePath = (src) => fileURLToPath(new URL(`../../public${src}`, import.meta.url));

describe('placeholder music', () => {
    it('has a piece for every track, as long as the track says, audible and in range', () => {
        expect(Object.keys(PIECES).sort()).toEqual(tracks.map((track) => track.id).sort());
        tracks.forEach((track) => {
            const samples = renderPiece(track.id);
            const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
            expect(samples.length / SAMPLE_RATE, track.id).toBeCloseTo(track.duration, 3);
            expect(peak, track.id).toBeGreaterThan(0.3);
            expect(peak, track.id).toBeLessThanOrEqual(1);
        });
    });

    it('is deterministic', () => {
        const id = tracks[0].id;
        expect(renderPiece(id)).toEqual(renderPiece(id));
    });

    it('matches the committed files (npm run music), each under 600 KB', () => {
        tracks.forEach((track) => {
            expect(statSync(filePath(track.src)).size, track.id).toBeLessThan(600 * 1024);
            expect(new Uint8Array(readFileSync(filePath(track.src))), track.id)
                .toEqual(encodeWav(renderPiece(track.id), SAMPLE_RATE));
        });
    });
});
```

That's 3 tests.

- [ ] **Step 2: Run the test to verify it fails.** Run `npx vitest run src/lib/musicSynth.test.js`. Expected: FAIL, because `./musicSynth` doesn't resolve.

- [ ] **Step 3: Create `src/lib/musicSynth.js`.**

```js
// Placeholder songs for the Music app: short, original loops (pad + arpeggio +
// bass over four chords) written to public/music/ by scripts/generate-music.mjs.
// Deterministic, so regenerating gives byte-identical files.
import { SAMPLE_RATE } from './synth';

// Chords as semitones from A3 (220 Hz): C=[3,7,10], G=[-2,2,5], Am=[0,3,7], F=[-4,0,3], Dm=[-7,-4,0], D=[5,9,12].
export const PIECES = {
    'first-light': { seconds: 18, bpm: 84, chords: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]] },
    'night-shift': { seconds: 18, bpm: 72, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-2, 2, 5]] },
    'paper-planes': { seconds: 18, bpm: 96, chords: [[5, 9, 12], [3, 7, 10], [0, 3, 7], [-2, 2, 5]] },
};

const frequency = (semitones) => 220 * 2 ** (semitones / 12);
const sine = (semitones, t) => Math.sin(2 * Math.PI * frequency(semitones) * t);

export const renderPiece = (id) => {
    const { seconds, bpm, chords } = PIECES[id];
    const beat = 60 / bpm;
    const bar = beat * 4;
    const step = beat / 2;
    const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE));

    for (let i = 0; i < samples.length; i += 1) {
        const t = i / SAMPLE_RATE;
        const chord = chords[Math.floor(t / bar) % chords.length];
        // Short fades at bar edges hide the chord change.
        const barPosition = (t % bar) / bar;
        const barFade = Math.min(1, barPosition / 0.04, (1 - barPosition) / 0.04);
        const pad = chord.reduce((sum, note) => sum + sine(note, t), 0) / chord.length;

        const stepIndex = Math.floor(t / step);
        const intoStep = t - stepIndex * step;
        const arpeggio = sine(chord[stepIndex % chord.length] + 12, t) * Math.min(1, intoStep / 0.005) * Math.exp(-intoStep / 0.18);
        const bass = sine(chord[0] - 12, t);

        const fade = Math.min(1, t / 1.5, (seconds - t) / 1.5);
        samples[i] = (0.35 * pad * barFade + 0.4 * arpeggio + 0.25 * bass * barFade) * fade;
    }

    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0) || 1;
    return samples.map((sample) => (sample / peak) * 0.6);
};
```

- [ ] **Step 4: Create the generator and the files.** Create `scripts/generate-music.mjs`:

```js
// Regenerates the placeholder songs in public/music/: `npm run music`.
// src/lib/musicSynth.test.js fails if the committed files drift from this.
import { mkdirSync, writeFileSync } from 'node:fs';

import { PIECES, renderPiece } from '../src/lib/musicSynth.js';
import { SAMPLE_RATE, encodeWav } from '../src/lib/synth.js';

const directory = new URL('../public/music/', import.meta.url);

mkdirSync(directory, { recursive: true });

Object.keys(PIECES).forEach((id) => {
    const bytes = encodeWav(renderPiece(id), SAMPLE_RATE);
    writeFileSync(new URL(`${id}.wav`, directory), bytes);
    console.log(`${id}.wav  ${(bytes.length / 1024).toFixed(1)} KB`);
});
```

In `package.json` `scripts`, add `"music": "node scripts/generate-music.mjs"` after `"sounds"`.

Run `npm run music`. Expect 3 files of about 562.5 KB each.

- [ ] **Step 5: Run the checks.**
- `npm test`: expect 250 passing.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 6: Commit.** Stage the wav files by explicit path, never `public/music/._*`.

```bash
git add src/lib/musicSynth.js src/lib/musicSynth.test.js scripts/generate-music.mjs public/music/first-light.wav public/music/night-shift.wav public/music/paper-planes.wav package.json
git commit -m "feat: generated placeholder songs for the Music app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Audio controller and Music window

**Files:**
- Create: `src/components/system/AudioController.jsx`, `src/windows/Music.jsx`
- Modify: `src/windows/index.js`, `src/App.jsx`, `src/components/system/Spotlight.jsx`, `src/index.css`, `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes:
  - From Task 1: `tracks`, the music helpers, and the `audio` state and actions.
  - From Phase 6c: `notify`.
  - From the window store: `windows.music.isOpen`.
- Produces: `<AudioController />` and `<Music />`, the latter the window with id `music`.

- [ ] **Step 1: Create `src/components/system/AudioController.jsx`.**

```jsx
import { useEffect, useRef } from 'react';

import { tracks } from '../../constants';
import { nowPlayingNotification, trackById } from '../../lib/music';
import useSystemStore from '../../store/system';
import useWindowStore from '../../store/window';

const audioState = () => useSystemStore.getState().audio;

// Owns the only <audio> element. The store is the source of truth: this
// mirrors it into the element (source, play/pause, volume, seeks) and mirrors
// the element's clock back (position, duration, end of track). The element's
// own `pause` event is deliberately ignored — changing `src` fires it.
const AudioController = () => {
    const audioRef = useRef(null);
    const announcedRef = useRef(null);
    const currentTrackId = useSystemStore((state) => state.audio.currentTrackId);
    const isPlaying = useSystemStore((state) => state.audio.isPlaying);
    const volume = useSystemStore((state) => state.audio.volume);
    const seekNonce = useSystemStore((state) => state.audio.seekNonce);

    useEffect(() => {
        const element = audioRef.current;
        const track = trackById(tracks, currentTrackId);
        if (!element || !track) return;

        element.src = track.src;
        element.load();
    }, [currentTrackId]);

    useEffect(() => {
        const element = audioRef.current;
        if (!element || !currentTrackId) return;

        if (isPlaying) {
            // A refused play (autoplay rules, missing file) leaves the player
            // paused; AbortError only means a newer load interrupted it.
            element.play()?.catch?.((error) => {
                if (error?.name !== 'AbortError') useSystemStore.getState().setPlaying(false);
            });
        } else {
            element.pause();
        }
    }, [isPlaying, currentTrackId]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    useEffect(() => {
        const element = audioRef.current;
        if (!element || seekNonce === 0) return;
        element.currentTime = audioState().position;
    }, [seekNonce]);

    // A track that starts while Music is closed gets a banner, once per track.
    useEffect(() => {
        if (!isPlaying || !currentTrackId || announcedRef.current === currentTrackId) return;

        announcedRef.current = currentTrackId;
        if (useWindowStore.getState().windows.music?.isOpen) return;

        const track = trackById(tracks, currentTrackId);
        if (track) useSystemStore.getState().notify(nowPlayingNotification(track));
    }, [isPlaying, currentTrackId]);

    // Hardware media keys and the OS media controls drive the same store.
    useEffect(() => {
        const session = globalThis.navigator?.mediaSession;
        if (!session) return undefined;

        const handlers = {
            play: () => useSystemStore.getState().setPlaying(true),
            pause: () => useSystemStore.getState().setPlaying(false),
            nexttrack: () => useSystemStore.getState().nextTrack(),
            previoustrack: () => useSystemStore.getState().previousTrack(),
        };

        Object.entries(handlers).forEach(([action, handler]) => {
            try {
                session.setActionHandler(action, handler);
            } catch {
                // Unsupported action: ignore.
            }
        });

        return () => Object.keys(handlers).forEach((action) => {
            try {
                session.setActionHandler(action, null);
            } catch {
                // Ignore.
            }
        });
    }, []);

    useEffect(() => {
        const session = globalThis.navigator?.mediaSession;
        const track = trackById(tracks, currentTrackId);
        if (!session || !track || typeof globalThis.MediaMetadata !== 'function') return;

        session.metadata = new globalThis.MediaMetadata({ title: track.title, artist: track.artist, album: track.album });
    }, [currentTrackId]);

    return (
        <audio
            ref={audioRef}
            preload="metadata"
            onTimeUpdate={(event) => useSystemStore.getState().setAudioPosition(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => useSystemStore.getState().setAudioDuration(event.currentTarget.duration)}
            onEnded={() => useSystemStore.getState().nextTrack()}
        />
    );
};

export default AudioController;
```

When a track ends, `nextTrack` keeps `isPlaying` true, because the store never saw the element's pause, so the next track starts. At the last track it stops and rewinds.

- [ ] **Step 2: Create `src/windows/Music.jsx`.**

```jsx
import { useMemo, useState } from 'react';
import { Disc3, ListMusic, Pause, Play, Radio, SkipBack, SkipForward, Volume1, Volume2 } from 'lucide-react';

import { tracks } from '../constants';
import WindowControls from '../components/WindowControl';
import WindowWrapper from '../hoc/WindowWrapper';
import { albumsOf, coverGradient, formatTime, trackById } from '../lib/music';
import useSystemStore from '../store/system';

const Cover = ({ title, cover, size }) => (
    <span
        className={`music-cover music-cover-${size}`}
        style={cover || !title ? undefined : { background: coverGradient(title) }}
    >
        {cover && <img src={cover} alt="" />}
    </span>
);

// Transport, LCD (cover, title, scrubber) and volume; doubles as the title bar.
const PlayerBar = () => {
    const audio = useSystemStore((state) => state.audio);
    const togglePlay = useSystemStore((state) => state.togglePlay);
    const nextTrack = useSystemStore((state) => state.nextTrack);
    const previousTrack = useSystemStore((state) => state.previousTrack);
    const seekTo = useSystemStore((state) => state.seekTo);
    const setVolume = useSystemStore((state) => state.setVolume);
    const track = trackById(tracks, audio.currentTrackId);
    const duration = audio.duration || track?.duration || 0;
    const position = Math.min(audio.position, duration);

    return (
        <div className="music-player" data-titlebar>
            <WindowControls target="music" />

            <div className="music-transport">
                <button type="button" aria-label="Previous" disabled={!track} onClick={previousTrack}><SkipBack /></button>
                <button type="button" className="music-play" aria-label={audio.isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                    {audio.isPlaying ? <Pause /> : <Play />}
                </button>
                <button type="button" aria-label="Next" disabled={!track} onClick={nextTrack}><SkipForward /></button>
            </div>

            <div className="music-lcd">
                <Cover title={track?.album} cover={track?.cover} size="sm" />
                <div className="music-lcd-info">
                    {track ? (
                        <>
                            <p className="music-lcd-title">{track.title}</p>
                            <p className="music-lcd-artist">{track.artist} — {track.album}</p>
                        </>
                    ) : (
                        <p className="music-lcd-title">Not Playing</p>
                    )}
                    <div className="music-scrubber">
                        <span>{formatTime(position)}</span>
                        <input
                            type="range"
                            min={0}
                            max={duration}
                            step={0.1}
                            value={position}
                            disabled={!track}
                            aria-label="Playback position"
                            onChange={(event) => seekTo(Number(event.target.value))}
                        />
                        <span>-{formatTime(duration - position)}</span>
                    </div>
                </div>
            </div>

            <label className="music-volume">
                <Volume1 aria-hidden="true" />
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={audio.volume}
                    aria-label="Volume"
                    onChange={(event) => setVolume(Number(event.target.value))}
                />
                <Volume2 aria-hidden="true" />
            </label>
        </div>
    );
};

const SongTable = ({ list }) => {
    const currentTrackId = useSystemStore((state) => state.audio.currentTrackId);
    const playTrack = useSystemStore((state) => state.playTrack);

    return (
        <table className="music-songs">
            <thead>
                <tr><th>Title</th><th>Artist</th><th>Album</th><th>Time</th></tr>
            </thead>
            <tbody>
                {list.map((track) => (
                    <tr key={track.id} className={track.id === currentTrackId ? 'is-current' : undefined}>
                        <td>
                            <button type="button" onClick={() => playTrack(track.id)}>
                                <Cover title={track.album} cover={track.cover} size="xs" />
                                {track.title}
                            </button>
                        </td>
                        <td>{track.artist}</td>
                        <td>{track.album}</td>
                        <td>{formatTime(track.duration)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const AlbumGrid = ({ albums, onOpen }) => (
    <div className="music-albums">
        {albums.map((album) => (
            <button key={album.title} type="button" className="music-album" onClick={() => onOpen(album.title)}>
                <Cover title={album.title} cover={album.cover} size="lg" />
                <span className="music-album-title">{album.title}</span>
                <span className="music-album-artist">{album.artist}</span>
            </button>
        ))}
    </div>
);

const LIBRARY = [
    { id: 'songs', label: 'Songs', icon: ListMusic },
    { id: 'albums', label: 'Albums', icon: Disc3 },
];

const Music = () => {
    const playTrack = useSystemStore((state) => state.playTrack);
    const [view, setView] = useState({ id: 'listenNow' });
    const albums = useMemo(() => albumsOf(tracks), []);
    const openAlbum = (title) => setView({ id: 'album', album: title });
    const album = albums.find((entry) => entry.title === view.album);

    const sidebarButton = (id, label, Icon) => (
        <button
            key={id}
            type="button"
            className={`music-nav-item${view.id === id ? ' is-active' : ''}`}
            onClick={() => setView({ id })}
        >
            <Icon aria-hidden="true" /> {label}
        </button>
    );

    return (
        <div className="music">
            <PlayerBar />

            <div className="music-main">
                <aside className="music-sidebar">
                    {sidebarButton('listenNow', 'Listen Now', Radio)}
                    <p className="music-sidebar-heading">Library</p>
                    {LIBRARY.map(({ id, label, icon }) => sidebarButton(id, label, icon))}
                </aside>

                <div className="music-content">
                    {view.id === 'listenNow' && (
                        <>
                            <h2 className="music-heading">Listen Now</h2>
                            <p className="music-subheading">Top Picks</p>
                            <AlbumGrid albums={albums} onOpen={openAlbum} />
                        </>
                    )}
                    {view.id === 'songs' && (
                        <>
                            <h2 className="music-heading">Songs</h2>
                            <SongTable list={tracks} />
                        </>
                    )}
                    {view.id === 'albums' && (
                        <>
                            <h2 className="music-heading">Albums</h2>
                            <AlbumGrid albums={albums} onOpen={openAlbum} />
                        </>
                    )}
                    {view.id === 'album' && album && (
                        <>
                            <div className="music-album-header">
                                <Cover title={album.title} cover={album.cover} size="xl" />
                                <div>
                                    <h2 className="music-heading">{album.title}</h2>
                                    <p className="music-subheading">{album.artist}</p>
                                    <button type="button" className="music-play-album" onClick={() => playTrack(album.tracks[0].id)}>
                                        <Play aria-hidden="true" /> Play
                                    </button>
                                </div>
                            </div>
                            <SongTable list={album.tracks} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const MusicWindow = WindowWrapper(Music, 'music');
export default MusicWindow;
```

The sidebar is an `<aside>`, not a `<nav>`, because `src/index.css` styles bare `nav` elements as the menu bar.

- [ ] **Step 3: Wire it in.**
- **`src/windows/index.js`:** add `import Music from "./Music";` and add `Music` to the export list.
- **`src/App.jsx`:**
  - Add `Music` to the `@windows` import, and render `<Music />` after `<AboutThisMac />`.
  - Add `import AudioController from "@components/system/AudioController"`, and render `<AudioController />` right after `<SoundEffects />`.
- **`src/components/system/Spotlight.jsx`:** import `tracks` with `import { tracks } from '../../constants';`. Change the index line to `const index = useMemo(() => buildSpotlightIndex({ projects, skills, tracks }), [projects, skills]);`.

- [ ] **Step 4: Add the styles.** Append to `src/index.css`:

```css
/* Music (Apple Music style). The player bar is the title bar. */
.music {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border-radius: 0.75rem;
  background: #1f1f1f;
  color: white;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
}
.music-player {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px 16px;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
  background: #2a2a2a;
}
.music-transport {
  display: flex;
  align-items: center;
  gap: 6px;
}
.music-transport button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  color: rgb(255 255 255 / 0.85);
}
.music-transport button:disabled {
  opacity: 0.35;
}
.music-transport svg {
  width: 18px;
  height: 18px;
}
.music-transport .music-play svg {
  width: 22px;
  height: 22px;
}
.music-lcd {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 4px;
  border-radius: 8px;
  background: rgb(255 255 255 / 0.06);
}
.music-lcd-info {
  flex: 1;
  min-width: 0;
  text-align: center;
}
.music-lcd-title,
.music-lcd-artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.music-lcd-title {
  font-size: 13px;
  font-weight: 600;
}
.music-lcd-artist {
  font-size: 12px;
  color: rgb(255 255 255 / 0.6);
}
.music-scrubber {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 0.55);
}
.music-scrubber input {
  flex: 1;
  min-width: 0;
}
.music-volume {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 150px;
  color: rgb(255 255 255 / 0.6);
}
.music-volume svg {
  flex: none;
  width: 15px;
  height: 15px;
}
.music-volume input {
  flex: 1;
  min-width: 0;
}
.music input[type='range'] {
  accent-color: #fa2d48;
}
.music-main {
  display: flex;
  flex: 1;
  min-height: 0;
}
.music-sidebar {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 2px;
  width: 180px;
  padding: 12px 8px;
  border-right: 1px solid rgb(255 255 255 / 0.08);
  background: #242424;
}
.music-sidebar-heading {
  margin: 12px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  color: rgb(255 255 255 / 0.45);
}
.music-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  text-align: left;
  color: rgb(255 255 255 / 0.85);
}
.music-nav-item svg {
  width: 16px;
  height: 16px;
  color: #fa2d48;
}
.music-nav-item.is-active {
  background: rgb(255 255 255 / 0.12);
}
.music-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 18px 24px 24px;
}
.music-heading {
  font-size: 24px;
  font-weight: 700;
}
.music-subheading {
  margin: 2px 0 14px;
  font-size: 14px;
  color: rgb(255 255 255 / 0.6);
}
.music-cover {
  display: block;
  flex: none;
  overflow: hidden;
  background: #3a3a3a;
}
.music-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.music-cover-xs { width: 28px; height: 28px; border-radius: 4px; }
.music-cover-sm { width: 44px; height: 44px; border-radius: 6px; }
.music-cover-lg { width: 100%; aspect-ratio: 1; border-radius: 10px; }
.music-cover-xl { width: 160px; height: 160px; border-radius: 12px; }
.music-albums {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px;
}
.music-album {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}
.music-album-title {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
}
.music-album-artist {
  font-size: 12px;
  color: rgb(255 255 255 / 0.6);
}
.music-album-header {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 20px;
}
.music-play-album {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 8px;
  background: #fa2d48;
  font-size: 13px;
  font-weight: 600;
}
.music-play-album svg {
  width: 14px;
  height: 14px;
}
.music-songs {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.music-songs th {
  padding: 6px 8px;
  border-bottom: 1px solid rgb(255 255 255 / 0.1);
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  color: rgb(255 255 255 / 0.5);
}
.music-songs td {
  padding: 4px 8px;
  color: rgb(255 255 255 / 0.75);
}
.music-songs tbody tr:nth-child(odd) td {
  background: rgb(255 255 255 / 0.03);
}
.music-songs td:first-child button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  color: white;
}
.music-songs tr.is-current td,
.music-songs tr.is-current td:first-child button {
  color: #fa2d48;
}
```

- [ ] **Step 5: Update the docs.**

In `CLAUDE.md`, after the "Notifications and sounds" bullet, add:

`- **Music** (`windows/Music.jsx`, id `music`) plays `tracks` (constants). Playback state is `audio` in the system store (`playTrack`, `togglePlay`, `nextTrack`, `previousTrack`, `seekTo`, `setVolume`); `components/system/AudioController.jsx` owns the single `<audio>` element and mirrors the store into it (and the element's clock back), so music keeps playing when the window closes and Spotlight / Control Center drive the same player. A track that starts while Music is closed posts a "Now Playing" banner. The placeholder songs in `public/music/` are generated by `npm run music` (`src/lib/musicSynth.js`); real songs replace them by editing `tracks`.`

Also add `npm run music     # regenerate the placeholder songs in public/music/` to the Commands block, under `npm run sounds`. Add the same line to AGENTS.md's commands block.

- [ ] **Step 6: Run the checks.**
- `npm test`: 250 passing.
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 7: Commit.**

```bash
git add src/components/system/AudioController.jsx src/windows/Music.jsx src/windows/index.js src/App.jsx src/components/system/Spotlight.jsx src/index.css CLAUDE.md AGENTS.md
git commit -m "feat: Music window and audio controller with Now Playing banners

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Chrome checks (controller).**
- **Desktop icon:** the Music icon shows on the desktop and opens the window at its default size.
- **Navigation:** Listen Now, Songs, Albums and album detail all render. Clicking a song plays it, and the LCD, scrubber and remaining time update.
- **Transport:** play/pause, next and previous work. Previous after 3 s restarts the track, and next at the last track stops playback.
- **Controls:** seeking via the scrubber works, and the volume slider changes loudness (check `audio.volume`).
- **Closing the window:** playback continues.
- **Now Playing banner:** with Music closed, a Spotlight search for "night" plus Enter plays it and shows a "Now Playing" banner. Clicking the banner opens Music.
- **End of track:** the next track starts automatically.
- **Title-bar double-click:** the player bar is the title bar. Double-clicking its empty area zooms the window, but double-clicking Play, the scrubber or the volume slider must not.
- **Console:** no errors.

---

### Task 4: Control Center

**Files:**
- Create: `src/components/system/ControlCenter.jsx`, `src/components/system/DisplayDimmer.jsx`
- Modify: `src/lib/notifications.js`, `src/store/system.js`, `src/store/system.test.js`, `src/constants/index.js` (navIcons), `src/components/Navbar.jsx`, `src/components/system/DesktopContextMenu.jsx`, `src/App.jsx`, `src/index.css`, `CLAUDE.md`, the spec

**Interfaces:**
- Consumes:
  - From Task 1: the `audio` state and actions.
  - From Phase 6c: `notify`, `soundEffects` and `setSoundEffects`.
  - From Phase 6a: `runMenuAction`.
- Produces:
  - **In `src/lib/notifications.js`:** `HISTORY_LIMIT = 10`.
  - **System store state:** `controlCenterOpen`, `brightness` (0.3..1, default 1), `focusMode`, `notificationHistory`.
  - **System store actions:** `openControlCenter()` (desktop only; closes Spotlight and Mission Control), `closeControlCenter()`, `toggleControlCenter()`, `setBrightness(v)`, `setFocusMode(on)`, `clearNotificationHistory()`.
  - **Store behaviour:** `openSpotlight` and `openMissionControl` close Control Center, and `lock`/`restart` close it. `notify` always records history and shows a banner only when Focus is off.

- [ ] **Step 1: Write the failing tests.** Append to `src/store/system.test.js`:

```js
describe('Control Center', () => {
    beforeEach(() => {
        useSystemStore.setState({ bootPhase: 'desktop' });
    });

    it('opens, closes and toggles, only on the desktop', () => {
        expect(system().controlCenterOpen).toBe(false);
        system().openControlCenter();
        expect(system().controlCenterOpen).toBe(true);
        system().closeControlCenter();
        expect(system().controlCenterOpen).toBe(false);
        system().toggleControlCenter();
        expect(system().controlCenterOpen).toBe(true);
        system().toggleControlCenter();
        expect(system().controlCenterOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'locked' });
        system().openControlCenter();
        expect(system().controlCenterOpen).toBe(false);
    });

    it('never stacks with Spotlight or Mission Control', () => {
        system().openSpotlight();
        system().openMissionControl();
        system().openControlCenter();
        expect(system()).toMatchObject({ controlCenterOpen: true, spotlightOpen: false, missionControl: null });

        system().openSpotlight();
        expect(system()).toMatchObject({ controlCenterOpen: false, spotlightOpen: true });

        system().openControlCenter();
        system().openMissionControl();
        expect(system().controlCenterOpen).toBe(false);
        expect(system().missionControl).not.toBeNull();
    });

    it('closes on lock and restart', () => {
        system().openControlCenter();
        system().lock();
        expect(system().controlCenterOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openControlCenter();
        system().restart();
        expect(system().controlCenterOpen).toBe(false);
    });

    it('dims the display down to 30%', () => {
        expect(system().brightness).toBe(1);
        system().setBrightness(0.5);
        expect(system().brightness).toBe(0.5);
        system().setBrightness(0.1);
        expect(system().brightness).toBe(0.3);
        system().setBrightness(2);
        expect(system().brightness).toBe(1);
        system().setBrightness('x');
        expect(system().brightness).toBe(0.3);
    });

    it('Focus hides banners but still keeps them in the history', () => {
        system().setFocusMode(true);
        const id = system().notify({ appId: 'safari', title: 'Quiet' });
        expect(id).not.toBeNull();
        expect(system().notifications).toEqual([]);
        expect(system().notificationHistory.map((n) => n.title)).toEqual(['Quiet']);

        system().setFocusMode(false);
        system().notify({ appId: 'safari', title: 'Loud' });
        expect(system().notifications.map((n) => n.title)).toEqual(['Loud']);
    });

    it('keeps the ten newest notifications across lock, until cleared', () => {
        Array.from({ length: 12 }, (_, i) => system().notify({ appId: 'safari', title: `n${i}` }));
        expect(system().notificationHistory.map((n) => n.title)).toEqual(
            Array.from({ length: 10 }, (_, i) => `n${i + 2}`),
        );
        system().lock();
        expect(system().notificationHistory).toHaveLength(10);
        system().clearNotificationHistory();
        expect(system().notificationHistory).toEqual([]);
    });
});
```

That's 6 tests.

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run src/store/system.test.js`. Expected: FAIL, because the Control Center actions are missing.

- [ ] **Step 3: Add the store state.**

In `src/lib/notifications.js`, add after `MAX_NOTIFICATIONS`:

```js
// Control Center's "Notifications" list keeps this many, newest last.
export const HISTORY_LIMIT = 10;
```

In `src/store/system.js`:
- Import `HISTORY_LIMIT` alongside `addNotification` and `createNotification`.
- Update the top comment to: `// OS-level state that isn't about a single window: boot phase, Mission Control, Spotlight, Control Center (brightness, Focus), notifications and their history, the sound-effects switch, music playback and the desktop Clean Up counter.`
- In `createInitialSystemState`, add:

```js
  controlCenterOpen: false,
  brightness: 1,
  focusMode: false,
  notificationHistory: [],
```

- Add `state.controlCenterOpen = false;` inside `openMissionControl`, inside `openSpotlight` (after its phase guard), and in both `lock` and `restart`.
- Replace `notify` with:

```js
    // Banners exist only on the desktop: a scripted one that fires while the
    // screen is locked is simply dropped. Focus hides the banner, but every
    // notification still lands in Control Center's history.
    notify: (input) => {
      const { bootPhase, nextNotificationId: id, focusMode } = get();

      if (bootPhase !== 'desktop' || typeof input?.title !== 'string' || !input.title.trim()) return null;

      const notification = createNotification(input, { id });
      set((state) => {
        state.nextNotificationId += 1;
        state.notificationHistory = addNotification(state.notificationHistory, notification, HISTORY_LIMIT);
        if (!focusMode) state.notifications = addNotification(state.notifications, notification);
      });
      return id;
    },
```

- Add these actions after `toggleSpotlight`:

```js
    // Control Center, Spotlight and Mission Control never stack.
    openControlCenter: () =>
      set((state) => {
        if (state.bootPhase !== 'desktop') return;
        state.missionControl = null;
        state.spotlightOpen = false;
        state.controlCenterOpen = true;
      }),

    closeControlCenter: () =>
      set((state) => {
        state.controlCenterOpen = false;
      }),

    toggleControlCenter: () => {
      if (get().controlCenterOpen) get().closeControlCenter();
      else get().openControlCenter();
    },

    setBrightness: (level) =>
      set((state) => {
        state.brightness = Math.min(1, Math.max(0.3, Number(level) || 0));
      }),

    setFocusMode: (on) =>
      set((state) => {
        state.focusMode = Boolean(on);
      }),

    clearNotificationHistory: () =>
      set((state) => {
        state.notificationHistory = [];
      }),
```

Run `npx vitest run src/store/system.test.js`. It should pass.

- [ ] **Step 4: Create `src/components/system/DisplayDimmer.jsx`.**

```jsx
import useSystemStore from '../../store/system';

// Control Center's Display slider: a black overlay that ignores the pointer.
const DisplayDimmer = () => {
    const brightness = useSystemStore((state) => state.brightness);

    if (brightness >= 1) return null;
    return <div className="display-dimmer" style={{ opacity: 1 - brightness }} aria-hidden="true" />;
};

export default DisplayDimmer;
```

- [ ] **Step 5: Create `src/components/system/ControlCenter.jsx`.**

```jsx
import { useEffect, useRef, useState } from 'react';
import { BellRing, Bluetooth, Moon, Pause, Play, Radio, SkipBack, SkipForward, Sun, Volume2, Wifi } from 'lucide-react';

import { tracks } from '../../constants';
import { getApp } from '../../constants/apps';
import { runMenuAction } from '../../lib/menuActions';
import { coverGradient, trackById } from '../../lib/music';
import useSystemStore from '../../store/system';

const Toggle = ({ icon: Icon, label, detail, active, onClick }) => (
    <button type="button" className={`cc-toggle${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onClick}>
        <span className="cc-toggle-icon"><Icon aria-hidden="true" /></span>
        <span className="cc-toggle-text">
            <span className="cc-toggle-label">{label}</span>
            {detail && <span className="cc-toggle-detail">{detail}</span>}
        </span>
    </button>
);

const Slider = ({ icon: Icon, label, min, max, value, onChange }) => (
    <div className="cc-module">
        <p className="cc-module-title">{label}</p>
        <label className="cc-slider">
            <Icon aria-hidden="true" />
            <input type="range" min={min} max={max} step={0.01} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
        </label>
    </div>
);

const ControlCenterPanel = () => {
    const panelRef = useRef(null);
    const closeControlCenter = useSystemStore((state) => state.closeControlCenter);
    const brightness = useSystemStore((state) => state.brightness);
    const setBrightness = useSystemStore((state) => state.setBrightness);
    const focusMode = useSystemStore((state) => state.focusMode);
    const setFocusMode = useSystemStore((state) => state.setFocusMode);
    const soundEffects = useSystemStore((state) => state.soundEffects);
    const setSoundEffects = useSystemStore((state) => state.setSoundEffects);
    const audio = useSystemStore((state) => state.audio);
    const setVolume = useSystemStore((state) => state.setVolume);
    const togglePlay = useSystemStore((state) => state.togglePlay);
    const nextTrack = useSystemStore((state) => state.nextTrack);
    const previousTrack = useSystemStore((state) => state.previousTrack);
    const history = useSystemStore((state) => state.notificationHistory);
    const clearNotificationHistory = useSystemStore((state) => state.clearNotificationHistory);
    // Decorative, like the spec says: they only flip their look.
    const [radios, setRadios] = useState({ wifi: true, bluetooth: true, airdrop: false });
    const track = trackById(tracks, audio.currentTrackId);

    // Close on a press outside (the menu-bar icon toggles on its own), Esc, or leaving the page.
    useEffect(() => {
        const handlePointerDown = (event) => {
            if (panelRef.current?.contains(event.target)) return;
            if (event.target.closest?.('[data-control-center-toggle]')) return;
            closeControlCenter();
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') closeControlCenter();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', closeControlCenter);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', closeControlCenter);
        };
    }, [closeControlCenter]);

    const flip = (key) => setRadios((current) => ({ ...current, [key]: !current[key] }));

    const openNotification = (notification) => {
        closeControlCenter();
        if (notification.action) runMenuAction(notification.action);
    };

    return (
        <div ref={panelRef} className="control-center" role="dialog" aria-label="Control Center">
            <div className="cc-row">
                <div className="cc-module cc-radios">
                    <Toggle icon={Wifi} label="Wi-Fi" detail={radios.wifi ? 'Home' : 'Off'} active={radios.wifi} onClick={() => flip('wifi')} />
                    <Toggle icon={Bluetooth} label="Bluetooth" detail={radios.bluetooth ? 'On' : 'Off'} active={radios.bluetooth} onClick={() => flip('bluetooth')} />
                    <Toggle icon={Radio} label="AirDrop" detail={radios.airdrop ? 'Contacts Only' : 'Off'} active={radios.airdrop} onClick={() => flip('airdrop')} />
                </div>
                <div className="cc-column">
                    <div className="cc-module">
                        <Toggle icon={Moon} label="Focus" detail={focusMode ? 'On' : 'Off'} active={focusMode} onClick={() => setFocusMode(!focusMode)} />
                    </div>
                    <div className="cc-module">
                        <Toggle icon={BellRing} label="Sound Effects" detail={soundEffects ? 'On' : 'Off'} active={soundEffects} onClick={() => setSoundEffects(!soundEffects)} />
                    </div>
                </div>
            </div>

            <Slider icon={Sun} label="Display" min={0.3} max={1} value={brightness} onChange={setBrightness} />
            <Slider icon={Volume2} label="Sound" min={0} max={1} value={audio.volume} onChange={setVolume} />

            <div className="cc-module cc-now-playing">
                <span className="cc-cover" style={track && !track.cover ? { background: coverGradient(track.album) } : undefined}>
                    {track?.cover && <img src={track.cover} alt="" />}
                </span>
                <span className="cc-now-playing-text">
                    <span className="cc-toggle-label">{track ? track.title : 'Not Playing'}</span>
                    {track && <span className="cc-toggle-detail">{track.artist}</span>}
                </span>
                <span className="cc-transport">
                    <button type="button" aria-label="Previous" disabled={!track} onClick={previousTrack}><SkipBack /></button>
                    <button type="button" aria-label={audio.isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                        {audio.isPlaying ? <Pause /> : <Play />}
                    </button>
                    <button type="button" aria-label="Next" disabled={!track} onClick={nextTrack}><SkipForward /></button>
                </span>
            </div>

            <div className="cc-module cc-history">
                <div className="cc-history-head">
                    <p className="cc-module-title">Notifications</p>
                    {history.length > 0 && (
                        <button type="button" className="cc-clear" onClick={clearNotificationHistory}>Clear</button>
                    )}
                </div>
                {history.length === 0 ? (
                    <p className="cc-empty">No Notifications</p>
                ) : (
                    [...history].reverse().slice(0, 5).map((notification) => (
                        <button key={notification.id} type="button" className="cc-history-item" onClick={() => openNotification(notification)}>
                            <img src={getApp(notification.appId)?.icon ?? '/images/about.svg'} alt="" />
                            <span className="cc-now-playing-text">
                                <span className="cc-toggle-label">{notification.title}</span>
                                {notification.body && <span className="cc-toggle-detail">{notification.body}</span>}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

// Mounts only while open, so the decorative toggles reset each time — like a
// panel that re-reads system state.
const ControlCenter = () => {
    const open = useSystemStore((state) => state.controlCenterOpen);
    return open ? <ControlCenterPanel /> : null;
};

export default ControlCenter;
```

- [ ] **Step 6: Wire it in.**
- **`src/constants/index.js`:** change the fourth `navIcons` entry to `{ id: 4, img: "/icons/mode.svg", action: "controlCenter", label: "Control Center" }`.
- **`src/components/Navbar.jsx`:**
  - Add `const toggleControlCenter = useSystemStore((state) => state.toggleControlCenter)` after `toggleSpotlight`.
  - Replace the status-icon map's body with:

```jsx
          {navIcons.map(({ id, img, action, label }) => (
            <li key={id}>
              {action === 'spotlight' ? (
                // Spotlight's outside-press handler skips this, so it toggles cleanly.
                <button type="button" className="flex" data-spotlight-toggle aria-label={label} onClick={toggleSpotlight}>
                  <img className="icon-hover invert" src={img} alt="" />
                </button>
              ) : action === 'controlCenter' ? (
                <button type="button" className="flex" data-control-center-toggle aria-label={label} onClick={toggleControlCenter}>
                  <img className="icon-hover invert" src={img} alt="" />
                </button>
              ) : (
                <img className="icon-hover invert" src={img} alt={`icon-${id}`} />
              )}
            </li>
          ))}
```

- **`src/components/system/DesktopContextMenu.jsx`:** append `, .control-center` to `NATIVE_MENU_AREAS`.
- **`src/App.jsx`:**
  - Add `import ControlCenter from "@components/system/ControlCenter"` and `import DisplayDimmer from "@components/system/DisplayDimmer"`.
  - Render `<ControlCenter />` after `<AudioController />`.
  - Render `<DisplayDimmer />` just before the lock-screen line, so it dims the desktop but not the boot and lock overlays.

- [ ] **Step 7: Add the styles.** Append to `src/index.css`:

```css
/* Control Center: under the menu bar's right edge; above windows, banners
   (130000) and the menu bar; below Spotlight (140000) — they never stack
   anyway — and the context menu. */
.control-center {
  position: fixed;
  top: 34px;
  right: 8px;
  z-index: 135000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(320px, calc(100vw - 16px));
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: rgb(40 40 40 / 0.72);
  backdrop-filter: blur(30px) saturate(1.6);
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.4);
  color: white;
}
.cc-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cc-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-module {
  padding: 10px;
  border-radius: 14px;
  background: rgb(255 255 255 / 0.08);
}
.cc-radios {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
}
.cc-toggle-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.15);
}
.cc-toggle.is-active .cc-toggle-icon {
  background: #0a84ff;
}
.cc-toggle-icon svg {
  width: 15px;
  height: 15px;
}
.cc-toggle-text,
.cc-now-playing-text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}
.cc-toggle-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}
.cc-toggle-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: rgb(255 255 255 / 0.6);
}
.cc-module-title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
}
.cc-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgb(255 255 255 / 0.7);
}
.cc-slider svg {
  flex: none;
  width: 15px;
  height: 15px;
}
.cc-slider input {
  flex: 1;
  min-width: 0;
  accent-color: white;
}
.cc-now-playing {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cc-cover {
  flex: none;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 6px;
  background: #3a3a3a;
}
.cc-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cc-transport {
  display: flex;
  flex: none;
}
.cc-transport button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
}
.cc-transport button:disabled {
  opacity: 0.35;
}
.cc-transport svg {
  width: 15px;
  height: 15px;
}
.cc-history {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc-history-head {
  display: flex;
  justify-content: space-between;
}
.cc-clear {
  font-size: 11px;
  color: rgb(255 255 255 / 0.6);
}
.cc-empty {
  font-size: 12px;
  color: rgb(255 255 255 / 0.5);
}
.cc-history-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px;
  border-radius: 10px;
  background: rgb(255 255 255 / 0.06);
  text-align: left;
}
.cc-history-item img {
  flex: none;
  width: 24px;
  height: 24px;
  object-fit: contain;
}
/* Display slider: dims everything but the boot/lock layers (200000). */
.display-dimmer {
  position: fixed;
  inset: 0;
  z-index: 190000;
  background: black;
  pointer-events: none;
}
```

- [ ] **Step 8: Update the docs.**
- **CLAUDE.md:**
  - After the Music bullet, add: `- **Control Center** (`components/system/ControlCenter.jsx`, the menu-bar Control Center icon): Display slider (`brightness` → `DisplayDimmer` overlay, 30–100%), Sound slider (music volume), Now Playing mini player, Focus (`focusMode`: `notify` still records `notificationHistory` but shows no banner), Sound Effects (`soundEffects`), and the last notifications. Wi-Fi/Bluetooth/AirDrop tiles are decorative. Control Center, Spotlight and Mission Control close each other; lock/restart close it.`
  - In the "Notifications and sounds" bullet, replace `soundEffects (system store) is the on/off switch for Phase 7's Control Center` with `soundEffects (system store) is switched from Control Center`.
- **Spec:** under section 5's Control Center bullet, add the indented note `  - *Phase 7 note:* the Music sidebar has Listen Now and Library (Songs, Albums); Browse is left out until there is a catalog. Placeholder songs are generated by `npm run music` until real tracks replace them.`

- [ ] **Step 9: Run the checks.**
- `npm test`: expect 256 passing (250 + 6).
- `npx eslint . --ignore-pattern .superpowers`: 10 errors.
- `npm run build`: passes.

- [ ] **Step 10: Commit.**

```bash
git add src/components/system/ControlCenter.jsx src/components/system/DisplayDimmer.jsx src/lib/notifications.js src/store/system.js src/store/system.test.js src/constants/index.js src/components/Navbar.jsx src/components/system/DesktopContextMenu.jsx src/App.jsx src/index.css CLAUDE.md docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md
git commit -m "feat: Control Center with display dimming, Focus, sound toggles, now playing and notification history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11: Chrome checks (controller).**
- **Opening and closing:** the menu-bar icon toggles Control Center, and an outside click, Esc and window blur close it. Opening it closes Spotlight and Mission Control, and opening either of them closes it.
- **Display:** the slider dims the screen, including windows and the menu bar, down to 30%. Clicks still work while it's dimmed.
- **Sound:** the slider changes the music volume, and the Music window's volume slider follows.
- **Now Playing:** the mini player shows the current track, and its play/pause, next and previous work.
- **Focus:** with Focus on, a `notify` shows no banner and plays no blip, but the notification appears under Notifications. Clicking that entry runs its action, and Clear empties the list.
- **Sound Effects:** turning it off silences the system sounds; check with the instrumented player.
- **Decorative tiles:** Wi-Fi, Bluetooth and AirDrop flip their look.
- **Right-click** inside Control Center gives the native menu.
