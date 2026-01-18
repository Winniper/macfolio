import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { windowConfig, initialZIndex } from '../constants';

const useWindowStore = create(
  immer((set) => ({
    windows: windowConfig,
    nextZIndex: initialZIndex + 1,

    openWindow: (key, data = null) =>
      set((state) => {
        const window = state.windows[key];
        
        if (!window) return;

        window.isOpen = true;
        window.zIndex = state.nextZIndex;
        window.data = data || window.data; 
        
        state.nextZIndex++;
      }),

    closeWindow: (key) =>
      set((state) => {
        const window = state.windows[key];
        
        if (!window) return;

        window.isOpen = false;
        window.zIndex = initialZIndex;
        window.data = null;
      }),

    focusWindow: (key) =>
      set((state) => {
        const window = state.windows[key];
        
        if (!window) return;

        window.zIndex = state.nextZIndex;
        state.nextZIndex++;
      }),
  }))
);

export default useWindowStore;