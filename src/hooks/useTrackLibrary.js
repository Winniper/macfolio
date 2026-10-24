import { useEffect } from 'react';

import { placeholderTracks } from '../constants';
import { libraryOrPlaceholders } from '../lib/musicFiles';
import useSystemStore from '../store/system';
import useTracksStore from '../store/tracks';

// Loads the uploaded songs into the player's library. Mounted once, in
// AudioController. A failed load leaves the placeholders in place.
const useTrackLibrary = () => {
    const status = useTracksStore((state) => state.status);
    const items = useTracksStore((state) => state.items);
    const load = useTracksStore((state) => state.load);
    const setLibrary = useSystemStore((state) => state.setLibrary);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (status === 'success') setLibrary(libraryOrPlaceholders(items, placeholderTracks));
    }, [status, items, setLibrary]);
};

export default useTrackLibrary;
