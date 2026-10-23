import { APPS } from '../constants/apps';

// Spotlight's search is pure: the index is built from the registry and the
// Firestore lists, and every entry carries a plain action for runMenuAction
// (src/lib/menuActions.js). Notes join in Phase 8.

export const SPOTLIGHT_GROUPS = [
    { id: 'apps', label: 'Applications' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
    { id: 'tracks', label: 'Songs' },
];

// Firestore data is untyped: only non-blank strings count.
const isText = (value) => typeof value === 'string' && value.trim() !== '';

const appEntries = (apps) => apps
    .filter((app) => app.hasWindow !== false || app.action)
    .map((app) => ({
        id: `app:${app.id}`,
        group: 'apps',
        title: app.title,
        subtitle: 'Application',
        icon: app.icon,
        keywords: app.keywords ?? [],
        action: app.action === 'missionControl' ? { type: 'missionControl' } : { type: 'openApp', id: app.id },
    }));

const projectEntry = (project) => {
    const title = project.title.trim();

    if (isText(project.website)) {
        return { subtitle: 'Open in Safari', action: { type: 'openApp', id: 'safari', data: { url: project.website, title } } };
    }
    if (isText(project.github)) {
        return { subtitle: 'Open on GitHub', action: { type: 'openUrl', url: project.github } };
    }
    return { subtitle: 'Show in Finder', action: { type: 'openApp', id: 'finder' } };
};

const projectEntries = (projects) => projects
    .filter((project) => isText(project?.title))
    .map((project) => ({
        id: `project:${project.id}`,
        group: 'projects',
        title: project.title.trim(),
        icon: '/images/folder.png',
        keywords: [],
        ...projectEntry(project),
    }));

// The admin panel saves items as an array; older docs may hold one string.
const skillItems = (items) => (Array.isArray(items) ? items : isText(items) ? items.split(',') : [])
    .filter(isText)
    .map((item) => item.trim());

const skillEntries = (skills) => skills.flatMap((skill) => skillItems(skill?.items).map((item, index) => ({
    id: `skill:${skill.id}:${index}`,
    group: 'skills',
    title: item,
    subtitle: isText(skill.category) ? skill.category.trim() : 'Skill',
    icon: '/images/terminal.png',
    keywords: isText(skill.category) ? [skill.category.trim()] : [],
    action: { type: 'openApp', id: 'terminal' },
})));

const trackEntries = (list) => list
    .filter((track) => isText(track?.title))
    .map((track) => ({
        id: `track:${track.id}`,
        group: 'tracks',
        title: track.title.trim(),
        subtitle: [track.artist, track.album].filter(isText).join(' — '),
        icon: '/images/music.svg',
        keywords: [track.artist, track.album].filter(isText),
        action: { type: 'playTrack', id: track.id },
    }));

export const buildSpotlightIndex = ({ apps = APPS, projects = [], skills = [], tracks = [] } = {}) => [
    ...appEntries(apps),
    ...projectEntries(projects),
    ...skillEntries(skills),
    ...trackEntries(tracks),
];

const normalize = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const wordsOf = (text) => text.split(/[\s\-_./]+/).filter(Boolean);

// Higher is better; 0 means no match. Plain string checks only, so any
// symbol in the query is matched literally.
const scoreEntry = (entry, query) => {
    const title = normalize(entry.title);
    const keywords = entry.keywords.map(normalize);

    if (title === query) return 6;
    if (title.startsWith(query)) return 5;
    if (wordsOf(title).some((word) => word.startsWith(query))) return 4;
    if (keywords.some((keyword) => keyword.startsWith(query))) return 3;
    if (title.includes(query)) return 2;
    if (keywords.some((keyword) => keyword.includes(query))) return 1;
    return 0;
};

export const searchSpotlight = (index, rawQuery, { perGroup = 5 } = {}) => {
    const query = typeof rawQuery === 'string' ? normalize(rawQuery) : '';

    if (!query) return [];

    return SPOTLIGHT_GROUPS
        .map((group) => ({
            ...group,
            results: index
                .map((entry, order) => ({ entry, order, score: entry.group === group.id ? scoreEntry(entry, query) : 0 }))
                .filter((match) => match.score > 0)
                .sort((a, b) => b.score - a.score || a.order - b.order)
                .slice(0, perGroup)
                .map((match) => match.entry),
        }))
        .filter((group) => group.results.length > 0);
};

export const flattenResults = (groups) => groups.flatMap((group) => group.results);

export const moveSelection = (index, delta, count) => (count === 0 ? 0 : (index + delta + count) % count);
