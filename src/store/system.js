import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getViewport } from '../lib/bounds';
import { missionControlLayout } from '../lib/missionControl';
import useWindowStore from './window';

// OS-level state that isn't about a single window. Later phases add boot
// phase, Spotlight, Control Center and audio here.
export const createInitialSystemState = () => ({
  missionControl: null,
});

const visibleWindowEntries = () =>
  Object.entries(useWindowStore.getState().windows)
    .filter(([, window]) => window.isOpen && !window.isMinimized && window.bounds)
    .sort(([, a], [, b]) => b.zIndex - a.zIndex)
    .map(([key, window]) => ({ key, bounds: window.bounds }));

const useSystemStore = create(
  immer((set, get) => ({
    ...createInitialSystemState(),

    openMissionControl: () =>
      set((state) => {
        state.missionControl = { layout: missionControlLayout(visibleWindowEntries(), getViewport()) };
      }),

    closeMissionControl: () =>
      set((state) => {
        state.missionControl = null;
      }),

    toggleMissionControl: () => {
      if (get().missionControl) get().closeMissionControl();
      else get().openMissionControl();
    },

    // Switching apps (e.g. from the app switcher) leaves Mission Control first:
    // its layout is a snapshot and would go stale under the switched-to window.
    switchToApp: (key) => {
      if (get().missionControl) get().closeMissionControl();

      const { windows, focusWindow, restoreWindow } = useWindowStore.getState();

      if (windows[key]?.isMinimized) restoreWindow(key);
      else focusWindow(key);
    },
  }))
);

export default useSystemStore;
