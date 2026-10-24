-- Music library managed from the admin panel: public read, admin-only writes.
-- Audio and covers live in the public "music" bucket (10 MB per file keeps the
-- free plan's egress budget in reach); rows point at them by storage path.

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  artist text,
  album text,
  audio_path text not null,
  cover_path text,
  duration real,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

create policy "Anyone can read tracks" on public.tracks for select to anon, authenticated using (true);
create policy "Admins add tracks" on public.tracks for insert to authenticated with check (public.is_admin());
create policy "Admins edit tracks" on public.tracks for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete tracks" on public.tracks for delete to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music', 'music', true, 10485760, array['audio/mpeg', 'audio/mp4', 'audio/aac', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Anyone can list music" on storage.objects for select to anon, authenticated using (bucket_id = 'music');
create policy "Admins upload music" on storage.objects for insert to authenticated with check (bucket_id = 'music' and public.is_admin());
create policy "Admins delete music" on storage.objects for delete to authenticated using (bucket_id = 'music' and public.is_admin());
