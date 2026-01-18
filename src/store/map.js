import { create } from 'zustand';
import { mapLocations } from '../constants';

const useMapStore = create((set) => ({
    location: mapLocations[0],
    setLocation: (location) => set({ location }),
}));

export default useMapStore;
