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
