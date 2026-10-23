import { describe, it, expect } from 'vitest';
import { isMacPlatform, isMissionControlKey, isSpotlightKey, switcherModifier } from './shortcuts';

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

describe('switcherModifier', () => {
    it('starts the switcher with Option+Tab on macOS', () => {
        expect(switcherModifier({ altKey: true, ctrlKey: false, key: 'Tab', code: 'Tab' }, true)).toBe('Alt');
    });

    it('leaves Alt+Tab to Windows/Linux', () => {
        expect(switcherModifier({ altKey: true, ctrlKey: false, key: 'Tab', code: 'Tab' }, false)).toBeNull();
    });

    it('starts the switcher with Ctrl+` everywhere', () => {
        const event = { altKey: false, ctrlKey: true, key: '`', code: 'Backquote' };
        expect(switcherModifier(event, true)).toBe('Control');
        expect(switcherModifier(event, false)).toBe('Control');
    });

    it('ignores plain Tab', () => {
        expect(switcherModifier({ altKey: false, ctrlKey: false, key: 'Tab', code: 'Tab' }, true)).toBeNull();
    });
});

describe('isSpotlightKey', () => {
    it('opens with Cmd+K on macOS, leaving Ctrl+K to text fields', () => {
        expect(isSpotlightKey({ metaKey: true, key: 'k' }, true)).toBe(true);
        expect(isSpotlightKey({ metaKey: true, key: 'K' }, true)).toBe(true);
        expect(isSpotlightKey({ ctrlKey: true, key: 'k' }, true)).toBe(false);
        expect(isSpotlightKey({ metaKey: true, code: 'Space', key: ' ' }, true)).toBe(false);
    });

    it('opens with Ctrl+K or Meta+Space elsewhere', () => {
        expect(isSpotlightKey({ ctrlKey: true, key: 'k' }, false)).toBe(true);
        expect(isSpotlightKey({ metaKey: true, code: 'Space', key: ' ' }, false)).toBe(true);
        expect(isSpotlightKey({ metaKey: true, key: 'k' }, false)).toBe(false);
    });

    it('ignores plain K and Shift/Alt combinations', () => {
        expect(isSpotlightKey({ key: 'k' }, true)).toBe(false);
        expect(isSpotlightKey({ metaKey: true, shiftKey: true, key: 'k' }, true)).toBe(false);
        expect(isSpotlightKey({ ctrlKey: true, altKey: true, key: 'k' }, false)).toBe(false);
    });
});
