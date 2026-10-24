import { describe, it, expect } from 'vitest';
import {
    MAX_TRACK_BYTES, TRACK_SOFT_LIMIT, libraryOrPlaceholders, trackFilePath, validateAudio, validateCover,
} from './musicFiles';

const file = (type, size) => ({ type, size, name: 'x' });

describe('validateAudio', () => {
    it('accepts mp3, mp4 and aac audio within the limit', () => {
        for (const type of ['audio/mpeg', 'audio/mp4', 'audio/aac']) expect(validateAudio(file(type, 1000))).toBeNull();
        expect(validateAudio(file('audio/mpeg', MAX_TRACK_BYTES))).toBeNull();
    });

    it('rejects other types, oversize and empty files with a message', () => {
        expect(validateAudio(file('audio/wav', 1000))).toMatch(/MP3/);
        expect(validateAudio(file('image/png', 1000))).toMatch(/MP3/);
        expect(validateAudio(file('audio/mpeg', MAX_TRACK_BYTES + 1))).toMatch(/10 MB/);
        expect(validateAudio(file('audio/mpeg', 0))).toMatch(/empty/i);
        expect(validateAudio(null)).toMatch(/choose/i);
    });
});

describe('validateCover', () => {
    it('accepts jpeg, png and webp within the limit', () => {
        for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(validateCover(file(type, 1000))).toBeNull();
    });

    it('rejects other types and oversize files', () => {
        expect(validateCover(file('image/gif', 1000))).toMatch(/JPEG/);
        expect(validateCover(file('image/png', MAX_TRACK_BYTES + 1))).toMatch(/10 MB/);
    });
});

describe('constants', () => {
    it('caps uploads at 10 MB and warns past 5 songs', () => {
        expect(MAX_TRACK_BYTES).toBe(10 * 1024 * 1024);
        expect(TRACK_SOFT_LIMIT).toBe(5);
    });
});

describe('trackFilePath', () => {
    it('builds unique audio and cover paths', () => {
        expect(trackFilePath('audio', 'mp3', 1700, 'abc')).toBe('audio/1700-abc.mp3');
        expect(trackFilePath('cover', 'jpg', 1700, 'abc')).toBe('covers/1700-abc.jpg');
    });
});

describe('libraryOrPlaceholders', () => {
    const placeholders = [{ id: 'p' }];

    it('uses uploaded songs when there are any', () => {
        expect(libraryOrPlaceholders([{ id: 'u' }], placeholders)).toEqual([{ id: 'u' }]);
    });

    it('falls back to the placeholders when the library is empty or missing', () => {
        expect(libraryOrPlaceholders([], placeholders)).toBe(placeholders);
        expect(libraryOrPlaceholders(null, placeholders)).toBe(placeholders);
    });
});
