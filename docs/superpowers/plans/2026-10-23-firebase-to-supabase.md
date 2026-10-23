# Firebase → Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the portfolio's backend from Firebase to Supabase's free tier, replacing Firestore, Storage and Auth:
- The site reads projects, skills and the resume from Supabase.
- The admin panel logs in with Supabase Auth and edits projects and skills.
- Replacing the resume keeps exactly one file: the new one is uploaded and every older one is deleted.
- The Firebase dependency is removed.

**Architecture:**
- **Schema and access rules:** Postgres tables `projects` and `skills` with Row Level Security. Anyone can read them; only admins can write.
- **Admins:** listed by user id in a private `admins` table, so no email is committed.
- **Resume storage:** a public Storage bucket `resume`, with list for anyone and upload/delete for admins.
- **Repo source of truth:** all of the above lives in `supabase/migrations/`, replacing the console-only Firebase rules.
- **Client code:** one Supabase client lives in `src/lib/supabase.js`. Data access goes through small API modules (`projectsApi`, `skillsApi`, `resumeApi`).
- **Pure helpers:** row mapping (`src/lib/records.js`) and resume file logic (`src/lib/resume.js`) are pure and unit-tested.
- **Consumers keep their API:** the existing fetch-once stores and hooks keep their API, so Finder, Safari, About, Terminal and Spotlight don't change.

**Tech Stack:** `@supabase/supabase-js` v2, Supabase Postgres + RLS, Supabase Storage, Supabase Auth (email + password), React 19, Vitest 3.

**Requirements (from the user, 2026-10-23):**
- Migrate to Supabase's free tier.
- The resume feature must work.
- The admin panel must work.
- Replacing the resume deletes the older one automatically, so there is one resume at a time.

**Decisions:**
- **Admin login is Supabase-only, and has no sign-up.** The user asked for this on 2026-10-23.
  - The single admin account is created in the Supabase dashboard (Authentication → Users), and its password is set and changed there.
  - "Allow new users to sign up" is turned off.
  - The app has no sign-up UI, only `/admin/login`.
  - `AuthContext` treats a session as signed in only if `public.is_admin()` is true, and immediately signs out any other account.
  - Every write is still checked by RLS.
- **Data:** the 2 projects and 5 skills already exported from Firestore are copied in, as the user chose. The old resume can't be copied, because Firebase Storage is over quota, so the user uploads it once from the admin panel.
- **Admin:** only the owner can write, as the user chose. The `admins` table holds their Supabase user id. Its RLS has no policies, so no one can read or edit it through the API.
  - The user creates their admin login in the Supabase dashboard and turns public sign-ups off.
  - Even with sign-ups on, any other account can only read.
- **Resume:**
  - Each upload is `resume-<timestamp>.pdf`, then every other object in the bucket is removed. The newest file wins, and a fresh name means no stale CDN cache.
  - If the upload fails, the old resume stays. If cleanup fails, the newest one is still served.
  - The bucket accepts PDFs only, up to 10 MB.
- **Column names:**
  - Project order lives in `position`, because `order` is a SQL keyword. The API layer maps it back to `order` for the existing windows.
  - Skills gain `position` too, so their order is stable.
- **Missing configuration:** `src/lib/supabase.js` throws at import when the env vars are missing, as Firebase did. Tests never import it.
- **Deployment:** Vercel needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and the six `VITE_FIREBASE_*` variables can be removed. The user does this in the Vercel dashboard. It's flagged, not automated.
- **Logging in during checks:** the controller never types the user's admin password. For the Chrome checks, the user logs in to `/admin/login` in the test tab.

## Global Constraints

- The Supabase free tier only.
- Public visitors can read projects, skills and the resume. Only the admin can create, update or delete, and this is enforced by RLS, not just by hiding UI.
- Exactly one resume is stored at a time, and replacing it deletes older files automatically.
- The admin panel's existing features keep working: login/logout, the projects CRUD, the skills CRUD and the resume upload.
- **Tests:** Vitest covers pure logic only. Never import a component or `src/lib/supabase.js` from a test.
- **Lint:** `npx eslint . --ignore-pattern .superpowers` stays at the 10-error baseline or lower, with 0 warnings.
  - Some baseline errors are in admin and Resume files this plan rewrites, so the count may drop. Report it.
- **Files to leave alone:** never edit or commit `._*` files, `.env`, or the untracked `plan.md`, `page-render-check.png` and `website-screenshot.png`. Stage by path.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The branch is `feature/supabase`.

## Review Focus

1. **A logged-in non-admin account** (if sign-ups were left on) must not be able to write rows or upload or delete files. Enforced by RLS in Task 1; verified by the controller with SQL as the anon role.
2. **An upload that fails midway** must leave the previous resume intact. A failed cleanup must still serve the newest file. Pinned in Task 2 (`latestResume`/`staleResumes` tests) and by the order of operations in `replaceResume`.
3. **No resume uploaded yet:** the Resume window shows a clear message, not an endless spinner or a broken iframe. Verified in Chrome (Task 3).
4. **Untyped and blank form input** (spaces, empty links, a skills list typed with stray commas) must be trimmed and normalized before writing. Pinned in Task 2 (`records` tests).
5. **Missing env vars** must give a clear error naming the variables. Implemented in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261023120000_portfolio.sql` (create) | Tables, RLS, `is_admin()`, the resume bucket and its policies |
| `.env.example` (create) | Names of the two env vars |
| `src/lib/supabase.js` (create), `src/lib/firebase.js` (delete) | Client |
| `src/lib/records.js` + test (create) | `toProject`, `projectRow`, `toSkill`, `skillRow`, `parseSkillItems` |
| `src/lib/resume.js` + test (create) | `RESUME_BUCKET`, `MAX_RESUME_BYTES`, `resumeFileName`, `latestResume`, `staleResumes`, `validateResume` |
| `src/lib/projectsApi.js`, `src/lib/skillsApi.js` (rewrite), `src/lib/resumeApi.js` (create) | Supabase reads and writes |
| `src/context/AuthContext.jsx` (rewrite) | Supabase Auth |
| `src/windows/Resume.jsx` (modify) | Reads the current resume |
| `src/components/admin/ProjectsManager.jsx`, `SkillsManager.jsx`, `ResumeUploader.jsx` (modify) | Admin on Supabase |
| `package.json`, `CLAUDE.md`, `AGENTS.md` (modify) | Dependency swap, docs |

---

### Task 1: Supabase project, schema, access rules and data (controller, via the Supabase connector)

This task needs the Supabase MCP tools and the user's dashboard, so the controller does it.

**Files:**
- Create: `supabase/migrations/20261023120000_portfolio.sql`, `.env.example`
- Local only, never committed: `.env`

- [ ] **Step 1: Create the project.** Create a free-tier project named `portfolio`, in the region nearest the user. Confirm the cost (free) with the user before calling create. Wait until it is healthy.

- [ ] **Step 2: Write and apply the migration.** Save this as `supabase/migrations/20261023120000_portfolio.sql` and apply it with the connector's migration tool:

```sql
-- Portfolio backend: public read, admin-only writes (Row Level Security).
-- Admins are listed by auth user id in public.admins, which no API role can read.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  github text,
  website text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  category text not null check (length(trim(category)) > 0),
  items text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.skills enable row level security;

create policy "Anyone can read projects" on public.projects for select to anon, authenticated using (true);
create policy "Admins add projects" on public.projects for insert to authenticated with check (public.is_admin());
create policy "Admins edit projects" on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete projects" on public.projects for delete to authenticated using (public.is_admin());

create policy "Anyone can read skills" on public.skills for select to anon, authenticated using (true);
create policy "Admins add skills" on public.skills for insert to authenticated with check (public.is_admin());
create policy "Admins edit skills" on public.skills for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete skills" on public.skills for delete to authenticated using (public.is_admin());

-- One public bucket for the resume: PDFs up to 10 MB. Anyone can list it (to
-- find the current file); only admins upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume', 'resume', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "Anyone can list the resume" on storage.objects for select to anon, authenticated using (bucket_id = 'resume');
create policy "Admins upload the resume" on storage.objects for insert to authenticated with check (bucket_id = 'resume' and public.is_admin());
create policy "Admins delete old resumes" on storage.objects for delete to authenticated using (bucket_id = 'resume' and public.is_admin());
```

- [ ] **Step 3: Copy the data.** Insert the exported Firestore data, which is in the controller's scratchpad as `projects.json` and `skills.json`:
- Projects keep their `order` as `position`.
- Skills get `position` in `createdAt` order.
- Both keep `created_at`.

Then verify: `select count(*)` gives 2 projects and 5 skills.

- [ ] **Step 4: Admin user (the user, in the dashboard).** The user does three things:
1. Creates their admin login under Authentication → Users → Add user, with email and password, auto-confirmed.
2. Turns off "Allow new users to sign up".
3. Tells the controller it's done.

The controller then runs `insert into public.admins (user_id) select id from auth.users where email = '<their email>'`. The email appears only in this one-off command, never in the repo.

- [ ] **Step 5: Verify the rules.** Run the connector's security advisor and resolve any errors. Then use SQL `set role anon` to confirm three things:
- the anon role can select projects and skills;
- an insert as anon is rejected;
- `public.admins` is not readable by anon.

- [ ] **Step 6: Env.**
- Get the project URL and the anon/publishable key from the connector. Both are public by design and are shipped in the client bundle.
- Replace the six `VITE_FIREBASE_*` lines in the local `.env` with `VITE_SUPABASE_URL=…` and `VITE_SUPABASE_ANON_KEY=…`. `.env` is gitignored.
- Create `.env.example` with the two names and empty values.

- [ ] **Step 7: Commit the migration and the example env file.**

```bash
git add supabase/migrations/20261023120000_portfolio.sql .env.example
git commit -m "feat: Supabase schema, row level security and resume bucket

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Supabase client, data APIs, auth, Resume window, Firebase removal

**Files:**
- Create: `src/lib/supabase.js`, `src/lib/records.js`, `src/lib/records.test.js`, `src/lib/resume.js`, `src/lib/resume.test.js`, `src/lib/resumeApi.js`
- Rewrite: `src/lib/projectsApi.js`, `src/lib/skillsApi.js`, `src/context/AuthContext.jsx`
- Modify: `src/windows/Resume.jsx`, `package.json`/`package-lock.json`, `CLAUDE.md`, `AGENTS.md`
- Delete: `src/lib/firebase.js`

**Interfaces:**
- Consumes: the Task 1 schema (`projects`, `skills`, the `resume` bucket) and the env vars.
- Produces:
  - **Client:** `supabase` (the client).
  - **Records:**
    - `toProject(row) => { id, title, github, website, order }`
    - `projectRow(form) => { title, github|null, website|null }`
    - `toSkill(row) => { id, category, items }`
    - `skillRow(form) => { category, items }`
    - `parseSkillItems(value) => string[]`
  - **Resume helpers:**
    - `RESUME_BUCKET = 'resume'`
    - `MAX_RESUME_BYTES = 10 * 1024 * 1024`
    - `resumeFileName(now?)`
    - `latestResume(files) => file | null`
    - `staleResumes(files, keepName) => string[]`
    - `validateResume(file) => string | null`
  - **APIs:** `fetchProjects`, `createProject(form, position)`, `updateProject(id, form)`, `deleteProject(id)`, `fetchSkills`, `createSkill(form, position)`, `updateSkill(id, form)`, `deleteSkill(id)`, `fetchCurrentResume() => { name, url, downloadUrl } | null`, and `replaceResume(file) => same`.
  - **`useAuth()`** keeps the same shape: `{ user, loading, login, logout, isAuthenticated }`. `login` throws on bad credentials.

- [ ] **Step 1: Write the failing tests.**

`src/lib/records.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseSkillItems, projectRow, skillRow, toProject, toSkill } from './records';

describe('project records', () => {
    it('maps a row to the shape the windows use', () => {
        expect(toProject({ id: 'u1', title: 'askSudo', github: 'https://github.com/x', website: null, position: 2, created_at: 'x' }))
            .toEqual({ id: 'u1', title: 'askSudo', github: 'https://github.com/x', website: '', order: 2 });
    });

    it('builds a row from the admin form, trimming and nulling blanks', () => {
        expect(projectRow({ title: '  Site ', github: '   ', website: ' ask.dev ' }))
            .toEqual({ title: 'Site', github: null, website: 'ask.dev' });
        expect(projectRow({ title: 'T' })).toEqual({ title: 'T', github: null, website: null });
    });
});

describe('skill records', () => {
    it('splits comma lists and cleans arrays', () => {
        expect(parseSkillItems('React, Vue ,, ')).toEqual(['React', 'Vue']);
        expect(parseSkillItems([' Go', 7, ''])).toEqual(['Go']);
        expect(parseSkillItems(undefined)).toEqual([]);
    });

    it('maps rows and builds rows', () => {
        expect(toSkill({ id: 's', category: 'Frontend', items: null, position: 0 })).toEqual({ id: 's', category: 'Frontend', items: [] });
        expect(skillRow({ category: ' Backend ', items: 'Node, SQL' })).toEqual({ category: 'Backend', items: ['Node', 'SQL'] });
    });
});
```

`src/lib/resume.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { MAX_RESUME_BYTES, latestResume, resumeFileName, staleResumes, validateResume } from './resume';

describe('resume files', () => {
    it('names each upload by time, so every version gets a fresh URL', () => {
        expect(resumeFileName(1700000000000)).toBe('resume-1700000000000.pdf');
    });

    it('picks the newest resume and ignores anything else in the bucket', () => {
        const files = [
            { name: 'resume-1700000000000.pdf' },
            { name: '.emptyFolderPlaceholder' },
            { name: 'resume-1800000000000.pdf' },
            { name: 'notes.txt' },
        ];
        expect(latestResume(files)).toEqual({ name: 'resume-1800000000000.pdf' });
        expect(latestResume([])).toBeNull();
        expect(latestResume(null)).toBeNull();
    });

    it('marks every other file for deletion once a new resume is in', () => {
        expect(staleResumes(
            [{ name: 'resume-1.pdf' }, { name: 'resume-2.pdf' }, { name: '.emptyFolderPlaceholder' }],
            'resume-2.pdf',
        )).toEqual(['resume-1.pdf', '.emptyFolderPlaceholder']);
        expect(staleResumes(null, 'resume-2.pdf')).toEqual([]);
    });

    it('accepts PDFs up to 10 MB only', () => {
        expect(MAX_RESUME_BYTES).toBe(10 * 1024 * 1024);
        expect(validateResume({ type: 'application/pdf', size: 1000 })).toBeNull();
        expect(validateResume({ type: 'image/png', size: 10 })).toBe('Please choose a PDF file.');
        expect(validateResume({ type: 'application/pdf', size: MAX_RESUME_BYTES + 1 })).toBe('The PDF must be 10 MB or smaller.');
        expect(validateResume(null)).toBe('Please choose a PDF file.');
    });
});
```

That's 8 tests across the two files.

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run src/lib/records.test.js src/lib/resume.test.js`. Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Write the pure helpers.**

`src/lib/records.js`:

```js
// Supabase rows <-> the shapes the windows and the admin forms use.
const text = (value) => (typeof value === 'string' ? value.trim() : '');

export const toProject = (row) => ({
    id: row.id,
    title: row.title,
    github: row.github ?? '',
    website: row.website ?? '',
    order: row.position ?? 0,
});

export const projectRow = (form) => ({
    title: text(form.title),
    github: text(form.github) || null,
    website: text(form.website) || null,
});

// Skills are typed as "React, Vue, Tailwind" in the admin form.
export const parseSkillItems = (value) =>
    (Array.isArray(value) ? value : String(value ?? '').split(','))
        .map((item) => text(item))
        .filter(Boolean);

export const toSkill = (row) => ({ id: row.id, category: row.category, items: row.items ?? [] });

export const skillRow = (form) => ({ category: text(form.category), items: parseSkillItems(form.items) });
```

`src/lib/resume.js`:

```js
// One resume at a time: each upload is resume-<timestamp>.pdf, then every
// other file in the bucket is removed. The newest name always wins.
export const RESUME_BUCKET = 'resume';
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const RESUME_NAME = /^resume-(\d+)\.pdf$/;
const stamp = (name) => Number(RESUME_NAME.exec(name)[1]);

export const resumeFileName = (now = Date.now()) => `resume-${now}.pdf`;

export const latestResume = (files) =>
    (Array.isArray(files) ? files : [])
        .filter((file) => RESUME_NAME.test(file?.name ?? ''))
        .sort((a, b) => stamp(b.name) - stamp(a.name))[0] ?? null;

export const staleResumes = (files, keepName) =>
    (Array.isArray(files) ? files : [])
        .map((file) => file?.name)
        .filter((name) => name && name !== keepName);

export const validateResume = (file) => {
    if (file?.type !== 'application/pdf') return 'Please choose a PDF file.';
    if (file.size > MAX_RESUME_BYTES) return 'The PDF must be 10 MB or smaller.';
    return null;
};
```

Run the two test files. They should pass (8 tests).

- [ ] **Step 4: Swap the dependency.** Run `npm uninstall firebase`, then `npm install @supabase/supabase-js@^2`.

- [ ] **Step 5: Create the client.** Create `src/lib/supabase.js` and delete `src/lib/firebase.js` with `git rm`.

```js
import { createClient } from '@supabase/supabase-js';

// The anon key is public by design: Row Level Security in
// supabase/migrations/ decides what it may do. Never import this from tests.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.');
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 6: Data APIs.**

`src/lib/projectsApi.js`:

```js
import { projectRow, toProject } from './records';
import { supabase } from './supabase';

// Read for Finder, Safari, About and Spotlight; written by the admin panel.
export const fetchProjects = async () => {
    const { data, error } = await supabase
        .from('projects')
        .select('id, title, github, website, position')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map(toProject);
};

export const createProject = async (form, position) => {
    const { error } = await supabase.from('projects').insert({ ...projectRow(form), position });
    if (error) throw error;
};

export const updateProject = async (id, form) => {
    const { error } = await supabase.from('projects').update(projectRow(form)).eq('id', id);
    if (error) throw error;
};

export const deleteProject = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
};
```

`src/lib/skillsApi.js` mirrors it, using `skills`, `select('id, category, items, position')`, `skillRow`, `toSkill`, and `createSkill`, `updateSkill`, `deleteSkill`.

`src/lib/resumeApi.js`:

```js
import { RESUME_BUCKET, latestResume, resumeFileName, staleResumes } from './resume';
import { supabase } from './supabase';

const bucket = () => supabase.storage.from(RESUME_BUCKET);

const listResumes = async () => {
    const { data, error } = await bucket().list('', { limit: 100 });
    if (error) throw error;
    return data ?? [];
};

// The current resume, or null if none has been uploaded yet.
export const fetchCurrentResume = async () => {
    const file = latestResume(await listResumes());
    if (!file) return null;

    return {
        name: file.name,
        url: bucket().getPublicUrl(file.name).data.publicUrl,
        downloadUrl: bucket().getPublicUrl(file.name, { download: 'Resume.pdf' }).data.publicUrl,
    };
};

// Upload first, then delete everything else: a failed upload keeps the old
// resume, and a failed cleanup still serves the newest one.
export const replaceResume = async (file) => {
    const name = resumeFileName();
    const { error } = await bucket().upload(name, file, { contentType: 'application/pdf', upsert: false });
    if (error) throw error;

    const stale = staleResumes(await listResumes(), name);
    if (stale.length > 0) {
        const { error: removeError } = await bucket().remove(stale);
        if (removeError) throw removeError;
    }

    return fetchCurrentResume();
};
```

- [ ] **Step 7: Auth.** Rewrite `src/context/AuthContext.jsx`, keeping `useAuth`'s shape:

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Only accounts listed in public.admins count as signed in to the admin
// panel. There is no sign-up in the app, and sign-ups are off in Supabase;
// this check is the last line, and RLS still guards every write.
const isAdmin = async () => {
    const { data, error } = await supabase.rpc('is_admin');
    return !error && data === true;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const apply = async (session) => {
            const admin = session?.user && (await isAdmin());
            if (!active) return;
            setUser(admin ? session.user : null);
            setLoading(false);
        };

        supabase.auth.getSession().then(({ data }) => apply(data.session));

        // Deferred: supabase-js warns against awaiting its API inside this callback.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setTimeout(() => apply(session), 0);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    // Supabase returns errors instead of throwing; Login.jsx expects a throw.
    // A valid login that isn't an admin is signed straight back out.
    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!(await isAdmin())) {
            await supabase.auth.signOut();
            throw new Error('This account is not an admin.');
        }
        return data;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = { user, loading, login, logout, isAuthenticated: !!user };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

- [ ] **Step 8: Update the Resume window.** In `src/windows/Resume.jsx`:
- Replace the Firebase imports with `import { fetchCurrentResume } from '../lib/resumeApi';`.
- Keep `resumeUrl` state, but store the whole result as `resume` (`{ url, downloadUrl } | null`).
- In `fetchResumeUrl`, call `setResume(await fetchCurrentResume())`.
- When it resolves to `null`, render "No resume yet." with the sub-line "Check back soon." in the same centered layout as the error state, without the Retry button.
- The download link uses `resume.downloadUrl`. The iframe keeps `` `${resume.url}#toolbar=0&navpanes=0&view=FitH` ``.
- Change `export default WindowWrapper(Resume, 'resume');` to the Terminal-style named export: `const ResumeWindow = WindowWrapper(Resume, 'resume'); export default ResumeWindow;`.

- [ ] **Step 9: Update the docs.** In CLAUDE.md and AGENTS.md, replace the Firebase references:
- **Stack line:** "Supabase (Postgres/Storage/Auth)".
- **Env note:** `.env` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; see `.env.example`.
- **Test rule:** never import `src/lib/supabase.js` from a test.
- **Data-flow table:**
  - `projects` table → `lib/projectsApi.js`, ordered by `position`.
  - `skills` table → `lib/skillsApi.js`.
  - Storage bucket `resume` (one file, `resume-<timestamp>.pdf`) → `lib/resumeApi.js` (`windows/Resume.jsx`, `components/admin/ResumeUploader.jsx`).
- **Access control:** replace the "Access control is not in this repo" paragraph. Rules now live in `supabase/migrations/` as Row Level Security: public read, writes only for user ids in `public.admins`. New tables need their own policies there. The anon key is public by design.
- **Auth:** "Supabase Auth".

- [ ] **Step 10: Run the checks.**
- `npm test`: 265 passing (257 + 8).
- `npx eslint . --ignore-pattern .superpowers`: at most 10 errors. Report the exact count.
- `npm run build`: passes.
- `grep -rn "firebase" src package.json`: no matches outside `._*` files.

- [ ] **Step 11: Commit.**

```bash
git rm src/lib/firebase.js
git add src/lib/supabase.js src/lib/records.js src/lib/records.test.js src/lib/resume.js src/lib/resume.test.js src/lib/resumeApi.js src/lib/projectsApi.js src/lib/skillsApi.js src/context/AuthContext.jsx src/windows/Resume.jsx package.json package-lock.json CLAUDE.md AGENTS.md
git commit -m "feat: read projects, skills and the resume from Supabase; Supabase Auth; drop Firebase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin panel on Supabase, with single-resume replacement

**Files:**
- Modify: `src/components/admin/ProjectsManager.jsx`, `src/components/admin/SkillsManager.jsx`, `src/components/admin/ResumeUploader.jsx`

**Interfaces:**
- Consumes the Task 2 APIs: `fetchProjects`, `createProject`, `updateProject`, `deleteProject`, the matching skills functions, `fetchCurrentResume`, `replaceResume` and `validateResume`.

- [ ] **Step 1: Update `ProjectsManager.jsx`.**
- Replace the Firestore imports with `import { createProject, deleteProject, fetchProjects, updateProject } from '../../lib/projectsApi';`.
- **Fetch:** `setProjects(await fetchProjects())`.
- **Add:** `await createProject(formData, projects.length)`.
- **Update:** `await updateProject(id, formData)`.
- **Delete:** `await deleteProject(id)`.
- **Errors:** add `const [error, setError] = useState(null);`. Every catch does `setError('Could not save — check that you are signed in as the admin.')` for writes, and `setError('Could not load projects.')` for the fetch. Clear it at the start of each action, and show it as a red line under the heading. The `console.error` calls stay.
- **Existing behaviour:** keep all other markup and the `confirm()` before delete.
- **Edit form:** `startEdit` must use `project.github ?? ''` and `project.website ?? ''`, so the controlled inputs never receive null.

- [ ] **Step 2: Update `SkillsManager.jsx`.** Make the same changes with the skills API.
- The add and update calls pass the form `{ category, items }` straight to `createSkill` and `updateSkill`. `skillRow` handles the comma list.
- Keep the existing edit and display of `items`, which are joined with ", ".
- Remove the manual `split(',')` code, since `skillRow` now does it.
- Use `skills.length` as the position for new skills.

- [ ] **Step 3: Rewrite the logic of `ResumeUploader.jsx`.** Keep its look.
- **Imports:** replace the Firebase imports with `import { fetchCurrentResume, replaceResume } from '../../lib/resumeApi';` and `import { validateResume } from '../../lib/resume';`.
- **On mount:** load the current resume with `fetchCurrentResume()` into `currentResume` (`{ name, url } | null`). Show `loading` while it loads, and show an error line if it fails.
- **On file pick:**
  1. `const problem = validateResume(file)`. If there is a problem, show it inline (not `alert`) and stop.
  2. Otherwise set `uploading`, then `setCurrentResume(await replaceResume(file))`, then show the success line for 3 s.
  3. On failure, show `Upload failed — your previous resume is unchanged.` and keep the old `currentResume`.
  4. Reset the input's value afterwards, so the same file can be picked again.
- **Current file:** show it as "Current resume", with its upload date taken from the timestamp in the name, `new Date(Number(name.match(/\d+/)[0])).toLocaleString()`, plus a View link. If there is none, show "No resume uploaded yet."
- **Note text:** replace the old note with "Uploading a PDF replaces the current resume — the old file is deleted, so only one is ever kept. PDF only, up to 10 MB."
- **Unused imports:** remove `Trash2` and anything else left unused.

- [ ] **Step 4: Run the checks.**
- `npm test`: 265 passing.
- `npx eslint . --ignore-pattern .superpowers`: at most the Task 2 count. Report it.
- `npm run build`: passes.

- [ ] **Step 5: Commit.**

```bash
git add src/components/admin/ProjectsManager.jsx src/components/admin/SkillsManager.jsx src/components/admin/ResumeUploader.jsx
git commit -m "feat: admin panel on Supabase with single-resume replacement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Chrome checks (controller, with the user).**
- **Site, signed out:**
  - Finder → Projects lists the 2 migrated projects, and askSudo opens in Safari.
  - Skills shows the 5 categories, and Spotlight finds projects and skills.
  - The Resume window shows "No resume yet."
- **Admin:**
  - `/admin` redirects to the login page. The user signs in themselves in the test tab.
  - The dashboard shows their email.
  - Adding a test project shows it on the desktop after a reload; then edit it and delete it.
  - Skills add, edit and delete work.
- **Resume:**
  - The user uploads their resume, and it appears under "Current resume".
  - The Resume window on the site shows it, and download works.
  - Uploading a second PDF leaves the bucket with exactly one file. The controller checks this with a Storage list through the connector.
  - Picking a non-PDF shows the inline error, and nothing is uploaded.
- **Logout** returns to the login page, and `/admin` is protected again.
- **Access:** writes are rejected when signed out. The Task 1 Step 5 SQL already covers this.
- **Console:** only expected messages.
