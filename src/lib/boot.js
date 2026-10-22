// First-load boot sequence helpers. Every browser API here is wrapped so a
// blocked or missing one degrades to "show the boot again", never a crash.

const BOOT_SEEN_KEY = 'portfolio:bootSeen';

export const readBootSeen = (storage = globalThis.sessionStorage) => {
    try {
        return storage?.getItem(BOOT_SEEN_KEY) === '1';
    } catch {
        return false;
    }
};

export const markBootSeen = (storage = globalThis.sessionStorage) => {
    try {
        storage?.setItem(BOOT_SEEN_KEY, '1');
    } catch {
        // Storage blocked: the boot simply plays again next load.
    }
};

export const matchesMedia = (query) => {
    try {
        return globalThis.matchMedia?.(query).matches ?? false;
    } catch {
        return false;
    }
};

// Tailwind's `sm` breakpoint is 640px; below it the site shows its
// desktop-only notice instead.
export const isSmallScreen = () => matchesMedia('(max-width: 639px)');

export const prefersReducedMotion = () => matchesMedia('(prefers-reduced-motion: reduce)');

export const initialBootPhase = ({ bootSeen, smallScreen }) =>
    bootSeen || smallScreen ? 'desktop' : 'booting';
