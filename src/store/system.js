import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getViewport } from '../lib/bounds';
import { initialBootPhase, isSmallScreen, markBootSeen, readBootSeen } from '../lib/boot';
import { missionControlLayout } from '../lib/missionControl';
import useWindowStore from './window';

// OS-level state that isn't about a single window: boot phase and Mission
// Control now; Spotlight, Control Center and audio in later phases.
export const createInitialSystemState = () => ({
  bootPhase: initialBootPhase({ bootSeen: readBootSeen(), smallScreen: isSmallScreen() }),
  missionControl: null,
});

// Desktop shortcuts (switcher, Mission Control, hot corner) only apply here.
export const isDesktopPhase = (state) => state.bootPhase === 'desktop';

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

    finishBoot: () =>
      set((state) => {
        if (state.bootPhase === 'booting') state.bootPhase = 'locked';
      }),

    unlock: () => {
      if (get().bootPhase !== 'locked') return;

      markBootSeen();
      set((state) => {
        state.bootPhase = 'desktop';
      });
    },

    // Open windows are untouched; Mission Control is left so the overlay
    // isn't covering a stale grid when the desktop comes back.
    lock: () =>
      set((state) => {
        state.missionControl = null;
        state.bootPhase = 'locked';
      }),

    restart: () =>
      set((state) => {
        state.missionControl = null;
        state.bootPhase = 'booting';
      }),
  }))
);

export default useSystemStore;
