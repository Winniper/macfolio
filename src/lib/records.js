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

// Music rows keep storage paths; urlFor turns a path into a public URL.
export const toTrack = (row, urlFor) => ({
    id: row.id,
    title: row.title,
    artist: row.artist ?? '',
    album: row.album ?? '',
    cover: row.cover_path ? urlFor(row.cover_path) : null,
    src: urlFor(row.audio_path),
    duration: row.duration ?? 0,
    order: row.position ?? 0,
    audioPath: row.audio_path,
    coverPath: row.cover_path ?? null,
});

export const trackRow = (form) => ({
    title: text(form.title),
    artist: text(form.artist) || null,
    album: text(form.album) || null,
});
