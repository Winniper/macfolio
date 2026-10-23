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
