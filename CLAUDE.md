# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the built dist/
npm run lint      # eslint over the repo (dist/ is globally ignored)
npm test          # Vitest, pure logic only

npx eslint src/windows/Finder.jsx   # lint a single file
```

`npm test` runs Vitest once (`vitest run`); `npm test -- src/store/window.test.js` runs one file. Tests cover pure logic only (registry, stores, `src/lib/` helpers) — UI is verified by running `npm run dev`. Never import a window component or `src/lib/firebase.js` from a test: Firebase throws at init without `.env`.

Requires a `.env` with the six `VITE_FIREBASE_*` keys (see `src/lib/firebase.js`); the app throws at Firebase init without them.

## Architecture

A macOS-desktop-simulation portfolio: React 19 + Vite 7 + Tailwind 4, GSAP for drag/animation, Zustand+Immer for state, Firebase (Firestore/Storage/Auth) as the backend.

### Two disjoint halves

`src/main.jsx` mounts three routes: `/` is the desktop (`App.jsx`), `/admin/login` and `/admin` (wrapped in `ProtectedRoute`) are a plain CMS dashboard. They share nothing but Firebase — the desktop reads, the dashboard writes. `vercel.json` rewrites all paths to `/`, which is what makes the `/admin` deep link work in production.

### The window system

The central abstraction. Understanding it requires `src/constants/apps.js` (the registry), `src/store/window.js`, and `src/hoc/WindowWrapper.jsx` together.

- The store seed comes from `buildWindowConfig()` in `apps.js`: a map of `windowKey → { isOpen, zIndex, data }`.
- `WindowWrapper(Component, windowKey)` wraps a window component in a `<section id={windowKey}>` positioned and sized by the store's `bounds` (inline `left/top/width/height`). It drags by the element marked `data-titlebar` (GSAP Draggable, `type: 'top,left'`, so transforms stay free for animations), double-click on that element zooms, eight `.window-resize` handles resize, and any press focuses. It throws at import if `windowKey` isn't in the registry.
- **Window components must** put `data-titlebar` on their header and make their root fill the section (`flex-1 min-h-0 w-full`). Fixed widths/heights in window markup break resize and zoom — sizes live in the registry's `defaultBounds`/`minSize`.
- Geometry rules (min size, stay on screen, maximize area between menu bar and dock) are pure functions in `src/lib/bounds.js`; the store applies them, and `App.jsx` re-fits windows on browser resize.
- `src/store/system.js` holds OS-level state (boot phase and Mission Control now; Spotlight, Control Center and audio in later phases). While Mission Control is open, `WindowWrapper` slides each visible window into its grid slot (`src/lib/missionControl.js`) through its own animation slot, `body.mission-control-open` disables window content, and a press on a window picks it.
- **Boot sequence:** `bootPhase` goes `booting → locked → desktop`. `App.jsx` renders `BootScreen`/`LockScreen` as overlays (z 200000) over the already-mounted desktop. A `sessionStorage` flag set on unlock makes same-tab refreshes skip to the desktop; small screens skip it entirely (`src/lib/boot.js`). Desktop shortcuts check `isDesktopPhase()` first. `restart()`/`lock()` exist for the Apple menu (Phase 6). To see the boot again during development, run `sessionStorage.clear()` and reload.
- **Safari (`windows/Browser.jsx`, id `safari`):** tabs and per-tab history live in the pure `browserReducer` (`src/lib/browser.js`); `normalizeAddress` only ever yields `http(s)` URLs. Each tab's page is a sandboxed iframe without `allow-top-navigation`, so a frame-busting site can't navigate the portfolio away (this only holds for cross-origin sites: a page served from the portfolio's own origin could lift the sandbox via allow-scripts + allow-same-origin, so never deploy a project under the portfolio's origin). `openWindow('safari', { url, title })` opens a new tab (Finder's Website items use it). Sites that refuse framing show blank — accepted.
- **Menus are data.** `buildMenuBar()` (`src/lib/menus.js`) derives the Apple/app/File/Edit/Window/Go/Help menus from window state; items carry plain action objects that `runMenuAction()` (`src/lib/menuActions.js`) performs. Only shortcuts that really work on the visitor's platform are shown. `components/menubar/Menu.jsx` renders any item list (also used by the desktop context menu). Right-click on the wallpaper or a desktop icon opens `components/system/DesktopContextMenu.jsx`; windows, inputs, the menu bar, the dock and Mission Control keep the browser's native menu. The `nav` sits at z-index 100000 so dropdowns cover windows; the hot corner (100001) stays above it. The nav is `inert` outside the desktop phase, since `lock`/`restart` have no phase guard.
- Shortcuts are platform-aware (`src/lib/shortcuts.js`): Mission Control is Ctrl+↑ on Windows/Linux only (macOS reserves it), plus the dock launcher and the top-right hot corner. The app switcher is Option+Tab on macOS and Ctrl+` everywhere (Windows reserves Alt+Tab); its keyboard logic is the pure `switcherReducer` in `src/lib/switcher.js`.
- `App.jsx` renders **every** window component unconditionally; the store decides what is visible. There is no mounting/unmounting, so window components keep their local state across close/reopen.
- Focus is a monotonically increasing `nextZIndex` counter — z-index only ever goes up, never gets compacted.
- `openWindow(key, data, originRect)` accepts an optional payload and the launching icon's rect (for the open animation); `closeWindow` clears the payload but keeps `bounds` and zoom state, so a reopened window comes back where it was. `minimizeWindow`/`restoreWindow` move windows in and out of `minimizedStack` (rendered as dock tiles).
- The store tracks `focusedId`; closing the focused window hands focus to the next-topmost open one.

**`src/constants/apps.js` is the app registry** — pure data, no component imports (so the store and tests load it without Firebase). Dock items, desktop icons and the store seed are all derived from it; `placement` lists where an app's icon appears (`'dock'`, `'desktop'`), and `hasWindow: false` marks launchers like Archive. Adding a window means: a registry entry, a component ending in `WindowWrapper(Comp, '<same id>')`, its barrel export in `src/windows/index.js`, a render in `App.jsx`, and `#id` CSS in `src/index.css` if it needs custom styling. New apps go on the desktop, not the dock.

### Data flow

Firestore collections and Storage paths are hardcoded at each call site rather than centralized, so both sides must be changed together:

| Path | Read by | Written by |
|---|---|---|
| `projects` collection (ordered by `order` asc) | `lib/projectsApi.js` → `store/projects.js` (shared by Finder and Safari via `hooks/useProjects.js`) | `components/admin/ProjectsManager.jsx` |
| `skills` collection | `windows/Terminal.jsx` | `components/admin/SkillsManager.jsx` |
| Storage `resume/resume.pdf` | `windows/Resume.jsx` | `components/admin/ResumeUploader.jsx` |

Everything else (nav links, gallery, blog posts, socials, tech stack, the Finder `locations` tree) is static in `src/constants/index.js` — a ~450-line file that is the de-facto content database (dock and desktop items live in `apps.js` instead).

**Access control is not in this repo.** `VITE_*` vars are inlined into the client bundle, so the Firebase config is public; `ProtectedRoute` gates only the admin *UI*. Whether the public can write to `projects`/`skills`/Storage depends entirely on Firestore/Storage Security Rules, and there is no `firestore.rules` or `firebase.json` here — the rules exist only in the Firebase console. Any new collection needs rules set there (or added to the repo).

Auth is `src/context/AuthContext.jsx` (`useAuth()` → `user, loading, login, logout, isAuthenticated`) over Firebase `onAuthStateChanged`, with `ProtectedRoute` gating `/admin`.

### Import aliases

`vite.config.js` defines `@components`, `@constants`, `@store`, `@hoc`, `@windows`. Note these are inconsistently used — `App.jsx`/`main.jsx` use aliases, most components use relative paths (`../store/window`). Either is fine; match the file you're in.

`jsconfig.json` maps `#*` → `src/*`, which matches nothing in the codebase and does not mirror the Vite aliases, so editor path resolution for `@…` imports will not work. Don't trust it as a source of truth.

### Styling

Tailwind 4 via `@tailwindcss/vite`, no config file — theme lives in the `@theme` block of `src/index.css` (`--font-georama`, `--font-roboto`, `--breakpoint-3xl`). Custom utilities `flex-center`, `col-center`, `abs-center` are declared with `@utility`. A large `@layer base` block styles bare elements (`main`, `nav`, `ul`, `time`) and `#id` selectors globally, so restructuring a window's markup can silently change its appearance — check `index.css` before renaming ids or reshaping element hierarchies.

### GSAP

`Draggable` is registered in both `App.jsx` and `DesktopItem.jsx`. `WindowWrapper` uses `useGSAP` and kills its Draggable instance on cleanup; `DesktopItem` uses a raw `useEffect` and does the same. `DesktopItem` requests `inertia: true`, which needs the Club-only InertiaPlugin — it is not registered, so that option is inert.

## Conventions

`AGENTS.md` in the repo root documents file naming, import ordering, component layout, Zustand/HOC patterns, and the async `try/catch/finally` + `Loader2`/`AlertTriangle`/`RefreshCw` loading-state idiom used consistently across data-fetching components. Follow it; keep the two files in sync if conventions change.

ESLint's only custom rule is `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'` — unused capitalized identifiers (components, constants) don't error.

**`npm run lint` is not clean** — 10 pre-existing errors: mostly `react-refresh/only-export-components` from window files that define helper components alongside the default export and from `export default WindowWrapper(X, 'key')` being an anonymous export, plus two `no-unused-vars`. Diff against that baseline rather than assuming a failing lint means you broke something. (`._*` AppleDouble files are ignored in `eslint.config.js` and `vite.config.js`'s `test.exclude`; before that, each one counted as a parse error.)

The repo is on a case-insensitive external volume and is littered with AppleDouble `._*` files; they're gitignored — ignore them in listings and never edit them.
