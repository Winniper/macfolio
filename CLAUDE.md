# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the built dist/
npm run lint      # eslint over the repo (dist/ is globally ignored)
npm test          # Vitest, pure logic only
npm run sounds    # regenerate public/sounds/*.wav from src/lib/synth.js
npm run music     # regenerate the placeholder songs in public/music/

npx eslint src/windows/Finder.jsx   # lint a single file
```

`npm test` runs Vitest once (`vitest run`); `npm test -- src/store/window.test.js` runs one file. Tests cover pure logic only (registry, stores, `src/lib/` helpers) — UI is verified by running `npm run dev`. Never import a window component or `src/lib/supabase.js` from a test: the client throws at import without `.env`.

Requires a `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`); the app throws at Supabase client init without them.

## Architecture

A macOS-desktop-simulation portfolio: React 19 + Vite 7 + Tailwind 4, GSAP for drag/animation, Zustand+Immer for state, Supabase (Postgres/Storage/Auth) as the backend.

### Two disjoint halves

`src/main.jsx` mounts three routes: `/` is the desktop (`App.jsx`), `/admin/login` and `/admin` (wrapped in `ProtectedRoute`) are a plain CMS dashboard. They share nothing but Supabase — the desktop reads, the dashboard writes. `vercel.json` rewrites all paths to `/`, which is what makes the `/admin` deep link work in production.

### The window system

The central abstraction. Understanding it requires `src/constants/apps.js` (the registry), `src/store/window.js`, and `src/hoc/WindowWrapper.jsx` together.

- The store seed comes from `buildWindowConfig()` in `apps.js`: a map of `windowKey → { isOpen, zIndex, data }`.
- `WindowWrapper(Component, windowKey)` wraps a window component in a `<section id={windowKey}>` positioned and sized by the store's `bounds` (inline `left/top/width/height`). It drags by the element marked `data-titlebar` (GSAP Draggable, `type: 'top,left'`, so transforms stay free for animations), double-click on that element zooms, eight `.window-resize` handles resize, and any press focuses. It throws at import if `windowKey` isn't in the registry.
- **Window components must** put `data-titlebar` on their header and make their root fill the section (`flex-1 min-h-0 w-full`). Fixed widths/heights in window markup break resize and zoom — sizes live in the registry's `defaultBounds`/`minSize`.
- Geometry rules (min size, stay on screen, maximize area between menu bar and dock) are pure functions in `src/lib/bounds.js`; the store applies them, and `App.jsx` re-fits windows on browser resize.
- `src/store/system.js` holds OS-level state (boot phase, Mission Control, Spotlight, Control Center (brightness, Focus), notifications and their history, the `soundEffects` switch, music playback (`audio`) and the `desktopCleanups` counter that Clean Up bumps to send desktop icons home). While Mission Control is open, `WindowWrapper` slides each visible window into its grid slot (`src/lib/missionControl.js`) through its own animation slot, `body.mission-control-open` disables window content, and a press on a window picks it.
- **Boot sequence:** `bootPhase` goes `booting → locked → desktop`. `App.jsx` renders `BootScreen`/`LockScreen` as overlays (z 200000) over the already-mounted desktop. A `sessionStorage` flag set on unlock makes same-tab refreshes skip to the desktop; small screens skip it entirely (`src/lib/boot.js`). Desktop shortcuts check `isDesktopPhase()` first. `restart()`/`lock()` are wired to the Apple menu. An inline script in `index.html` adds `html.booting` (black background) before first paint when the boot will play, so the wallpaper never flashes first; it repeats `BOOT_SEEN_KEY`/`SMALL_SCREEN_QUERY` from `src/lib/boot.js` (`bootShell.test.js` keeps them in sync), and `App` removes the class on mount. To see the boot again during development, run `sessionStorage.clear()` and reload.
- **Safari (`windows/Browser.jsx`, id `safari`):** tabs and per-tab history live in the pure `browserReducer` (`src/lib/browser.js`); `normalizeAddress` only ever yields `http(s)` URLs. Each tab's page is a sandboxed iframe without `allow-top-navigation`, so a frame-busting site can't navigate the portfolio away (this only holds for cross-origin sites: a page served from the portfolio's own origin could lift the sandbox via allow-scripts + allow-same-origin, so never deploy a project under the portfolio's origin). `openWindow('safari', { url, title })` opens a new tab (Finder's Website items use it). Plain words in the address bar become a DuckDuckGo search (`addressOrSearch`). **Safari proxy:** sites that refuse framing (Google, GitHub, MDN…) load through a Cloudflare Worker in `proxy/` when `VITE_SAFARI_PROXY_URL` is set (unset, Safari frames sites directly and those stay blank). `frameSrc` (`src/lib/browser.js`) picks each iframe's `src`: YouTube watch links become the `youtube-nocookie.com` embed player, hosts that allow framing (Wikipedia, the portfolio's own project sites) load directly, everything else is `<proxy>/<absolute URL>`. The Worker (`proxy/src/worker.js`, pure helpers in `proxy/src/proxyUrl.js`) blocks private/loopback/metadata hosts (SSRF), never forwards cookies/Authorization/Referer, strips `X-Frame-Options`/CSP/`Set-Cookie`, rewrites HTML/CSS URLs, refuses video and bodies over 10 MB, answers top-level (non-iframe) navigations with a notice, and sets `frame-ancestors` to `ALLOWED_PARENTS` (`proxy/wrangler.toml`: `devbarman.xyz` with and without `www`, plus `http://localhost:5173`; a new domain must be added there and the Worker redeployed). An injected shim (`proxy/src/shim.js`) keeps script requests on the proxy and `postMessage`s the real URL/title to Safari, which accepts it only from the proxy origin and from its own iframes (`'framed'` reducer action). **The proxy must stay on its own origin** (never the portfolio's, where proxied scripts could read the Supabase session) **and off Vercel** (its acceptable-use policy forbids proxying). Proxied sites share one origin and no cookies pass, so logins don't work and visitors shouldn't sign in through Safari. Big search engines challenge or block proxied requests (DuckDuckGo shows a bot check, Google "unusual traffic"), which is accepted. `npm run proxy:dev` / `npm run proxy:deploy` run/publish the Worker (needs `wrangler login`; deploying prints the `*.workers.dev` URL for `VITE_SAFARI_PROXY_URL`).
- **Menus are data.** `buildMenuBar()` (`src/lib/menus.js`) derives the Apple/app/File/Edit/Window/Go/Help menus from window state; items carry plain action objects that `runMenuAction()` (`src/lib/menuActions.js`) performs. Only shortcuts that really work on the visitor's platform are shown. `components/menubar/Menu.jsx` renders any item list (also used by the desktop context menu). Right-click on the wallpaper or a desktop icon opens `components/system/DesktopContextMenu.jsx`; windows, inputs, the menu bar, the dock and Mission Control keep the browser's native menu. The `nav` sits at z-index 100000 so dropdowns cover windows; the hot corner (100001) stays above it. The nav is `inert` outside the desktop phase, since `lock`/`restart` have no phase guard.
- **Spotlight** (`components/system/Spotlight.jsx`): Cmd+K on macOS, Ctrl+K elsewhere (plus Meta+Space off-Mac), the menu-bar magnifier, or Help → Spotlight. The search is pure (`src/lib/spotlight.js`): `buildSpotlightIndex` turns the registry (`keywords`), projects and skills into entries carrying `runMenuAction` actions, and `searchSpotlight` ranks and groups them. `spotlightOpen` lives in the system store; Spotlight and Mission Control close each other, and lock/restart close Spotlight.
- **Notifications and sounds:** `notify({ appId, title, body, action })` (system store) shows a banner (`components/system/Notifications.jsx`, max 3, 5 s, hover pauses, click runs the `runMenuAction` action); it only works on the desktop, and lock/restart clear banners. Two welcome banners (`welcomeNotifications` in constants) are scheduled once per page load when the visitor unlocks. `SoundEffects` turns store changes into cues (`src/lib/soundCues.js`) for the Web Audio player (`src/lib/sounds.js`), which stays silent until the first user gesture. The `.wav` files in `public/sounds/` are synthesized by `npm run sounds` (`scripts/generate-sounds.mjs` + `src/lib/synth.js`); `soundFiles.test.js` fails if they drift from the generator, so regenerate after editing `synth.js`. `soundEffects` (system store) is switched from Control Center.
- **Music** (`windows/Music.jsx`, id `music`) plays `library` (system store). Playback state is `audio` in the system store (`playTrack`, `togglePlay`, `nextTrack`, `previousTrack`, `seekTo`, `setVolume`); `components/system/AudioController.jsx` owns the single `<audio>` element and mirrors the store into it (and the element's clock back), so music keeps playing when the window closes and Spotlight / Control Center drive the same player. A track that starts while Music is closed posts a "Now Playing" banner. The placeholder songs in `public/music/` are generated by `npm run music` (`src/lib/musicSynth.js`); they are the `placeholderTracks` constant. `library` starts as those placeholders; `useTrackLibrary` (mounted once, in `AudioController`) loads the admin-uploaded `tracks` table and calls `setLibrary(libraryOrPlaceholders(items, placeholderTracks))`, so the placeholders play only while nothing is uploaded or the load fails. `setLibrary` keeps the current song if it is still listed, otherwise stops playback. **Egress budget:** the free plan allows 5 GB uncached plus 5 GB cached downloads a month (about 1,000 full plays of a 4-5 MB song), so uploads are capped at 10 MB (`MAX_TRACK_BYTES`, also the bucket limit), sent with a 1-year `cacheControl`, and the admin warns past `TRACK_SOFT_LIMIT` (5) songs. In the admin form a cover can also be read from an MP3's ID3 tag (`src/lib/id3.js`, `src/lib/coverImage.js`) and is downscaled to about 600 px JPEG before upload. The cover reader is MP3-only; the Edit form's "Use cover from the MP3" button (shown for MP3 tracks) re-reads the cover of an existing song, fetching only its tag via Range requests.
- **Control Center** (`components/system/ControlCenter.jsx`, the menu-bar Control Center icon): Display slider (`brightness` → `DisplayDimmer` overlay, 30–100%), Sound slider (music volume), Now Playing mini player, Focus (`focusMode`: `notify` still records `notificationHistory` but shows no banner), Sound Effects (`soundEffects`), and the last notifications. Wi-Fi/Bluetooth/AirDrop tiles are decorative. Control Center, Spotlight and Mission Control close each other; lock/restart close it.
- Shortcuts are platform-aware (`src/lib/shortcuts.js`): Mission Control is Ctrl+↑ on Windows/Linux only (macOS reserves it), plus the dock launcher and the top-right hot corner. The app switcher is Option+Tab on macOS and Ctrl+` everywhere (Windows reserves Alt+Tab); its keyboard logic is the pure `switcherReducer` in `src/lib/switcher.js`.
- `App.jsx` renders **every** window component unconditionally; the store decides what is visible. There is no mounting/unmounting, so window components keep their local state across close/reopen.
- Focus is a monotonically increasing `nextZIndex` counter — z-index only ever goes up, never gets compacted.
- `openWindow(key, data, originRect)` accepts an optional payload and the launching icon's rect (for the open animation); `closeWindow` clears the payload but keeps `bounds` and zoom state, so a reopened window comes back where it was. `minimizeWindow`/`restoreWindow` move windows in and out of `minimizedStack` (rendered as dock tiles).
- The store tracks `focusedId`; closing the focused window hands focus to the next-topmost open one.

**`src/constants/apps.js` is the app registry** — pure data, no component imports (so the store and tests load it without Supabase). Dock items, desktop icons and the store seed are all derived from it; `placement` lists where an app's icon appears (`'dock'`, `'desktop'`), and `hasWindow: false` marks launchers like Archive. Adding a window means: a registry entry, a component ending in `WindowWrapper(Comp, '<same id>')`, its barrel export in `src/windows/index.js`, a render in `App.jsx`, and `#id` CSS in `src/index.css` if it needs custom styling. New apps go on the desktop, not the dock; system windows opened only from menus (like `about`) use `placement: []`.

### Data flow

Supabase table names and the Storage bucket are hardcoded at each call site rather than centralized, so both sides must be changed together:

| Path | Read by | Written by |
|---|---|---|
| `projects` table (ordered by `position`) | `lib/projectsApi.js` → `store/projects.js` (shared by Finder, Safari, About This Mac and Spotlight via `hooks/useProjects.js`) | `components/admin/ProjectsManager.jsx` |
| `skills` table | `lib/skillsApi.js` → `store/skills.js` (shared by Terminal and Spotlight via `hooks/useSkills.js`) | `components/admin/SkillsManager.jsx` |
| `tracks` table (ordered by `position`) + public Storage bucket `music` (`audio/…`, `covers/…`) | `lib/tracksApi.js` → `store/tracks.js` → `hooks/useTrackLibrary.js` → `system.library` (Music, Control Center, Spotlight, AudioController) | `components/admin/MusicManager.jsx` (via `lib/tracksApi.js`) |
| Storage bucket `resume` (one file, `resume-<timestamp>.pdf`) | `lib/resumeApi.js` → `windows/Resume.jsx` | `lib/resumeApi.js` → `components/admin/ResumeUploader.jsx` |

All three stores (projects, skills, tracks) come from `createFetchStore` (`src/lib/fetchStore.js`): the first caller fetches, a failed load retries on the next call.

Everything else (gallery, blog posts, socials, tech stack, the Finder `locations` tree) is static in `src/constants/index.js` — a ~450-line file that is the de-facto content database (dock and desktop items live in `apps.js` instead).

**Access control lives in `supabase/migrations/` as Row Level Security:** public read, writes only for user ids in `public.admins`. `VITE_*` vars are inlined into the client bundle, so the anon key is public by design; `ProtectedRoute` gates only the admin *UI*. New tables need their own policies in a migration.

**Setup outside the repo:** to add an admin, create the user in the Supabase dashboard, then run `insert into public.admins (user_id) …` with their auth user id. "Allow new users to sign up" must stay off. Vercel needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and `VITE_SAFARI_PROXY_URL` once the Safari proxy is deployed). The proxy's one-time setup: `npx wrangler login`, register a `workers.dev` subdomain in the Cloudflare dashboard (Workers onboarding; `wrangler deploy` fails until one exists), then `npm run proxy:deploy`. The migrations in `supabase/migrations/` are applied by hand (Supabase dashboard SQL editor or MCP), in filename order.

Auth is `src/context/AuthContext.jsx` (`useAuth()` → `user, loading, login, logout, isAuthenticated`) over Supabase Auth (an account counts as signed in only if `public.is_admin()` is true), with `ProtectedRoute` gating `/admin`.

### Import aliases

`vite.config.js` defines `@components`, `@constants`, `@store`, `@hoc`, `@windows`. Note these are inconsistently used — `App.jsx`/`main.jsx` use aliases, most components use relative paths (`../store/window`). Either is fine; match the file you're in.

`jsconfig.json` maps `#*` → `src/*`, which matches nothing in the codebase and does not mirror the Vite aliases, so editor path resolution for `@…` imports will not work. Don't trust it as a source of truth.

### Styling

Tailwind 4 via `@tailwindcss/vite`, no config file — theme lives in the `@theme` block of `src/index.css` (`--font-georama`, `--font-roboto`, `--breakpoint-3xl`). Custom utilities `flex-center`, `col-center`, `abs-center` are declared with `@utility`. A large `@layer base` block styles bare elements (`main`, `nav`, `ul`, `time`) and `#id` selectors globally, so restructuring a window's markup can silently change its appearance — check `index.css` before renaming ids or reshaping element hierarchies.

### GSAP

`Draggable` is registered in both `App.jsx` and `DesktopItem.jsx`. `WindowWrapper` uses `useGSAP` and kills its Draggable instance on cleanup; `DesktopItem` uses a raw `useEffect` and does the same. `DesktopItem` requests `inertia: true`, which needs the Club-only InertiaPlugin — it is not registered, so that option is inert.

## Conventions

`AGENTS.md` in the repo root documents file naming, import ordering, component layout, Zustand/HOC patterns, and the async `try/catch/finally` + `Loader2`/`AlertTriangle`/`RefreshCw` loading-state idiom used consistently across data-fetching components (lists shared by several windows come from `createFetchStore` hooks in `src/hooks/`). Follow it; keep the two files in sync if conventions change.

ESLint's only custom rule is `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'` — unused capitalized identifiers (components, constants) don't error.

**`npm run lint` is not clean** — 7 pre-existing errors (run `npx eslint . --ignore-pattern .superpowers`, which skips the `.superpowers` notes folder): six `react-refresh/only-export-components` (`AuthContext.jsx` exporting `useAuth` beside the provider, helper components next to the default export in `Contact.jsx` and `Finder.jsx`, and `export default WindowWrapper(X, 'key')` being an anonymous export), plus one `no-unused-vars` (`Icon` in `Finder.jsx`). Diff against that baseline rather than assuming a failing lint means you broke something. (`._*` AppleDouble files are ignored in `eslint.config.js` and `vite.config.js`'s `test.exclude`; before that, each one counted as a parse error.)

The repo is on a case-insensitive external volume and is littered with AppleDouble `._*` files; they're gitignored — ignore them in listings and never edit them.
