# macOS OS Upgrade — Design Spec

> On approval this spec is saved to `docs/superpowers/specs/2026-10-22-macos-os-upgrade-design.md`, committed, and handed to the writing-plans skill for a phased implementation plan. No product code is written until that plan is reviewed.

## Context

The portfolio simulates macOS but feels static: windows only drag and close (minimize/maximize buttons are dead divs in `WindowControl.jsx`), the Safari/Photos dock icons open nothing, the menu-bar clock is rendered once and never ticks, and clicking a dock icon of an open app *closes* it. The goal is to make it feel like a real OS for its audience (recruiters, developers) by adding a boot sequence, real window management, a system shell, and new apps — chiefly a browser showing the owner's deployed projects.

## Decisions (from brainstorming)

| Area | Decision |
|---|---|
| In scope | Real window behavior, Boot + lock screen, System shell, Browser, Music, Notes |
| Dropped | Settings/personalization (wallpaper, dark mode), Photos app, Maps app |
| Browser | Always live iframe embed, **no fallback**; tabs; **editable** address bar |
| Boot | Once per session; single handwritten "hello"; lock screen = avatar + click/any key |
| Minimize | Thumbnail on the right side of the dock |
| Windows | Maximize, edge/corner resize, open/close/minimize animations, position remembered for the visit |
| Shell | Spotlight, menu-bar dropdowns, desktop right-click menu, Control Center |
| Music | Own MP3s in `/public`, UI modeled on macOS Apple Music |
| Notes | UI built now on placeholder data; real data source decided later |
| Nav links | Projects/Contact/Resume move into a **Go** menu |
| Architecture | Single app registry + extend existing store/`WindowWrapper` (GSAP stays the only drag/animation system) |
| Extras | Notification toasts, Mission Control + app switcher, system sounds, easter eggs |
| Welcome banner | Plain greeting, no "open to work" signal |
| Testing | Add Vitest for pure logic only |
| New apps | Placed on the desktop (`placement: ['desktop']`), not the dock |

## 1. Architecture

**App registry — `src/constants/apps.js`** (single source of truth):
```js
{ id, title, icon, component, placement: [] /* any of 'desktop', 'dock'; empty = launch-only */,
  defaultBounds: { x, y, w, h }, minSize: { w, h }, keywords: [] }
```
Derived from it: the store seed (replaces hand-written `WINDOW_CONFIG`), desktop icons, dock icons, the Spotlight app index, and window rendering in `App.jsx` (`apps.map(a => <a.component key={a.id}/>)`). `WindowWrapper(Component, appEntry)` replaces the bare key string. Ids stay stable so existing `#id` CSS in `src/index.css` keeps matching; the browser uses id **`safari`** to inherit the existing `#safari` styles. Dead entries (`photos`, `maps`, `txtfile`, `imgfile`) are removed from config — `txtfile`/`imgfile` only if Finder doesn't use them (verify during phase 1). The four-way contract in CLAUDE.md is rewritten to "registry entry + component". Resulting placement: **dock** = Finder, Contact, Terminal, Mission Control (a launcher button, not a window), Archive (trash, non-opening; drop target for the easter egg); **desktop** = Projects (finder), Resume, Safari, Music, Notes; the existing Safari ("Articles") and Photos dock icons are removed from the dock.

**Window store — `src/store/window.js`** gains per-window `isMinimized`, `isMaximized`, `bounds`, `prevBounds`, `originRect`, plus top-level `focusedId`. New actions: `minimize`, `restore`, `toggleMaximize`, `setBounds`; `openWindow(id, data, originRect)`.

**System store — `src/store/system.js`** (new): `bootPhase: 'booting' | 'locked' | 'desktop'`, `spotlightOpen`, `controlCenterOpen`, `brightness`, audio state (`currentTrackId`, `isPlaying`, `volume`, `position`).

**Shell layer — `src/components/system/`**: `BootScreen`, `LockScreen`, `Spotlight`, `ControlCenter`, `MenuBarMenu`, `ContextMenu`, `AudioController`.

**Rendering**: the desktop mounts immediately; boot and lock screens are full-screen overlays on top (so Firestore fetches start during boot and the lock screen blurs the real desktop).

**Shared data hooks — `src/hooks/`**: `useProjects()` (extracted from `Finder.jsx`), `useSkills()` (extracted from `Terminal.jsx`), both using the AGENTS.md `try/catch/finally` + `Loader2`/`AlertTriangle`/`RefreshCw` idiom and fetching once.

Out of scope: `/admin` dashboard changes; Firestore security rules (no new collection is added in this pass).

## 2. Window behavior

- **Drag** only from the title bar (Draggable `trigger`); disabled while maximized; bounds clamped so a window can't leave the screen entirely.
- **Traffic lights** (`WindowControl.jsx`): red = close, yellow = minimize, green = toggle maximize; ×/−/+ glyphs on group hover. Title-bar double-click toggles maximize.
- **Maximize**: GSAP tween (~0.3s) to the area between menu bar and dock; `prevBounds` restored on toggle.
- **Resize**: 8 handles (4 edges, 4 corners), each a GSAP Draggable writing `bounds`, respecting `minSize`.
- **Animations**: open scales from `originRect` (the launching icon); close = scale-down + fade then `display:none`; minimize = "genie-lite" (shrink + translate + slight squash into the dock thumbnail). No WebGL genie.
- **Dock**: click open app → focus; click minimized app → restore; running indicator dot; minimized thumbnails right of a divider beside Archive.
- **Iframe guard**: all iframes get `pointer-events: none` while any drag/resize is active.
- **Position memory**: `bounds` persists in the store for the visit; resets on reload.

## 3. Boot sequence & lock screen

- Flow `booting → locked → desktop`; `sessionStorage.bootSeen` (try/catch) skips straight to desktop on same-tab refresh.
- **BootScreen**: black screen, single cursive "hello" SVG path drawn with GSAP `DrawSVGPlugin` (free since GSAP 3.13; installed `gsap@3.14`), ~2.5s draw + 0.5s hold, fade. Click/any key skips. `prefers-reduced-motion` → shown pre-drawn, quick fade. The "hello" SVG path is created as part of the work (owner may replace).
- **LockScreen**: blurred wallpaper, large live clock + date, round avatar, name, pulsing "Click or press any key to enter"; dismiss slides up/fades and triggers the welcome text animation. Avatar falls back to initials until a photo is added to `public/images`.
- Apple menu **Restart…** → `booting`; **Lock Screen** → `locked`. Open windows survive both.
- Small screens: keep the existing desktop-only message; boot does not run.

## 4. Apps

**Browser** (`src/windows/Browser.jsx`, id `safari`, desktop placement)
- Local tab state `{ id, url, title }[]` + `activeTabId` (survives close/reopen since windows never unmount).
- Toolbar: back/forward, reload, editable address bar, new-tab `+`.
- New tab = Favorites grid of projects with a `website` (via `useProjects`).
- Address normalization: prepend `https://` when missing; non-URL input shows an inline "Safari can't open this page".
- Back/forward history covers only address-bar/Favorites navigations (cross-origin iframe URLs are unreadable — accepted limitation).
- Loading bar until iframe `onLoad`. No fallback for frame-blocking sites (by decision).
- Finder project website items call `openWindow('safari', { url })` → opens a new tab.

**Music** (`src/windows/Music.jsx`, desktop placement, Apple Music style)
- Sidebar: Listen Now, Browse, Library → Songs / Albums. Main: album-art grid or song table (title, artist, album, time). Top player bar: transport, LCD now-playing (cover, title, scrubber, elapsed/remaining), volume.
- `tracks` in constants: `{ id, title, artist, album, cover, src, duration }`; files in `public/music/`.
- `AudioController` (mounted once in `App.jsx`) owns the single `<audio>` element and syncs with the system store — playback continues when the window closes; Control Center and Spotlight drive the same player.
- Built against 2–3 placeholder tracks until the owner supplies MP3s + covers.

**Notes** (`src/windows/Notes.jsx`, desktop placement, Apple Notes style)
- Three panes: folders, note list (title/date/preview), note body; search.
- Data via `getNotes()` returning placeholder notes; only that function changes when the source is decided.

**About This Mac** (`placement: []`): small window styled like macOS's, "specs" are the owner's role, stack, location, and a résumé button.

> Note: the "stack" line is deliberately omitted until real tech-stack data replaces the template `techStack`; role and location stay null (and hidden) until provided.

## 5. System shell

- **Spotlight**: **Cmd/Ctrl+K** primary (macOS swallows Cmd+Space before the page sees it; Cmd+Space still bound for non-Mac) + menu-bar magnifier. Indexes apps (title + keywords), projects, skills, notes, tracks. Results grouped by type; ↑/↓, Enter, Esc. Actions: open app / open project in a browser tab / open Terminal / open note / play track.
  - *Phase 6b note:* notes and tracks join the index with their apps (Phases 8 and 7). Cmd+K is the macOS shortcut; Ctrl+K there is left to text fields.
- **Menu bar** (rebuilt `Navbar.jsx` + `MenuBarMenu.jsx`): Apple menu (About This Mac, Restart…, Lock Screen); bold focused-app name; File / Edit / Window / Help / **Go** menus where every item works (Window: Minimize/Zoom/Close; Browser File: New Tab; Help: opens Contact; Go: Projects/Contact/Resume). Right side: Spotlight icon, Control Center icon, **live** clock (ticks every minute).
- **Desktop context menu**: wallpaper only (windows/iframes keep native menus). Items: New Note, Open Terminal, Clean Up (reset icon positions), About This Mac. On a desktop icon: Open.
- **Control Center**: real — Sound slider (music volume), Display slider (dimming overlay), Now Playing mini-player; decorative — Wi-Fi, Bluetooth, AirDrop, Focus tiles.

## 5b. Extra OS touches

**Notification toasts** (`system/Notifications.jsx`, `notify({ appId, title, body, action })` in the system store)
- macOS-style banners stacked top-right (icon, title, body, time); slide in, auto-dismiss after 5s, hover pauses; click runs `action`. Recent history listed at the bottom of Control Center.
- Scripted banners, copy in constants: ~4s after unlock — *Messages: "Hey, I'm Debaditya 👋 Have a look around"* → opens Contact; ~45s in, only if Safari hasn't been opened — *Safari: "Want to see my projects running live?"* → opens Safari.
- System banners: "Now Playing" when a track starts while Music is closed; easter-egg replies.
- Control Center **Focus** tile becomes real: it suppresses banners.

**Mission Control** (`system/MissionControl.jsx`)
- Open, non-minimized windows tween to a scaled grid over a dimmed desktop; click focuses that window, Esc cancels. Layout math is a pure helper in `src/lib/` (unit-tested).
- Triggers: Mission Control dock icon, **top-right hot corner**, **Ctrl+↑ on Windows/Linux only** (macOS reserves F3 and Ctrl+↑).

**App switcher** (`system/AppSwitcher.jsx`)
- **Alt/Option+Tab** on macOS and **Ctrl+`** on all platforms (Windows reserves Alt+Tab). Holding the modifier shows running-app icons centered; Tab advances; releasing focuses (restoring if minimized).
- All shortcuts listed in the Help menu.

**System sounds** (`src/lib/sounds.js`, Web Audio)
- Startup chime on lock-screen dismissal (first allowed user gesture), minimize/restore whoosh, notification blip, Spotlight tick, empty-trash crunch.
- "Sound Effects" toggle in Control Center (on after unlock), independent of the music volume.
- Royalty-free files under `public/sounds/`, each < 50 KB. Apple's chime is not used.
  - *Phase 6c note:* the files are synthesized by `scripts/generate-sounds.mjs` (original, royalty-free, deterministic). The empty-trash crunch comes with the Archive easter egg (Phase 9); the Sound Effects toggle UI, the Focus tile and notification history come with Control Center (Phase 7).

**Easter eggs**
- Bottom-left hot corner: all windows slide aside to reveal the desktop; leaving the corner restores them.
- Terminal: `sudo …` → "Nice try. This incident will be reported." + notification; `rm -rf /` → fake deletion scroll then "Just kidding. Everything's backed up 😅"; `hire debaditya` → opens Contact.
- Konami code (↑↑↓↓←→←→BA): dock icons bounce + "Cheat mode unlocked" banner.
- Dropping a desktop icon on Archive: "You can't delete my work 😤" banner, icon springs back.
- Clicking the "hello" during boot replays it in a random language (only this path needs extra language SVGs; plain skip is unaffected).

## 6. Error handling

- Data hooks use the AGENTS.md idiom; Favorites/Spotlight degrade gracefully (Spotlight still returns apps on fetch failure).
- `audio.play()` rejection (autoplay policy) caught → paused state.
- All `sessionStorage` access in try/catch; failure just replays boot.
- Asset fallbacks: initials avatar, gradient cover tiles.

## 7. Testing

- Add **Vitest** (dev dependency + `npm test` script) for pure logic only: bounds clamping, address-bar URL normalization, Spotlight ranking, window/system store actions. Pure helpers live in `src/lib/` so they're testable without the DOM.
- UI verified manually via `npm run dev` each phase; `npm run lint` must not exceed the 40-error baseline.
- Update CLAUDE.md (test command, registry contract) and AGENTS.md in sync.

## 8. Build order (each phase independently mergeable)

1. Registry + store refactor — no new features; dock-focus fix, live clock, dead-config cleanup, Vitest setup.
2. Window behavior — traffic lights, maximize, resize, animations, dock thumbnails, iframe guard.
3. Mission Control + app switcher.
4. Boot + lock screen.
5. Browser + `useProjects`.
6. Shell — menu-bar menus, About This Mac, Spotlight + `useSkills`, context menu, notifications, system sounds.
7. Music + `AudioController` + Control Center.
8. Notes (placeholder data).
9. Easter eggs.

## Assets needed from the owner

Avatar photo; MP3 tracks + cover art; optionally a custom "hello" SVG. Royalty-free sound effects are sourced during phase 6 (owner may swap). Notes content/data source (to be discussed).

## Verification

Per phase: `npm test` green; `npm run lint` ≤ 40 errors; `npm run dev` walkthrough — phase 1: all existing windows open/close/focus as before, dock click focuses instead of closing, clock ticks; phase 2: drag only by title bar, resize respects min size, maximize/restore, minimize to dock thumbnail and restore, dragging over the browser iframe doesn't stick; phase 3: Mission Control from dock icon/hot corner/Ctrl+↑ (non-Mac), click focuses, Esc cancels; Option+Tab (Mac) and Ctrl+` cycle and restore apps; phase 4: fresh tab plays hello → lock → desktop, refresh skips, Restart/Lock replay; phase 5: Favorites lists projects, tabs open/close, typed URL loads, Finder website link opens a tab; phase 6: Cmd/Ctrl+K finds and opens each result type, every menu item works, right-click menu only on wallpaper, welcome banner appears ~4s after unlock and Focus suppresses it, chime plays on unlock and the toggle mutes effects (Focus tile and Sound Effects toggle UI arrive with Control Center in phase 7); phase 7: playback survives closing Music, Control Center volume/brightness work; phase 8: notes list/search/select; phase 9: each easter egg triggers as described.
