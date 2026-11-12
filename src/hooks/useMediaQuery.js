import { useCallback, useSyncExternalStore } from 'react';

import { matchesMedia } from '../lib/boot';

// Live `matchMedia(query).matches`; false where matchMedia is missing or throws.
const useMediaQuery = (query) => {
    const subscribe = useCallback((onChange) => {
        let list = null;
        try {
            list = globalThis.matchMedia?.(query) ?? null;
            list?.addEventListener('change', onChange);
        } catch {
            list = null;
        }
        return () => list?.removeEventListener('change', onChange);
    }, [query]);
    const getSnapshot = useCallback(() => matchesMedia(query), [query]);

    return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

export default useMediaQuery;
