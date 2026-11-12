import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { buildWindowConfig, getApp, INITIAL_Z_INDEX } from '../constants/apps';
import { clampBounds, fitOnScreen, getViewport, maximizedBounds } from '../lib/bounds';

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
const fitOpen = (key, bounds) => fitOnScreen(bounds, getApp(key).minSize, getViewport());

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
          : fitOpen(key, window.bounds ?? getApp(key).defaultBounds);

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

        // Coming forward by focus is not an icon open: forget the old icon rect.
        window.originRect = null;
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

        if (!window.isMaximized) {
          window.bounds = fitOpen(key, window.bounds ?? getApp(key).defaultBounds);
        }

        unminimize(state, key);
        raise(state, key);
      }),

    toggleMaximize: (key) =>
      set((state) => {
        const window = state.windows[key];

        if (!window || !window.isOpen) return;

        if (window.isMaximized) {
          window.bounds = fitOpen(key, window.prevBounds ?? getApp(key).defaultBounds);
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

    // Fresh default layout for every window (the desktop's saved bounds don't
    // suit the phone); minimize state is left alone.
    resetLayout: () =>
      set((state) => {
        Object.entries(state.windows).forEach(([key, window]) => {
          const { defaultBounds, minSize } = getApp(key);

          window.isMaximized = false;
          window.prevBounds = null;
          window.originRect = null;
          window.bounds = window.isOpen ? fitOnScreen(defaultBounds, minSize, getViewport()) : null;
        });
      }),

    fitToViewport: () =>
      set((state) => {
        Object.entries(state.windows).forEach(([key, window]) => {
          if (!window.bounds) return;

          window.bounds = window.isMaximized
            ? maximizedBounds(getViewport())
            : fitOpen(key, window.bounds);
        });
      }),
  }))
);

export default useWindowStore;
