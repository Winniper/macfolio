import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { buildWindowConfig, getApp, INITIAL_Z_INDEX } from '../constants/apps';
import { clampBounds, getViewport, maximizedBounds } from '../lib/bounds';

export const createInitialWindowState = () => ({
  windows: buildWindowConfig(),
  nextZIndex: INITIAL_Z_INDEX + 1,
  focusedId: null,
  minimizedStack: [],
});

const isVisible = (window) => window.isOpen && !window.isMinimized;

const topmostVisibleWindow = (windows) => {
  let topId = null;
  let topZ = -Infinity;

  Object.entries(windows).forEach(([id, window]) => {
    if (isVisible(window) && window.zIndex > topZ) {
      topId = id;
      topZ = window.zIndex;
    }
  });

  return topId;
};

const fitBounds = (key, bounds) => clampBounds(bounds, getApp(key).minSize, getViewport());

const raise = (state, key) => {
  state.windows[key].zIndex = state.nextZIndex;
  state.nextZIndex++;
  state.focusedId = key;
};

const unminimize = (state, key) => {
  state.windows[key].isMinimized = false;
  state.minimizedStack = state.minimizedStack.filter((id) => id !== key);
};

const useWindowStore = create(
  immer((set) => ({
    ...createInitialWindowState(),

    openWindow: (key, data = null, originRect = null) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = true;
        window.data = data || window.data;
        window.originRect = originRect;
        window.bounds = window.isMaximized
          ? maximizedBounds(getViewport())
          : fitBounds(key, window.bounds ?? getApp(key).defaultBounds);

        unminimize(state, key);
        raise(state, key);
      }),

    closeWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.isOpen = false;
        window.zIndex = INITIAL_Z_INDEX;
        window.data = null;
        window.originRect = null;
        unminimize(state, key);

        if (state.focusedId === key) {
          state.focusedId = topmostVisibleWindow(state.windows);
        }
      }),

    focusWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !isVisible(window) || state.focusedId === key) return;

        raise(state, key);
      }),

    minimizeWindow: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !isVisible(window)) return;

        window.isMinimized = true;
        state.minimizedStack.push(key);

        if (state.focusedId === key) {
          state.focusedId = topmostVisibleWindow(state.windows);
        }
      }),

    restoreWindow: (key, originRect = null) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !window.isMinimized) return;

        window.originRect = originRect;
        unminimize(state, key);
        raise(state, key);
      }),

    toggleMaximize: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !window.isOpen) return;

        if (window.isMaximized) {
          window.bounds = fitBounds(key, window.prevBounds ?? getApp(key).defaultBounds);
          window.prevBounds = null;
          window.isMaximized = false;
        } else {
          window.prevBounds = window.bounds;
          window.bounds = maximizedBounds(getViewport());
          window.isMaximized = true;
        }
      }),

    setBounds: (key, bounds) =>
      set((state) => {
        const window = state.windows[key];

        if (!window) return;

        window.bounds = fitBounds(key, bounds);
      }),

    fitToViewport: () =>
      set((state) => {
        Object.entries(state.windows).forEach(([key, window]) => {
          if (!window.bounds) return;

          window.bounds = window.isMaximized
            ? maximizedBounds(getViewport())
            : fitBounds(key, window.bounds);
        });
      }),
  }))
);

export default useWindowStore;
