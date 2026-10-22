import { describe, it, expect } from 'vitest';
import { isMacPlatform, isMissionControlKey, switcherModifier } from './shortcuts';

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
