import { describe, it, expect } from 'vitest';
import { canSetVolume } from './volumeSupport';

describe('canSetVolume', () => {
    it('accepts an element that keeps the volume it is given, and restores it', () => {
        const element = { volume: 1 };
        expect(canSetVolume(element)).toBe(true);
        expect(element.volume).toBe(1);
    });
    it('rejects an element that ignores volume writes (iOS)', () => {
        const element = { get volume() { return 1; }, set volume(value) {} };
        expect(canSetVolume(element)).toBe(false);
    });
    it('rejects an element whose volume setter throws', () => {
        const element = { get volume() { return 1; }, set volume(value) { throw new Error('no'); } };
        expect(canSetVolume(element)).toBe(false);
    });
});
