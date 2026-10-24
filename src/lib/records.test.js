import { describe, it, expect } from 'vitest';
import { parseSkillItems, projectRow, skillRow, toProject, toSkill, toTrack, trackRow } from './records';

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

describe('track records', () => {
    const urlFor = (path) => `https://cdn/${path}`;

    it('maps a row to the shape the player uses', () => {
        expect(toTrack({ id: 't1', title: 'Song', artist: 'Me', album: 'LP', audio_path: 'audio/a.mp3', cover_path: 'covers/c.jpg', duration: 123.4, position: 1 }, urlFor))
            .toEqual({ id: 't1', title: 'Song', artist: 'Me', album: 'LP', cover: 'https://cdn/covers/c.jpg', src: 'https://cdn/audio/a.mp3', duration: 123.4, order: 1, audioPath: 'audio/a.mp3', coverPath: 'covers/c.jpg' });
    });

    it('fills blanks: no cover, unknown artist and album, zero duration', () => {
        expect(toTrack({ id: 't2', title: 'Bare', artist: null, album: null, audio_path: 'audio/b.mp3', cover_path: null, duration: null }, urlFor))
            .toEqual({ id: 't2', title: 'Bare', artist: '', album: '', cover: null, src: 'https://cdn/audio/b.mp3', duration: 0, order: 0, audioPath: 'audio/b.mp3', coverPath: null });
    });

    it('builds a row from the admin form, trimming and nulling blanks', () => {
        expect(trackRow({ title: '  Song ', artist: ' Me ', album: '   ' })).toEqual({ title: 'Song', artist: 'Me', album: null });
        expect(trackRow({ title: 'T' })).toEqual({ title: 'T', artist: null, album: null });
    });
});
