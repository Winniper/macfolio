import { useSyncExternalStore } from 'react';

// Live `matchMedia(query).matches`; false where matchMedia is missing.
const useMediaQuery = (query) => {
    const subscribe = (onChange) => {
        const list = globalThis.matchMedia?.(query);
        list?.addEventListener('change', onChange);
        return () => list?.removeEventListener('change', onChange);
    };
    const getSnapshot = () => globalThis.matchMedia?.(query).matches ?? false;

    return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

export default useMediaQuery;
