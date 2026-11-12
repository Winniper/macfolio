# iPhone-style phone view — Design Spec

> Status: draft for approval. On approval this goes to the writing-plans skill for a phased implementation plan. No product code is written before that plan is reviewed.

## Context and intent

The portfolio is a macOS desktop simulation. Below 640px it shows almost nothing: the menu bar keeps only its logo, the dock, desktop icons and boot are hidden, and a red notice says the site is desktop-only (`#welcome .small-screen`). A recruiter who taps the link on a phone, which is where most links get opened first, sees a dead end.

The intent: on a phone the visitor gets the iPhone cousin of the same experience. Same wallpaper, same content, same sounds and music, the same "this is a real little OS" feeling, expressed the way an iPhone does it.

The same audit found a second problem on mid-size screens: windows open partly off-screen below about 1400px wide. That is fixed here too (Part 2), because together the two parts make the site usable at every width.

## Decisions

"User" = decided by the site owner in brainstorming. "Call" = chosen by the spec author; the owner has not ruled on it and may overrule.

| Area | Decision | Source |
|---|---|---|
| Who gets it | Screens under 640px wide get the iPhone UI; 640px and up keep the macOS desktop | User |
| Start | The handwritten "hello" boot plays on phones too, then an iPhone-style lock screen | User |
| Home screen | "Option B": intro card (avatar, name, greeting, Resume and Contact buttons) on top, app grid below, dock, Home bar, over the wallpaper | User |
| Apps | Open full-screen, **dark mode**, iPhone style, with a Home bar to go back | User |
| Feature parity | Every macOS feature that has a phone equivalent is carried over | User |
| Spotlight | Swipe down on the home screen | User |
| Control Center | Swipe down from the top-right corner | User |
| App switcher | Swipe up from the Home bar and hold; a short swipe up goes home | User |
| Mission Control | Folded into the app switcher | User |
| Notifications, sounds, background music | Carried over unchanged in behaviour | User |
| Dropped on phone | Right-click menus, window dragging and resizing, the menu bar | User |
| Tablets and larger | Keep the macOS desktop; windows always open fully on screen | User |
| Every gesture also has a tap | See "Gestures" | Call |
| Landscape phones | Portrait only; a "rotate your phone" screen in landscape | Call |
| No duplicate icons | Dock: Projects, Safari, Music, Contact. Grid: Resume, Skills, About. (The mockup repeated Projects and Skills in both.) | Call |
| Lock and Restart | Two buttons in the phone Control Center (the Apple menu is gone) | Call |
| Archive (trash) | Not shown on the phone; it has no window and belongs to the easter-egg phase | Call |
| Phone app screens | New components, not the desktop window components restyled | Call |
| Open-app state | Reuse the existing window store so Spotlight and notification actions keep working | Call |
| New dependencies | None expected; the one possible exception is a PDF renderer (see Resume) | Call |
| Real-phone testing | By the owner, on the live site after deploy; before that, a phone-sized desktop browser | User |
| Resume on the phone | A PDF renderer from the start, not an iframe | Call |
| Projects content | Mirrors the real desktop Finder (projects and their links, Resume.pdf); the unused `locations` sample tree is not used | Call |
| Shared logic | Logic inside desktop components (Safari above all) is moved into shared hooks, not copied | Call |
| Crossing 640px | Open apps, music and notifications survive; in-app state such as Safari tabs need not | Call |
| App open / close sound | Silent, as on the desktop; no new sounds | Call |

Reference mockups from the brainstorm (rough wireframes, not final visuals): `.superpowers/brainstorm/84640-1792762967/content/phone-home.html` (option B is the middle card) and `phone-apps.html` (lock screen, Projects list, Resume, Music).

## Goals

1. A phone visitor can reach the resume and the contact links within two taps of unlocking.
2. Everything the desktop shows (projects, resume, skills, contact, Safari, music, about) is reachable on the phone.
3. It feels like an iPhone: the gestures, the dark full-screen apps, the lock screen, banners, sounds.
4. From 640px up, a window never opens with part of it off-screen.

## Non-goals

- Dark mode or any restyling of the macOS desktop.
- A touch-first redesign of the desktop for tablets. Taps and drags must work as they do today; nothing more.
- Changes to `/admin`, Supabase tables, policies, or the Safari proxy Worker.
- The Notes app (cancelled) and easter eggs (Phase 9, later).
- An installable app (PWA), offline support, haptics.
- Home-screen icon rearranging, widgets beyond the intro card, multiple home pages.

## Anti-goals

These would make it a failure even if everything "works":

- A visitor who doesn't know the gestures gets stuck. Nothing may be reachable by swipe alone.
- The phone's own browser gestures fight the page: pull-to-refresh firing on a swipe down, the page rubber-banding, the address bar resizing the layout, text getting selected or the page zooming on a double tap.
- The desktop experience regresses in any way.
- A second copy of the content or data logic that can drift from the desktop's.

---

## Part 1 — The phone UI

### 1. Switching between phone and desktop

- One media query decides, exported from `src/lib/boot.js` beside the existing `SMALL_SCREEN_QUERY`: phone mode when the width is under 640px, **or** on a touch device (`pointer: coarse`) whose height is under 500px (a phone held sideways). *(Call.)*
- The choice is live: a listener re-evaluates on resize and rotation, and `App.jsx` renders either the desktop shell or the phone shell. Which apps are open, the music and the notifications survive the switch because they live in the stores. What an app was showing inside (Safari's tabs, the folder Projects was in) does **not** have to survive it: crossing the line only happens when someone resizes a desktop browser window, so it is not worth moving that state into a store. *(Call.)*
- The pieces with no visuals of their own stay mounted in both modes: `AudioController`, `SoundEffects`, `DisplayDimmer`, `Analytics`.
- In phone mode held sideways, a full-screen "Rotate your phone" card covers the UI. Music keeps playing.
- `/admin` and `/admin/login` are untouched.
- Remove the desktop-only notice (`#welcome .small-screen` and its markup) and the `max-sm:` rules that only existed to hide desktop chrome on phones, once the phone shell replaces them.

### 2. Boot and lock screen

- `initialBootPhase` stops skipping small screens: the "hello" animation plays once per tab on phones as well. The inline script in `index.html` must follow (it repeats the rule; `bootShell.test.js` keeps them in sync). `Welcome`'s comment and behaviour about small screens starting on the desktop go away with it.
- The existing `BootScreen` is reused; it only needs to fit a narrow screen.
- **Phone lock screen** (new): wallpaper, date ("Thursday, November 12"), large clock, one notification card styled as a message ("Hey, I'm Debaditya 👋 Have a look around", using `profile` from constants), the hint "Swipe up or tap to open", and the Home bar. A swipe up, a tap or any key unlocks; the screen slides up and away. Reduced motion: a fade.
- The same `bootPhase` (`booting → locked → desktop`), the `sessionStorage` flag and `unlock()` drive it. The startup chime and the two welcome banners fire on unlock as they do on the desktop.

### 3. Home screen

Top to bottom, over the wallpaper:

1. **Status bar:** live clock on the left; signal, Wi-Fi and battery glyphs on the right (decorative). Always visible, on the home screen and inside apps.
2. **Intro card:** avatar (or initials), name, the one-line greeting, and two buttons: **Resume** (opens the Resume app) and **Contact** (opens the Contact app). Frosted dark glass.
3. **App grid**, four columns: Resume, Skills, About.
4. **Search pill** just above the dock: opens Spotlight (the tap equivalent of the swipe down).
5. **Dock**, frosted: Projects, Safari, Music, Contact.
6. **Home bar.**

Which apps appear, where, and under what label comes from the registry (`src/constants/apps.js`), not from a list inside the home screen component: add a phone placement to each app entry (for example `phone: 'dock' | 'grid'`, absent = not shown) and derive `phoneDockApps` / `phoneGridApps` the way `dockApps` and `desktopItems` are derived. Labels use the registry `title` ("About This Mac" needs a phone label, "About").

Opening an app: the icon scales up into the full screen (about 0.35s); going home reverses it into the icon. Reduced motion: a cross-fade.

A dot or similar under a dock icon is **not** shown (iPhones don't have one).

### 4. App shell

Every app runs inside one shared shell so the apps themselves stay simple:

- Full screen, dark (black or near-black background, white text, iOS blue `#0a84ff` for actions), system font stack.
- Status bar on top, Home bar at the bottom, content scrolls between them. Respect the notch and bottom safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`), and size the screen with `100dvh` so the browser's address bar doesn't push the Home bar off-screen.
- A large title at the top, and a back link ("‹ Projects") when the app has drilled into a sub-page. Back inside an app is a tap on that link; no edge-swipe back, because iOS Safari uses that gesture to leave the site.
- Apps keep their place when the visitor goes home and returns (same rule as desktop windows: not unmounted while open).

### 5. Apps

Each phone app is a new component that reuses the desktop app's data and logic and shares no markup with it. `WindowWrapper`, the desktop windows' markup and their `#id` CSS are not touched.

Where the logic to share currently sits inside a desktop component, move it into a shared hook that both use, without changing desktop behaviour. *(Call.)* This matters most for Safari: the tab reducer wiring, the `safari:page` / `safari:open` message listener with its origin check, the "open a new tab when `openWindow('safari', { url })` is called" effect, the direct-hosts list and the sandbox string all live in `windows/Browser.jsx` today. They must exist once, not be copied into the phone app, because the message handling is security-sensitive. That extraction is its own step, checked against the desktop Safari before the phone Safari is built on it.

| App | Phone screen | Reuses |
|---|---|---|
| **Projects** (`finder`) | iOS Files-style grouped lists that mirror what the desktop Finder really shows today, and nothing more. First page: the list of projects (from Supabase), plus a Resume.pdf row that opens the Resume app. Tapping a project pushes a page with its links: Website opens in the Safari app, GitHub opens a new browser tab (as on the desktop). Loading, error and retry states follow the existing idiom. **Do not use the `locations` tree in `src/constants/index.js`:** it is unused template sample data (someone else's bio and projects, missing images) and the desktop never shows it. | `useProjects` |
| **Resume** (`resume`) | The PDF, scrollable through **all** pages, with a Download button. | `fetchCurrentResume` |
| **Safari** (`safari`) | One page at a time. Address bar at the bottom (above the Home bar) with back, forward, reload and a tabs button; the tabs button opens a grid of tab cards to switch, close or add. Blocked hosts show the existing `BlockedPage`. | `browserReducer`, `frameSrc`, `resolveEntry`, the proxy, the `safari:page` / `safari:open` messages, the same iframe sandbox rules |
| **Music** (`music`) | Library list with covers; tapping a song plays it and opens a Now Playing sheet (large cover, title, artist, scrubber, previous / play-pause / next). A mini player bar sits above the Home bar while a song is loaded. | `library` and the `audio` actions in the system store |
| **Skills** (`terminal`) | Keeps the terminal look (monospace, the prompt line, the check marks), reflowed for a narrow screen. | `useSkills`, `techStack` |
| **Contact** (`contact`) | Avatar, name, short line, then the social links as a grouped list with icons; each opens in a new tab (mail opens the mail app). | `socials`, `profile` |
| **About** (`about`) | "About" page in the Settings style: a device picture or the avatar, then rows (name, role, project count, and whatever About This Mac shows today). | whatever `AboutThisMac` reads |

Two known traps the builder must handle:

- **PDF on iPhone.** iOS Safari shows only the first page of a PDF inside an iframe, and no real iPhone is available before deploy (see Verification). So the phone Resume does not use an iframe: plan a PDF renderer from the start. A lazily loaded pdf.js is acceptable for this one screen and is the only new dependency this spec allows; it must not be in the bundle the desktop loads. The Download button must work regardless, so a rendering failure still leaves the visitor a way to get the file.
- **Volume on iPhone.** iOS ignores `audio.volume` set from a page. Where volume can't be set, hide the volume slider (Control Center and Music) instead of showing a control that does nothing. Detect it by capability, not by user-agent string, if that is practical.

### 6. System features

| Desktop feature | On the phone |
|---|---|
| Spotlight | A sheet from the top with the search field focused and the keyboard up. Same index, ranking and actions (`buildSpotlightIndex`, `searchSpotlight`, `runMenuAction`). Results that only make sense on the desktop (Mission Control, About This Mac wording, menu commands) are relabelled or left out. |
| Control Center | A panel from the top-right: brightness, volume (when settable), Now Playing mini player, Focus, Sound Effects, recent notifications, plus **Lock** and **Restart** buttons. Wi-Fi / Bluetooth / AirDrop tiles stay decorative. Same store fields and actions. |
| App switcher + Mission Control | Cards of the open apps in most-recent-first order, scrolling sideways. Tap a card to open it; flick a card up to close the app; tap outside to return. |
| Notifications | Banners drop from under the status bar, one at a time on the phone (the desktop shows up to three), 5 seconds, tap to run the action, swipe up to dismiss. Focus still silences banners and keeps history. "Now Playing" banners and the two welcome banners behave as on the desktop. |
| Sounds | The existing cues only (`startup`, `notification`, `spotlight`, `minimize`, `restore`); no new sound files. Startup, notification and Spotlight cues fire as on the desktop. Opening, closing and leaving a phone app are silent, as opening and closing a desktop window are today; the minimize / restore cues must not fire on the phone even if going home is implemented with the store's minimize. *(Call.)* |
| Background music | Unchanged: `AudioController` owns the audio element. |
| Display dimming | Unchanged: `DisplayDimmer`. |
| Lock / Restart | From Control Center. Both return to the phone lock screen (Restart replays "hello"). |
| Keyboard shortcuts, hot corner, menu bar, context menu, dock magnification, drag / resize / zoom | Not on the phone. Their listeners must not run in phone mode. |

Spotlight, Control Center and the app switcher close each other, as their desktop versions do.

### 7. Gestures

Each gesture has a tap that does the same thing, so nobody depends on knowing the swipe.

| Gesture | Tap equivalent | Does |
|---|---|---|
| Swipe up or tap on the lock screen | (tap) | Unlock |
| Swipe down on the home screen (not starting in the top-right corner) | Search pill | Spotlight |
| Swipe down starting in the top-right corner (roughly the right third of the status bar), from any screen | Tap the status-bar glyphs on the right | Control Center |
| Short swipe up on the Home bar | Tap the Home bar | Go home (closes any sheet first) |
| Swipe up on the Home bar and pause, or drag past about a third of the screen | Long-press the Home bar | App switcher |
| Flick a switcher card up | Close button on the card | Close that app |
| Swipe up on a banner | (it times out) | Dismiss |

Rules:

- Deciding which gesture a touch was (direction, distance, speed, where it started, whether it paused) is a pure function with tests, in `src/lib/`, in the style of `hotCorner.js` and `switcher.js`. Thresholds live there as named constants.
- The Home bar's touch area is much larger than the visible bar and sits **above** the bottom safe area, because the bottom edge of a real iPhone belongs to iOS's own home gesture.
- The page must not scroll, bounce, zoom or pull-to-refresh under these gestures (`overscroll-behavior`, `touch-action`, fixed-height shell). Scrolling inside app content still works normally.
- Use pointer events, so the phone UI can also be driven with a mouse in a narrow desktop browser window (which is how it will be developed and demoed).
- GSAP stays the only animation system. Sheets and cards follow the finger while dragging and settle with a spring-like ease.

### 8. State

- **Open apps live in the existing window store.** `openWindow(id, data)` is what Spotlight results, notification actions and Finder's website links already call, so reusing it means all of those work on the phone without a second code path. *(Call.)*
- The phone needs three things the store doesn't say directly: which app is in front, whether the visitor is on the home screen, and the recents order. Derive them with pure functions (new `src/lib/phone.js`, tested) from window state where possible; if a new field is needed (for example "at home"), it goes in the system store and is reset by lock / restart. Going home must **not** close the app: it stays in the switcher with its state. Closing from the switcher is `closeWindow`.
- Window geometry (`bounds`, zoom, minimize stack, `fitToViewport`) is meaningless on the phone. It must not break anything when the visitor rotates or resizes across the 640px line with apps open: a window opened on the phone still needs sane desktop bounds when the desktop shell takes over.
- Sheet state reuses `spotlightOpen`, `controlCenterOpen` and `missionControlOpen` (as the switcher) so the existing "close each other" and "lock closes everything" rules apply unchanged.

### 9. Code layout

- Phone components go in their own folder, `src/phone/` (shell, lock screen, home screen, sheets, and `src/phone/apps/`). *(Call.)*
- Phone styles go in their own stylesheet imported from `index.css` (or a clearly fenced section), scoped under one root class or id, so they cannot collide with the global `@layer base` element and `#id` rules that style the desktop.
- Pure logic goes in `src/lib/` with Vitest tests, per the repo's convention. Tests never import a component or `src/lib/supabase.js`.
- Follow `AGENTS.md` for naming, import order and the loading-state idiom.

---

## Part 2 — Windows always open on screen (640px and up)

**Problem.** `clampBounds` only guarantees that 80px of a window stays reachable. Default positions were chosen for a wide monitor (Resume opens at x 700 with width 700; Safari is 1000 wide), so on a laptop or tablet a newly opened window hangs off the right or bottom edge.

**Wanted behaviour.**

- When a window **opens**, is **restored**, or is **un-zoomed**, and when the **browser is resized**, the whole window ends up inside the area between the menu bar and the dock, with a small margin. If it fits at its size, it is only moved. If it is larger than the available area, it is shrunk to fit (down to the app's `minSize`), then moved.
- If the screen is smaller than an app's `minSize`, the window takes the whole available area rather than overflowing.
- Dragging by hand keeps today's looser rule: the visitor may push a window mostly off-screen, as on a real Mac.
- A position the visitor chose is kept whenever it is already fully on screen.

**Where.** A new pure function beside `clampBounds` in `src/lib/bounds.js` with tests; the store's open / restore / un-zoom / `fitToViewport` paths use it; the drag and resize paths keep `clampBounds`.

**Also check** at 640–1024px wide: the menu bar's items and the dock fit without overflowing. Fix overflow if found; no redesign.

---

## Left to the builder

- Exact visual design within "dark, iPhone-like": spacing, blur strengths, type sizes, icon corner radius, animation curves.
- The gesture thresholds.
- Whether "which app is in front / at home" is derived or stored (section 8), as long as going home keeps the app alive and the desktop still works after crossing 640px.
- Component breakdown inside `src/phone/`.
- Which PDF renderer shows the Resume and how it is loaded, provided every page is readable on a real iPhone and the desktop bundle doesn't grow.
- How phases are cut. A sensible order: (1) Part 2 window fitting; (2) mode switch, boot, lock screen, home screen, app shell with one simple app; (3) the remaining apps; (4) Spotlight, Control Center, switcher, banners; (5) gestures polish and the owner's real-phone checklist.

## Verification

- `npm test` green; new pure logic (mode query, registry phone lists, gesture classification, phone state derivation, on-screen fitting) has tests.
- `npx eslint . --ignore-pattern .superpowers` shows no errors beyond the 7 known ones.
- `npm run dev` walkthrough at 390×844 (iPhone), 360×740 (small Android), 768×1024 (tablet, desktop UI), 1280×800 (laptop, desktop UI), and 1440+ (unchanged):
  - phone: hello → lock → unlock by swipe and by tap → intro card buttons → every app opens, shows real data, goes home and comes back in the same state → Spotlight, Control Center and switcher by gesture **and** by tap → a banner appears and its tap works → music keeps playing across apps, lock and rotation → Lock and Restart work.
  - desktop widths: every window opens fully on screen; nothing else changed.
  - resize a desktop browser across 640px with apps open and music playing: both directions keep working.
- **Real phones are tested by the owner on the live site after deploy** (decided by the owner). The Safari proxy only accepts `devbarman.xyz` and `localhost:5173` as parents, so a phone on a LAN address or a preview link would get blank proxied pages, and the Worker is not to be changed for testing. Everything before deploy is therefore verified in a phone-sized desktop browser with touch emulation. The build is "done" when that passes; the plan ends with a short checklist for the owner's pass on a real iPhone (Safari) and an Android phone (Chrome): safe areas, address-bar resizing, pull-to-refresh, all resume pages, audio start, the volume slider hidden where it can't work, proxied pages in the phone Safari. Fixes from that pass are follow-up work.
- `CLAUDE.md` and `AGENTS.md` updated to describe the phone shell, the mode switch and the new boot rule.
