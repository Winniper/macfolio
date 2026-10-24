import { createFetchStore } from '../lib/fetchStore';
import { fetchTracks } from '../lib/tracksApi';

const useTracksStore = createFetchStore(fetchTracks, { what: 'songs' });

export default useTracksStore;
