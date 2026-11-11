# Todo App — Public Kanban Board

## Context

The portfolio shows finished work — `projects` in Finder, `skills` in Terminal, a resume PDF. There's no way for a visitor to see what's *in flight*.

The goal is a **Todo app on the home screen**: an icon sitting on the desktop next to Projects and Resume. Clicking it opens a window containing a kanban board of what the owner is currently building and learning. Anyone can read the board; only the owner can change it.

This introduces no new architecture. The Todo app is a desktop icon wired the same way Projects and Resume already are, its window uses the existing `WindowWrapper` machinery, and editing is a fourth tab in the `/admin` dashboard alongside Projects/Skills/Resume. One new Firestore collection, one new window, one new manager.

**The security-critical part:** `src/lib/firebase.js` reads `VITE_*` env vars, which Vite inlines into the client bundle. The Firebase web config is therefore public by design. `ProtectedRoute` and `/admin` gate the *UI only* — they do not stop anyone using that public config to write to Firestore directly. Read-only-for-the-public is enforced **exclusively by Firestore Security Rules**.

There is no `firestore.rules`, `firebase.json`, or `.firebaserc` in this repo, so rules live only in the Firebase console and their state is unverified. If they're still in default test mode, `projects` and `skills` are already publicly writable today. This plan adds versioned rules covering the new collection *and* closes that existing gap.

---

## Data model

New Firestore collection `todos`, one doc per card:

```js
{
  title:       string,          // required
  description: string,          // optional, short
  status:      'todo' | 'doing' | 'done',
  tags:        string[],        // any of 'building' | 'learning', may be both or neither
  order:       number,          // position within its column
  link:        string,          // optional URL (repo, issue, demo)
  createdAt:   Date
}
```

Fetch with a single `query(collection(db, 'todos'), orderBy('order', 'asc'))`, then group by `status` and filter by tag **in the client**. Deliberately not `where(...)` + `orderBy(...)` — that needs a composite Firestore index, and an `array-contains` tag filter would need another. One ordered read covers every column and every filter state, mirrors how `Finder.jsx:62` already fetches projects, and keeps the tag filter free of extra reads.

Define columns and tags once in `src/constants/index.js` so the public window and the admin manager can't drift:

```js
const TODO_COLUMNS = [
  { id: 'todo',  label: 'Planned' },
  { id: 'doing', label: 'In Progress' },
  { id: 'done',  label: 'Shipped' },
];

const TODO_TAGS = [
  { id: 'building', label: 'Building', className: 'bg-blue-600/30 text-blue-300' },
  { id: 'learning', label: 'Learning', className: 'bg-purple-600/30 text-purple-300' },
];
```

`bg-blue-600/30 text-blue-300` is the existing active-item treatment in the Finder and Photos sidebars (`index.css:180`, `Finder.jsx:40`) — reusing it keeps the pills consistent with the rest of the desktop.

---

## 1. Security rules (do this first)

New files at repo root — `firebase.json`, `firestore.rules`, `storage.rules`.

`firestore.rules` — public read, owner-only write, applied to all three collections:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == '<YOUR_UID>';
    }
    match /todos/{card}       { allow read: if true; allow write: if isOwner(); }
    match /projects/{project} { allow read: if true; allow write: if isOwner(); }
    match /skills/{skill}     { allow read: if true; allow write: if isOwner(); }
    match /{document=**}      { allow read, write: if false; }
  }
}
```

`storage.rules` — `ResumeUploader.jsx:34` writes to `resume/resume.pdf` and `Resume.jsx:17` reads it:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /resume/{file} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == '<YOUR_UID>';
    }
    match /{allPaths=**} { allow read, write: if false; }
  }
}
```

Pinning to a specific UID rather than `request.auth != null` matters: the latter would let *any* authenticated Firebase user write. Get the UID from Firebase Console → Authentication → Users, or by logging `auth.currentUser.uid` after signing in at `/admin/login`.

Deploy with `npx firebase deploy --only firestore:rules,storage` or paste into the console. **Verify before shipping** — see Verification.

---

## 2. The Todo app icon

The app is launched from a **desktop icon on the home screen**, exactly like Projects and Resume. Nothing is added to the dock.

`App.jsx:19-25` maps `desktopItems` into `<DesktopItem>`, passing `position` through as inline `top`/`left`. `DesktopItem` hands `item.id` straight to `openWindow` (`DesktopItem.jsx:31`), so an `id` matching the `WINDOW_CONFIG` key is the entire wiring — no click handler to write. Add to `desktopItems` (`constants/index.js:231`):

```js
{ id: 'todo', title: 'Todo', icon: '/images/todo.png', position: { top: 260, left: 20 } }
```

Existing icons sit at `top: 60` and `top: 160` in a left column, so `top: 260` continues the stack. Icons are `Draggable`, so this is only where it starts.

Two details worth getting right:
- `desktopItems` uses a **full path** (`icon: '/images/folder.png'`) and the key **`title`**, whereas `dockApps` uses a bare filename and `name`. Copying a dock entry's shape renders a broken image with no label.
- `DesktopItem` binds its `handleDoubleClick` handler to `onClick` (`DesktopItem.jsx:39`), so desktop icons open on a **single** click despite the name. Match that rather than "fixing" it, or Todo will behave differently from Projects and Resume.

**Asset needed:** `public/images/todo.png`. Nothing in `public/images/` suits a todo/kanban icon. Supply a macOS-style PNG sized like the existing `folder.png`/`pdf.png`, or point the entry at existing `txt.png` as a placeholder — a missing file renders a broken image, it does not throw.

---

## 3. The kanban window

**New `src/windows/Todo.jsx`** — read-only, no write imports at all. Follows `Finder.jsx` closely:

- `useCallback` fetcher + `useEffect`, with the established `setError(null)` / `setLoading(true)` / `try` / `catch` + `console.error` / `finally` shape.
- Loading and error states using `Loader2` (`animate-spin`), `AlertTriangle`, and a `RefreshCw` retry button — same idiom as `Finder.jsx:1-17`.
- Chrome: `<div id="window-header">` containing `<WindowControls target="todo" />` (`src/components/WindowControl.jsx`), matching `Finder.jsx:150`.
- **Tag filter** in the header: `All` / `Building` / `Learning`, held in local `useState`, filtering the already-fetched array. No refetch, no extra reads.
- Three columns from `TODO_COLUMNS`, each rendering its filtered cards with a count badge and an empty-state line.
- Each card shows its title, optional description, and a pill per entry in `tags` resolved through `TODO_TAGS`. Render unknown tag ids as nothing rather than crashing, so a stray value in Firestore can't blank the window.
- Ends with `export default WindowWrapper(Todo, 'todo');`

Cards are plain non-interactive markup — no drag handlers, no edit affordances. The public surface has no write path in it.

**Wiring — all four points of the `windowKey` contract must be touched.** `WINDOW_CONFIG` already contains orphaned keys (`safari`, `photos`, `txtfile`, `imgfile`, `maps`) whose components are never rendered in `App.jsx`; missing a step here just adds a sixth dead entry:

| File | Change |
|---|---|
| `src/constants/index.js` | add `todo: { isOpen: false, zIndex: INITIAL_Z_INDEX, data: null }` to `WINDOW_CONFIG`; add the `desktopItems` entry above; add `TODO_COLUMNS` and `TODO_TAGS` to the export block |
| `src/windows/index.js` | import `Todo`, add to the named export |
| `src/App.jsx` | render `<Todo />` alongside the other windows |
| `src/index.css` | add a `#todo` block inside `@layer base` |

`#todo` styling should follow the `#finder` block (`index.css:237`): absolute positioning, `shadow-2xl drop-shadow-2xl rounded-xl overflow-hidden max-w-[90vw]`, with a distinct `top`/`left` so it doesn't spawn exactly under Finder. Columns get a fixed-height scroll region — `h-[min(400px,60vh)]` matches Finder's body.

---

## 4. Admin drag-and-drop manager

**New `src/components/admin/TodoManager.jsx`.**

Use **`@dnd-kit/core` + `@dnd-kit/sortable`** (`npm i @dnd-kit/core @dnd-kit/sortable`). GSAP `Draggable` is already in the project and registered, but it only gives you position — cross-column drop detection, sortable reordering, and keyboard accessibility would all be hand-rolled hit-testing. `@dnd-kit` provides those directly.

Structure:
- `DndContext` with `closestCorners` collision detection wrapping three `SortableContext` columns (one per `TODO_COLUMNS` entry).
- Each card is a `useSortable` item; each column is a `useDroppable` so empty columns still accept drops.
- `onDragEnd` computes the destination column and index, updates local state optimistically, then persists.

Persist reorders with a **`writeBatch`** (`import { writeBatch } from 'firebase/firestore'`) — a drag can shift the `order` of every card in up to two columns, and the existing managers' one-`updateDoc`-per-change approach would fire a burst of writes and can leave the board half-reordered if one fails mid-flight. Recompute `order` as the array index within each affected column and commit once. On failure, `console.error` and refetch to resync.

The add/edit form carries **two tag checkboxes** driven by `TODO_TAGS`, writing a `tags` array. Both unchecked is valid — an untagged card just renders without pills.

Everything else mirrors `ProjectsManager.jsx`: `showForm` / `editing` / `formData` state, add-edit-delete with `confirm()` before delete, refetch after mutate, `bg-[#252525] rounded-lg p-4` cards and `bg-[#1e1e1e] border-[#3d3d3d]` inputs.

**Wire into `src/pages/admin/Dashboard.jsx`** — add `{ id: 'todo', label: 'Todo', icon: KanbanSquare }` to the `tabs` array (line 9) and a `case 'todo'` to the `renderContent` switch (line 25). `KanbanSquare` comes from `lucide-react`, already a dependency.

---

## Verification

1. **Rules first, before any UI work.** Deploy them, then in a logged-out browser (or private window) at `/`, open devtools and run a direct write against the public config:
   ```js
   // must be rejected with "Missing or insufficient permissions"
   const { getFirestore, addDoc, collection } = await import('firebase/firestore');
   await addDoc(collection(getFirestore(), 'todos'), { title: 'pwned' });
   ```
   A success here means the board is publicly writable and nothing else in this plan matters. Repeat against `projects` to confirm the pre-existing gap is closed. The console's Rules Playground is a faster loop for iterating on the rules themselves.
2. `npm run dev` — the Todo icon appears on the desktop below Projects and Resume, drags around like they do, and a **single click** opens the kanban window. The window drags, focuses above other windows on press, and the red control closes it. Confirm nothing new appeared in the dock.
3. Tag filter: switching All / Building / Learning re-filters all three columns with no network activity in the devtools Network tab. A card with both tags shows under both filters; an untagged card shows only under All.
4. Cut the network in devtools and reopen — confirm the `AlertTriangle` error state and that `RefreshCw` retries rather than leaving a permanent spinner.
5. Sign in at `/admin/login`, open the Todo tab, add cards with each tag combination, drag within and across columns. Reload the dashboard: order, status, and tags must survive. Check the Firestore console shows a single batched write per drag, not a burst.
6. Reload `/` and confirm the public window reflects the new arrangement and tags.
7. Confirm the board is genuinely read-only for visitors — no edit controls render, and a logged-out session still sees current data.
8. `npm run lint`. Baseline on `main` is **40 pre-existing errors**, nearly all `react-refresh/only-export-components`. New files will likely add to that count for the same structural reason (helper components beside a default export; `export default WindowWrapper(...)` being anonymous). Compare against the baseline rather than expecting zero.

---

## Cost

Storing the board in Firestore was weighed against SQLite and static JSON; Firestore won because it's free at this scale and reuses the auth and admin patterns already in the repo.

Firestore bills per **document** read, not per query. One visitor opening the app with 20 cards costs 20 reads. Against a Spark free tier of roughly 50k reads/day, that's on the order of 2,500 opens per day before anything is owed — far beyond portfolio traffic. Writes are bounded by how often the owner drags a card.

Two things that would change this, neither triggered by this plan:
- **`onSnapshot` was deliberately not used.** A live listener re-reads on every change and keeps burning reads on idle open tabs. Load-on-open is simpler and cheaper. The tag filter is client-side for the same reason.
- **Cloud Storage, not Firestore, is the likely reason a billing account exists.** `ResumeUploader` already writes `resume/resume.pdf`, and newer Firebase projects require the Blaze plan to enable Storage. That predates this feature and is unaffected by it.

Worth confirming actual usage once in Firebase Console → Usage and billing rather than trusting the tier figures above — Firebase pricing changes and these are approximate.

## Notes

- Board data is public. Card titles and descriptions are visible to anyone — keep client names, unreleased details, and anything sensitive off it.
- No test suite exists in this repo; verification is manual via `npm run dev`.
- `@dnd-kit` is the only new dependency. It is admin-only, so consider whether the bundle cost lands on the public desktop route — if `Dashboard` is not already code-split, lazy-loading the admin routes in `main.jsx` keeps it out of the visitor bundle.
