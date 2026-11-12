import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    PHONE_QUERY,
    initialBootPhase,
    isPhoneScreen,
    markBootSeen,
    matchesMedia,
    readBootSeen,
} from './boot';

const memoryStorage = () => {
    const data = {};
    return {
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => { data[key] = String(value); },
    };
};

const throwingStorage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
};

describe('boot-seen flag', () => {
    it('is unset in a fresh tab', () => {
        expect(readBootSeen(memoryStorage())).toBe(false);
    });

    it('reads back after being marked', () => {
        const storage = memoryStorage();
        markBootSeen(storage);
        expect(readBootSeen(storage)).toBe(true);
    });

    it('treats blocked storage as unset instead of throwing', () => {
        expect(readBootSeen(throwingStorage)).toBe(false);
        expect(() => markBootSeen(throwingStorage)).not.toThrow();
    });

    it('treats missing storage (outside a browser) as unset', () => {
        expect(readBootSeen(undefined)).toBe(false);
        expect(() => markBootSeen(undefined)).not.toThrow();
    });
});

describe('matchesMedia', () => {
    afterEach(() => {
        delete globalThis.matchMedia;
    });

    it('is false outside a browser', () => {
        expect(matchesMedia('(max-width: 639px)')).toBe(false);
    });

    it('reports the media query result', () => {
        globalThis.matchMedia = (query) => ({ matches: query === '(max-width: 639px)' });
        expect(matchesMedia('(max-width: 639px)')).toBe(true);
        expect(matchesMedia('(prefers-reduced-motion: reduce)')).toBe(false);
    });
});

describe('initialBootPhase', () => {
    it('boots on a first visit', () => {
        expect(initialBootPhase({ bootSeen: false })).toBe('booting');
    });

    it('skips to the desktop after the boot was seen in this tab', () => {
        expect(initialBootPhase({ bootSeen: true })).toBe('desktop');
    });

    it('boots on a first visit on any screen size', () => {
        expect(initialBootPhase({ bootSeen: false })).toBe('booting');
    });
});

describe('isPhoneScreen', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reports phone mode from the phone media query', () => {
        vi.stubGlobal('matchMedia', (query) => ({ matches: query === PHONE_QUERY }));
        expect(isPhoneScreen()).toBe(true);
    });
});
