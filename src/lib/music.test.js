import { describe, it, expect } from 'vitest';
import {
    adjacentTrackId, albumsOf, albumTitleOf, artistOf, clampVolume, coverGradient, formatTime, nowPlayingNotification, trackById,
} from './music';
import { placeholderTracks as tracks } from '../constants';

const list = [
    { id: 'a', title: 'A', artist: 'X', album: 'One', cover: null },
    { id: 'b', title: 'B', artist: 'X', album: 'Two', cover: '/b.jpg' },
    { id: 'c', title: 'C', artist: 'X', album: 'One', cover: null },
];

describe('formatTime', () => {
    it('shows minutes and two-digit seconds, and 0:00 for anything unusable', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(59.9)).toBe('0:59');
        expect(formatTime(3600)).toBe('60:00');
        expect(formatTime(-4)).toBe('0:00');
        expect(formatTime(NaN)).toBe('0:00');
        expect(formatTime(undefined)).toBe('0:00');
        expect(formatTime(Infinity)).toBe('0:00');
    });
});

describe('track helpers', () => {
    it('finds tracks and their neighbours, or nothing', () => {
        expect(trackById(list, 'b').title).toBe('B');
        expect(trackById(list, 'z')).toBeNull();
        expect(adjacentTrackId(list, 'a', 1)).toBe('b');
        expect(adjacentTrackId(list, 'b', -1)).toBe('a');
        expect(adjacentTrackId(list, 'c', 1)).toBeNull();
        expect(adjacentTrackId(list, 'a', -1)).toBeNull();
        expect(adjacentTrackId(list, 'z', 1)).toBeNull();
        expect(adjacentTrackId(list, null, 1)).toBeNull();
    });

    it('keeps volume between 0 and 1', () => {
        expect(clampVolume(0.4)).toBe(0.4);
        expect(clampVolume(3)).toBe(1);
        expect(clampVolume(-1)).toBe(0);
        expect(clampVolume('x')).toBe(0);
    });

    it('groups tracks into albums in first-appearance order', () => {
        expect(albumsOf(list).map((album) => [album.title, album.cover, album.tracks.map((track) => track.id)])).toEqual([
            ['One', null, ['a', 'c']],
            ['Two', '/b.jpg', ['b']],
        ]);
    });

    it('draws a stable gradient per album', () => {
        expect(coverGradient('Desk Sessions')).toBe(coverGradient('Desk Sessions'));
        expect(coverGradient('Desk Sessions')).not.toBe(coverGradient('Side Projects'));
        expect(coverGradient('Desk Sessions')).toMatch(/^linear-gradient\(/);
    });

    it('announces a track that starts while Music is closed', () => {
        expect(nowPlayingNotification({ title: 'First Light', artist: 'Studio Placeholder' })).toEqual({
            appId: 'music',
            title: 'Now Playing',
            body: 'First Light — Studio Placeholder',
            action: { type: 'openApp', id: 'music' },
        });
    });
});

describe('tracks', () => {
    it('lists playable placeholder tracks with unique ids', () => {
        expect(tracks.length).toBeGreaterThanOrEqual(2);
        expect(new Set(tracks.map((track) => track.id)).size).toBe(tracks.length);
        tracks.forEach((track) => {
            expect(track, track.id).toMatchObject({
                title: expect.any(String),
                artist: expect.any(String),
                album: expect.any(String),
                src: `/music/${track.id}.wav`,
            });
            expect(track.duration, track.id).toBeGreaterThan(0);
        });
    });
});

describe('songs without album or artist', () => {
    const bare = [
        { id: 'a', title: 'Alpha', artist: '', album: '', cover: null },
        { id: 'b', title: 'Beta', artist: '', album: '', cover: null },
    ];

    it('uses the title and Unknown artist as fallbacks', () => {
        expect(albumTitleOf(bare[0])).toBe('Alpha');
        expect(artistOf(bare[0])).toBe('Unknown artist');
        expect(albumTitleOf({ title: 'T', album: 'LP' })).toBe('LP');
    });

    it('groups album-less songs under their own titles, not one blank album', () => {
        expect(albumsOf(bare).map((album) => [album.title, album.artist])).toEqual([
            ['Alpha', 'Unknown artist'],
            ['Beta', 'Unknown artist'],
        ]);
    });

    it('builds a Now Playing body without a dangling dash', () => {
        expect(nowPlayingNotification(bare[0]).body).toBe('Alpha');
        expect(nowPlayingNotification({ title: 'A', artist: 'B' }).body).toBe('A — B');
    });
});
