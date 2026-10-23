import { describe, it, expect } from 'vitest';
import { buildSpotlightIndex, flattenResults, moveSelection, searchSpotlight } from './spotlight';

const titles = (groups) => groups.map((group) => [group.id, group.results.map((entry) => entry.title)]);

describe('buildSpotlightIndex', () => {
    it('indexes every app that does something, but not the Archive', () => {
        const ids = buildSpotlightIndex().filter((entry) => entry.group === 'apps').map((entry) => entry.id);
        expect(ids).toEqual(['app:finder', 'app:contact', 'app:terminal', 'app:resume', 'app:safari', 'app:missionControl', 'app:about']);
    });

    it('opens windowed apps and runs launchers', () => {
        const index = buildSpotlightIndex();
        expect(index.find((entry) => entry.id === 'app:resume')).toMatchObject({
            title: 'Resume',
            subtitle: 'Application',
            icon: '/images/pdf.png',
            action: { type: 'openApp', id: 'resume' },
        });
        expect(index.find((entry) => entry.id === 'app:missionControl').action).toEqual({ type: 'missionControl' });
    });

    it('opens a project site in Safari, else its GitHub page, else Finder', () => {
        const index = buildSpotlightIndex({
            projects: [
                { id: 'a', title: 'askSudo', website: 'ask-sudo.vercel.app', github: 'https://github.com/x/a' },
                { id: 'b', title: 'Bot', github: 'https://github.com/x/b' },
                { id: 'c', title: 'Draft' },
            ],
        }).filter((entry) => entry.group === 'projects');

        expect(index.map((entry) => [entry.id, entry.subtitle, entry.action])).toEqual([
            ['project:a', 'Open in Safari', { type: 'openApp', id: 'safari', data: { url: 'ask-sudo.vercel.app', title: 'askSudo' } }],
            ['project:b', 'Open on GitHub', { type: 'openUrl', url: 'https://github.com/x/b' }],
            ['project:c', 'Show in Finder', { type: 'openApp', id: 'finder' }],
        ]);
    });

    it('skips untitled projects and ignores websites that are not text', () => {
        const index = buildSpotlightIndex({
            projects: [
                { id: 'a' },
                { id: 'b', title: '   ' },
                { id: 'c', title: 42 },
                { id: 'd', title: ' Tidy ', website: 42 },
            ],
        }).filter((entry) => entry.group === 'projects');

        expect(index.map((entry) => [entry.title, entry.action])).toEqual([
            ['Tidy', { type: 'openApp', id: 'finder' }],
        ]);
    });

    it('lists each technology under its category and opens the Skills terminal', () => {
        const index = buildSpotlightIndex({
            skills: [
                { id: 'fe', category: 'Frontend', items: ['React', ' Tailwind ', 7, ''] },
                { id: 'be', category: 'Backend', items: 'Node.js, Firebase' },
                { id: 'x', category: 'Empty' },
            ],
        }).filter((entry) => entry.group === 'skills');

        expect(index.map((entry) => [entry.title, entry.subtitle])).toEqual([
            ['React', 'Frontend'],
            ['Tailwind', 'Frontend'],
            ['Node.js', 'Backend'],
            ['Firebase', 'Backend'],
        ]);
        expect(index.every((entry) => entry.action.type === 'openApp' && entry.action.id === 'terminal')).toBe(true);
        expect(new Set(index.map((entry) => entry.id)).size).toBe(index.length);
    });
});

describe('searchSpotlight', () => {
    const index = buildSpotlightIndex({
        projects: [
            { id: 'p1', title: 'Portfolio OS' },
            { id: 'p2', title: 'Resume Parser' },
            { id: 'p3', title: 'Pricing Page' },
        ],
        skills: [{ id: 's', category: 'Frontend', items: ['React', 'Preact'] }],
    });

    it('returns nothing for an empty or blank query', () => {
        expect(searchSpotlight(index, '')).toEqual([]);
        expect(searchSpotlight(index, '   ')).toEqual([]);
        expect(searchSpotlight(index, undefined)).toEqual([]);
    });

    it('ignores case and extra spaces', () => {
        expect(titles(searchSpotlight(index, '  PORTFOLIO   os '))).toEqual([['projects', ['Portfolio OS']]]);
    });

    it('ranks exact, prefix, word-prefix, keyword, then substring matches', () => {
        const ranked = buildSpotlightIndex({
            apps: [],
            projects: [
                { id: '1', title: 'Spare Parts' },
                { id: '2', title: 'Parse' },
                { id: '3', title: 'Parser' },
                { id: '4', title: 'Comparse' },
                { id: '5', title: 'Big Parse Job' },
            ],
        });
        expect(titles(searchSpotlight(ranked, 'parse'))).toEqual([
            ['projects', ['Parse', 'Parser', 'Big Parse Job', 'Comparse']],
        ]);
    });

    it('finds apps by keyword', () => {
        expect(titles(searchSpotlight(index, 'cv'))).toEqual([['apps', ['Resume']]]);
    });

    it('keeps ties in index order and groups in a fixed order', () => {
        expect(titles(searchSpotlight(index, 'res'))).toEqual([
            ['apps', ['Resume']],
            ['projects', ['Resume Parser']],
        ]);
        // Projects is a title prefix; About This Mac matches by its 'profile' keyword.
        expect(titles(searchSpotlight(index, 'pr'))).toEqual([
            ['apps', ['Projects', 'About This Mac']],
            ['projects', ['Pricing Page']],
            ['skills', ['Preact']],
        ]);
    });

    it('caps each group', () => {
        const many = buildSpotlightIndex({
            apps: [],
            projects: Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: `Site ${i}` })),
        });
        expect(searchSpotlight(many, 'site')[0].results).toHaveLength(5);
        expect(searchSpotlight(many, 'site', { perGroup: 2 })[0].results.map((entry) => entry.title)).toEqual(['Site 0', 'Site 1']);
    });

    it('treats symbols literally', () => {
        expect(() => searchSpotlight(index, '(')).not.toThrow();
        expect(searchSpotlight(index, '.*')).toEqual([]);
        expect(titles(searchSpotlight(buildSpotlightIndex({ apps: [], projects: [{ id: 'c', title: 'C++ Notes' }] }), 'c++')))
            .toEqual([['projects', ['C++ Notes']]]);
    });

    it('flattens groups in display order', () => {
        expect(flattenResults(searchSpotlight(index, 'res')).map((entry) => entry.id)).toEqual(['app:resume', 'project:p2']);
    });
});

describe('moveSelection', () => {
    it('moves and wraps at both ends', () => {
        expect(moveSelection(0, 1, 3)).toBe(1);
        expect(moveSelection(2, 1, 3)).toBe(0);
        expect(moveSelection(0, -1, 3)).toBe(2);
    });

    it('stays at 0 when there is nothing to select', () => {
        expect(moveSelection(0, 1, 0)).toBe(0);
        expect(moveSelection(4, -1, 0)).toBe(0);
    });
});
