# AGENTS.md - Portfolio Project Guidelines

This document provides instructions for AI coding agents working on this codebase.

## Project Overview

A macOS-styled portfolio website built with React 19, Vite 7, and Tailwind CSS 4. Features include draggable windows, dock animations (GSAP), Supabase backend, and Zustand state management.

## Tech Stack

- **Framework**: React 19 with Vite 7
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **State**: Zustand with Immer middleware
- **Animations**: GSAP with `@gsap/react` and Draggable plugin
- **Backend**: Supabase (Postgres, Auth, Storage)
- **Routing**: React Router DOM 7
- **Icons**: Lucide React

---

## Build / Lint / Test Commands

```bash
# Development server (http://localhost:5173)
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview

# Lint all files
npm run lint

# Lint specific file
npx eslint src/components/Dock.jsx

# Lint specific directory
npx eslint src/windows/

# Unit tests (Vitest, pure logic only)
npm test
npm test -- src/store/window.test.js
npm run sounds    # regenerate public/sounds/*.wav from src/lib/synth.js
npm run music     # regenerate the placeholder songs in public/music/
npm run proxy:dev     # Safari proxy Worker on http://localhost:8787 (wrangler)
npm run proxy:deploy  # publish it to Cloudflare (needs `wrangler login`)
```

---

## Project Structure

```
src/
├── components/     # Reusable UI components (Navbar, Dock, etc.)
├── windows/        # Window components (Terminal, Finder, Contact, Resume, Browser, AboutThisMac, Music)
├── pages/          # Route pages (admin/Login, admin/Dashboard)
├── store/          # Zustand stores (window.js, system.js, projects.js, skills.js)
├── hooks/          # Shared data hooks (useProjects, useSkills, useClock)
├── context/        # React Context (AuthContext.jsx)
├── hoc/            # Higher-order components (WindowWrapper.jsx)
├── constants/      # Static data and configuration (index.js)
├── lib/            # External service configs (supabase.js, the data APIs: projectsApi, skillsApi, resumeApi, tracksApi)
├── assets/         # Static assets
└── index.css       # Global styles with Tailwind

proxy/                # Cloudflare Worker behind Safari's browsing (src/worker.js, pure helpers in proxyUrl.js, tested)
supabase/migrations/  # SQL schema, RLS and storage; applied by hand, in filename order
```

---

## Import Aliases

Configured in `vite.config.js`:

```javascript
@components  → src/components
@constants   → src/constants
@store       → src/store
@hoc         → src/hoc
@windows     → src/windows
```

**Usage**:
```javascript
import { Navbar, Dock } from "@components"
import { Terminal, Finder } from "@windows"
import { dockApps } from "@constants"
import useWindowStore from "@store/window"
import WindowWrapper from "@hoc/WindowWrapper"
```

---

## Code Style Guidelines

### File Naming
- **Components**: PascalCase (e.g., `Dock.jsx`, `WindowWrapper.jsx`)
- **Stores**: camelCase (e.g., `window.js`)
- **Barrel files**: `index.js` for re-exports

### Component Structure
```javascript
// 1. React imports
import { useState, useEffect, useCallback, useRef } from 'react';

// 2. Third-party libraries
import gsap from 'gsap';
import { Tooltip } from 'react-tooltip';

// 3. Local imports (use aliases when available)
import { dockApps } from '@constants';
import useWindowStore from '@store/window';

// 4. Component definition (function declaration preferred)
const ComponentName = () => {
    // Hooks first
    const [state, setState] = useState(null);
    const ref = useRef(null);
    
    // Effects
    useEffect(() => { /* ... */ }, []);
    
    // Handlers
    const handleClick = () => { /* ... */ };
    
    // Render
    return <div>...</div>;
};

export default ComponentName;
```

### Exports
- **Named exports**: Use barrel files (`index.js`) for component directories
- **Default exports**: Single component per file

```javascript
// src/components/index.js
import Navbar from "./Navbar";
import Dock from "./Dock";
export { Navbar, Dock }

// src/windows/index.js
import Terminal from "./Terminal";
import Finder from "./Finder";
export { Terminal, Finder }
```

### State Management (Zustand)
```javascript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  immer((set) => ({
    data: null,
    action: (payload) => set((state) => {
      state.data = payload;
    }),
  }))
);
```

### Higher-Order Components
Used for window functionality (dragging, z-index management):
```javascript
const TerminalWindow = WindowWrapper(Terminal, 'terminal');
export default TerminalWindow;
```

---

## Styling Conventions

### Tailwind CSS 4
- Uses `@import "tailwindcss"` syntax
- Custom utilities defined with `@utility` directive
- Theme extended in `@theme` block

### Custom Utilities (src/index.css)
```css
@utility flex-center    /* flex items-center justify-center */
@utility col-center     /* flex flex-col items-center justify-center */
@utility abs-center     /* absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 */
```

### Component IDs for Styling
CSS selectors target component IDs: `#dock`, `#terminal`, `#finder`, `#contact`, etc.

---

## Error Handling Patterns

### Async Operations
```javascript
const fetchData = async () => {
    setError(null);
    setLoading(true);
    try {
        const result = await apiCall();
        setData(result);
    } catch (err) {
        console.error('Error:', err);
        setError('User-friendly error message');
    } finally {
        setLoading(false);
    }
};
```

### Loading States
Use Lucide icons for loading/error states:
```javascript
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

{loading && <Loader2 className="animate-spin" />}
{error && <AlertTriangle />}
```

A Supabase list shared by several windows goes through `createFetchStore` (`src/lib/fetchStore.js`) with a hook in `src/hooks/` (`useProjects`, `useSkills`; the song list `store/tracks.js` feeds `system.library` through `useTrackLibrary` instead of rendering its own UI); components still render the same loading, error and retry UI.

---

## Environment Variables

Supabase config uses Vite's `import.meta.env` (see `.env.example`):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
Never import `src/lib/supabase.js` from a test: it throws without these.

`VITE_SAFARI_PROXY_URL` (optional) is the deployed Safari proxy Worker (`proxy/`, a `*.workers.dev` URL). Unset, Safari frames sites directly and ones that refuse framing stay blank. The Worker must stay on its own origin (never the portfolio's) and off Vercel, whose acceptable-use policy forbids proxying; its `ALLOWED_PARENTS` (`proxy/wrangler.toml`) must list the portfolio's origins. It never forwards cookies, so don't sign in through Safari. See CLAUDE.md for how `frameSrc` and the Worker fit together.

Music: songs live in the `tracks` table and the public `music` bucket (10 MB per file, 1-year `cacheControl` to protect the free plan's egress). The player reads `useSystemStore(s => s.library)`, never a constant; the `placeholderTracks` constant is only the fallback while nothing is uploaded. Pure rules are in `src/lib/musicFiles.js` (`canonicalAudioType` judges uploads by canonical MIME type, since browsers report M4A/MP3 inconsistently; `reorder` plus `renumberTracks` rewrite positions). Songs are managed in the admin Music tab (`components/admin/MusicManager.jsx`). Missing album/artist fall back to the title / "Unknown artist" through `albumTitleOf`/`artistOf` in `src/lib/music.js`; the stored values stay empty. In the admin form a cover can also be read from an MP3's ID3 tag (`src/lib/id3.js`, `src/lib/coverImage.js`) and is downscaled to about 600 px JPEG before upload. The cover reader is MP3-only; the Edit form's "Use cover from the MP3" button (shown for MP3 tracks) re-reads the cover of an existing song, fetching only its tag via Range requests.

Setup outside the repo: add an admin by creating the user in the Supabase dashboard, then `insert into public.admins (user_id) …` with their auth user id. "Allow new users to sign up" must stay off. Vercel needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and `VITE_SAFARI_PROXY_URL` once the Safari proxy is deployed). The proxy's one-time setup: `npx wrangler login`, register a `workers.dev` subdomain in the Cloudflare dashboard (`wrangler deploy` fails until one exists), then `npm run proxy:deploy`. Apply `supabase/migrations/` by hand (dashboard SQL editor or MCP), in filename order.

---

## ESLint Configuration

- ECMAScript 2020+ features enabled
- React Hooks rules enforced
- React Refresh plugin for HMR
- Unused vars allowed if capitalized or prefixed with underscore

```javascript
rules: {
  'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }]
}
```

---

## Key Patterns

### Window Management
Windows are managed via Zustand store with open/close/focus actions:
```javascript
const { windows, openWindow, closeWindow, focusWindow } = useWindowStore();
openWindow('terminal');
closeWindow('finder');
```

Apps are declared once in `src/constants/apps.js`; dock and desktop icons are derived from it. Clicking a dock icon opens a closed window or focuses an open one — it never closes it.

Window components mark their header with `data-titlebar` and let their root fill the window (`flex-1 min-h-0 w-full`); default and minimum sizes live in the registry (`defaultBounds`, `minSize`), not in the markup.

Keyboard shortcuts must go through `src/lib/shortcuts.js` so each one is only claimed on platforms whose OS leaves it free.

Anything that reacts to global keys or pointer position must check `isDesktopPhase(useSystemStore.getState())`, so it stays inert during the boot and lock screens.

### GSAP Animations
Register plugins at app entry, use `useGSAP` hook for React integration:
```javascript
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Draggable } from 'gsap/all';

gsap.registerPlugin(Draggable);
```

### Supabase Integration
The client exported from `src/lib/supabase.js`:
```javascript
import { supabase } from '../lib/supabase';
```
