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

Requires a `.env` with the six `VITE_FIREBASE_*` keys (see `src/lib/firebase.js`); the app throws at Firebase init without them. `Maps.jsx` also reads `VITE_MAPBOX_TOKEN`, but only matters if that window is ever wired up.

## Architecture

A macOS-desktop-simulation portfolio: React 19 + Vite 7 + Tailwind 4, GSAP for drag/animation, Zustand+Immer for state, Firebase (Firestore/Storage/Auth) as the backend.

### Two disjoint halves

`src/main.jsx` mounts three routes: `/` is the desktop (`App.jsx`), `/admin/login` and `/admin` (wrapped in `ProtectedRoute`) are a plain CMS dashboard. They share nothing but Firebase — the desktop reads, the dashboard writes. `vercel.json` rewrites all paths to `/`, which is what makes the `/admin` deep link work in production.

### The window system

The central abstraction. Understanding it requires `src/constants/index.js` (`WINDOW_CONFIG`), `src/store/window.js`, and `src/hoc/WindowWrapper.jsx` together.

- `WINDOW_CONFIG` is the registry: a map of `windowKey → { isOpen, zIndex, data }`. It seeds the Zustand store directly.
- `WindowWrapper(Component, windowKey)` wraps a window component in a `<section id={windowKey}>` that is absolutely positioned, GSAP-`Draggable`, toggles `display` on `isOpen`, and calls `focusWindow(key)` on press.
- `App.jsx` renders **every** window component unconditionally; the store decides what is visible. There is no mounting/unmounting, so window components keep their local state across close/reopen.
- Focus is a monotonically increasing `nextZIndex` counter — z-index only ever goes up, never gets compacted.
- `openWindow(key, data)` accepts an optional payload stored on the window; `closeWindow` clears it.

**The `windowKey` string is a four-way contract.** Adding or renaming a window means touching all of:
1. `WINDOW_CONFIG` in `src/constants/index.js`
2. the `WindowWrapper(Comp, 'key')` call at the bottom of the window component
3. the entry in `dockApps` and/or `desktopItems` (their `id` is passed straight to `openWindow`)
4. `#key` CSS selectors in `src/index.css`, plus the barrel export in `src/windows/index.js` and a render in `App.jsx`

**Known drift here:** `WINDOW_CONFIG` declares `safari`, `photos`, `txtfile`, `imgfile`, and `maps`, but only `finder`, `contact`, `resume`, and `terminal` are rendered in `App.jsx`. `Maps.jsx` exists and is wrapped, but is neither exported from `src/windows/index.js` nor rendered. Clicking the Safari/Photos dock icons flips store state with no component to show. Expect this when a window "does nothing".

### Data flow

Firestore collections and Storage paths are hardcoded at each call site rather than centralized, so both sides must be changed together:

| Path | Read by | Written by |
|---|---|---|
| `projects` collection (ordered by `order` asc) | `windows/Finder.jsx` | `components/admin/ProjectsManager.jsx` |
| `skills` collection | `windows/Terminal.jsx` | `components/admin/SkillsManager.jsx` |
| Storage `resume/resume.pdf` | `windows/Resume.jsx` | `components/admin/ResumeUploader.jsx` |

Everything else (dock apps, nav links, gallery, blog posts, socials, tech stack, map locations, the Finder `locations` tree) is static in `src/constants/index.js` — a ~550-line file that is the de-facto content database.

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

**`npm run lint` is not clean on `main`** — 40 pre-existing errors, almost all `react-refresh/only-export-components` from window files that define helper components alongside the default export and from `export default WindowWrapper(X, 'key')` being an anonymous export. Diff against the baseline rather than assuming a failing lint means you broke something.

The repo is on a case-insensitive external volume and is littered with AppleDouble `._*` files; they're gitignored — ignore them in listings and never edit them.
