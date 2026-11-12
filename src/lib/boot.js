// First-load boot sequence helpers. Every browser API here is wrapped so a
// blocked or missing one degrades to "show the boot again", never a crash.

// index.html repeats this key in its inline boot-shell script; keep them in sync.
export const BOOT_SEEN_KEY = 'portfolio:bootSeen';

// Phone mode: narrow windows, and touch devices held sideways (short but wide).
export const PHONE_QUERY = '(max-width: 639px), (pointer: coarse) and (max-height: 499px)';
export const PHONE_LANDSCAPE_QUERY =
    '(pointer: coarse) and (max-height: 499px) and (orientation: landscape)';

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

export const isPhoneScreen = () => matchesMedia(PHONE_QUERY);

export const prefersReducedMotion = () => matchesMedia('(prefers-reduced-motion: reduce)');

export const initialBootPhase = ({ bootSeen }) => (bootSeen ? 'desktop' : 'booting');
