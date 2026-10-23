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
