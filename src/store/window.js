import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { buildWindowConfig, INITIAL_Z_INDEX } from '../constants/apps';

export const createInitialWindowState = () => ({
  windows: buildWindowConfig(),
  nextZIndex: INITIAL_Z_INDEX + 1,
  focusedId: null,
});

const topmostOpenWindow = (windows) => {
  let topId = null;
  let topZ = -Infinity;

  Object.entries(windows).forEach(([id, window]) => {
    if (window.isOpen && window.zIndex > topZ) {
      topId = id;
      topZ = window.zIndex;
    }
  });

  return topId;
};

const useWindowStore = create(
  immer((set) => ({
    ...createInitialWindowState(),

    openWindow: (key, data = null) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = true;
        window.zIndex = state.nextZIndex;
        window.data = data || window.data;

        state.nextZIndex++;
        state.focusedId = key;
      }),

    closeWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = false;
        window.zIndex = INITIAL_Z_INDEX;
        window.data = null;

        if (state.focusedId === key) {
          state.focusedId = topmostOpenWindow(state.windows);
        }
      }),

    focusWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !window.isOpen) return;

        window.zIndex = state.nextZIndex;
        state.nextZIndex++;
        state.focusedId = key;
      }),
  }))
);

export default useWindowStore;
