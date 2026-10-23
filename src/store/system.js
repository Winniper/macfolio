import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getViewport } from '../lib/bounds';
import { initialBootPhase, isSmallScreen, markBootSeen, readBootSeen } from '../lib/boot';
import { missionControlLayout } from '../lib/missionControl';
import useWindowStore from './window';

// OS-level state that isn't about a single window: boot phase, Mission Control, Spotlight and the desktop Clean Up counter; Control Center and audio in later phases.
export const createInitialSystemState = () => ({
  bootPhase: initialBootPhase({ bootSeen: readBootSeen(), smallScreen: isSmallScreen() }),
  missionControl: null,
  spotlightOpen: false,
  desktopCleanups: 0,
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
        state.spotlightOpen = false;
        state.missionControl = { layout: missionControlLayout(visibleWindowEntries(), getViewport()) };
      }),

    // Desktop icons animate back to their default spots whenever this bumps.
    cleanUpDesktop: () =>
      set((state) => {
        state.desktopCleanups += 1;
      }),

    closeMissionControl: () =>
      set((state) => {
        state.missionControl = null;
      }),

    toggleMissionControl: () => {
      if (get().missionControl) get().closeMissionControl();
      else get().openMissionControl();
    },

    // Spotlight and Mission Control never stack: each closes the other.
    openSpotlight: () =>
      set((state) => {
        if (state.bootPhase !== 'desktop') return;
        state.missionControl = null;
        state.spotlightOpen = true;
      }),

    closeSpotlight: () =>
      set((state) => {
        state.spotlightOpen = false;
      }),

    toggleSpotlight: () => {
      if (get().spotlightOpen) get().closeSpotlight();
      else get().openSpotlight();
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

    // Open windows are untouched; Mission Control is closed so the overlay
    // isn't covering a stale grid when the desktop comes back.
    lock: () =>
      set((state) => {
        state.missionControl = null;
        state.spotlightOpen = false;
        state.bootPhase = 'locked';
      }),

    restart: () =>
      set((state) => {
        state.missionControl = null;
        state.spotlightOpen = false;
        state.bootPhase = 'booting';
      }),
  }))
);

export default useSystemStore;
