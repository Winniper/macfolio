import { describe, it, expect } from 'vitest';
import {
    MAX_TRACK_BYTES, TRACK_SOFT_LIMIT, canonicalAudioType, libraryOrPlaceholders, reorder, trackFilePath, validateAudio, validateCover,
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

describe('canonicalAudioType', () => {
    const named = (type, name) => ({ type, name });

    it('maps MIME aliases to canonical types', () => {
        expect(canonicalAudioType(named('audio/x-m4a', 'a.bin'))).toBe('audio/mp4');
        expect(canonicalAudioType(named('audio/mp3', 'a.bin'))).toBe('audio/mpeg');
        expect(canonicalAudioType(named('audio/mpeg', 'a.mp3'))).toBe('audio/mpeg');
        expect(canonicalAudioType(named('audio/aac', 'a.aac'))).toBe('audio/aac');
    });

    it('falls back to the extension when the type is empty', () => {
        expect(canonicalAudioType(named('', 'Song.M4A'))).toBe('audio/mp4');
        expect(canonicalAudioType(named('', 'a.mp3'))).toBe('audio/mpeg');
        expect(canonicalAudioType(named('', 'a.aac'))).toBe('audio/aac');
    });

    it('returns null for anything else', () => {
        expect(canonicalAudioType(named('text/plain', 'a.txt'))).toBeNull();
        expect(canonicalAudioType(named('audio/wav', 'a.wav'))).toBeNull();
        expect(canonicalAudioType(named('', 'noextension'))).toBeNull();
        expect(canonicalAudioType(null)).toBeNull();
    });

    it('lets validateAudio accept aliased and untyped uploads but not txt or wav', () => {
        expect(validateAudio({ type: 'audio/x-m4a', name: 'a.m4a', size: 10 })).toBeNull();
        expect(validateAudio({ type: 'audio/mp3', name: 'a.mp3', size: 10 })).toBeNull();
        expect(validateAudio({ type: '', name: 'a.m4a', size: 10 })).toBeNull();
        expect(validateAudio({ type: 'text/plain', name: 'a.txt', size: 10 })).toMatch(/MP3/);
        expect(validateAudio({ type: 'audio/wav', name: 'a.wav', size: 10 })).toMatch(/MP3/);
    });
});

describe('reorder', () => {
    const list = ['a', 'b', 'c'];

    it('moves a song up or down without mutating the input', () => {
        expect(reorder(list, 1, -1)).toEqual(['b', 'a', 'c']);
        expect(reorder(list, 1, 1)).toEqual(['a', 'c', 'b']);
        expect(list).toEqual(['a', 'b', 'c']);
    });

    it('is a no-op at the ends', () => {
        expect(reorder(list, 0, -1)).toBe(list);
        expect(reorder(list, 2, 1)).toBe(list);
        expect(reorder(list, 5, 1)).toBe(list);
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
