import { describe, it, expect } from 'vitest';
import { isMacPlatform, isMissionControlKey } from './shortcuts';

describe('isMacPlatform', () => {
    it('recognizes macOS platform strings', () => {
        expect(isMacPlatform('macOS')).toBe(true);
        expect(isMacPlatform('MacIntel')).toBe(true);
    });

    it('rejects other platforms and empty strings', () => {
        expect(isMacPlatform('Windows')).toBe(false);
        expect(isMacPlatform('Linux x86_64')).toBe(false);
        expect(isMacPlatform('')).toBe(false);
    });
});

describe('isMissionControlKey', () => {
    it('opens Mission Control with Ctrl+ArrowUp on Windows/Linux', () => {
        expect(isMissionControlKey({ ctrlKey: true, key: 'ArrowUp' }, false)).toBe(true);
    });

    it('leaves Ctrl+ArrowUp to macOS', () => {
        expect(isMissionControlKey({ ctrlKey: true, key: 'ArrowUp' }, true)).toBe(false);
    });

    it('ignores ArrowUp without Ctrl', () => {
        expect(isMissionControlKey({ ctrlKey: false, key: 'ArrowUp' }, false)).toBe(false);
    });
});
