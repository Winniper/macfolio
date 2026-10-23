import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getViewport } from '../lib/bounds';
import { initialBootPhase, isSmallScreen, markBootSeen, readBootSeen } from '../lib/boot';
import { missionControlLayout } from '../lib/missionControl';
import { HISTORY_LIMIT, addNotification, createNotification } from '../lib/notifications';
import useWindowStore from './window';
import { tracks } from '../constants';
import { adjacentTrackId, clampVolume, trackById } from '../lib/music';

// OS-level state that isn't about a single window: boot phase, Mission Control, Spotlight, Control Center (brightness, Focus), notifications and their history, the sound-effects switch, music playback and the desktop Clean Up counter.
export const createInitialSystemState = () => ({
  bootPhase: initialBootPhase({ bootSeen: readBootSeen(), smallScreen: isSmallScreen() }),
  missionControl: null,
  audio: { currentTrackId: null, isPlaying: false, volume: 0.6, position: 0, duration: 0, seekNonce: 0 },
  spotlightOpen: false,
  controlCenterOpen: false,
  brightness: 1,
  focusMode: false,
  notificationHistory: [],
  notifications: [],
  nextNotificationId: 1,
  // Phase 7's Control Center toggles this; on by default.
  soundEffects: true,
  desktopCleanups: 0,
});

// Desktop shortcuts (switcher, Mission Control, hot corner) only apply here.
export const isDesktopPhase = (state) => state.bootPhase === 'desktop';

const visibleWindowEntries = () =>
  Object.entries(useWindowStore.getState().windows)
    .filter(([, window]) => window.isOpen && !window.isMinimized && window.bounds)
    .sort(([, a], [, b]) => b.zIndex - a.zIndex)
    .map(([key, window]) => ({ key, bounds: window.bounds }));

// Starts `id` from the beginning; seekNonce tells AudioController to seek.
const loadTrack = (state, id, play) => {
  state.audio.currentTrackId = id;
  state.audio.isPlaying = play;
  state.audio.position = 0;
  state.audio.duration = 0;
  state.audio.seekNonce += 1;
};

const rewind = (state) => {
  state.audio.position = 0;
  state.audio.seekNonce += 1;
};

const useSystemStore = create(
  immer((set, get) => ({
    ...createInitialSystemState(),

    openMissionControl: () =>
      set((state) => {
        state.spotlightOpen = false;
        state.controlCenterOpen = false;
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
        state.controlCenterOpen = false;
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

    // Control Center, Spotlight and Mission Control never stack.
    openControlCenter: () =>
      set((state) => {
        if (state.bootPhase !== 'desktop') return;
        state.missionControl = null;
        state.spotlightOpen = false;
        state.controlCenterOpen = true;
      }),

    closeControlCenter: () =>
      set((state) => {
        state.controlCenterOpen = false;
      }),

    toggleControlCenter: () => {
      if (get().controlCenterOpen) get().closeControlCenter();
      else get().openControlCenter();
    },

    setBrightness: (level) =>
      set((state) => {
        state.brightness = Math.min(1, Math.max(0.3, Number(level) || 0));
      }),

    setFocusMode: (on) =>
      set((state) => {
        state.focusMode = Boolean(on);
      }),

    clearNotificationHistory: () =>
      set((state) => {
        state.notificationHistory = [];
      }),

    // Banners exist only on the desktop: a scripted one that fires while the
    // screen is locked is simply dropped. Focus hides the banner, but every
    // notification still lands in Control Center's history.
    notify: (input) => {
      const { bootPhase, nextNotificationId: id, focusMode } = get();

      if (bootPhase !== 'desktop' || typeof input?.title !== 'string' || !input.title.trim()) return null;

      const notification = createNotification(input, { id });
      set((state) => {
        state.nextNotificationId += 1;
        state.notificationHistory = addNotification(state.notificationHistory, notification, HISTORY_LIMIT);
        if (!focusMode) state.notifications = addNotification(state.notifications, notification);
      });
      return id;
    },

    dismissNotification: (id) =>
      set((state) => {
        state.notifications = state.notifications.filter((notification) => notification.id !== id);
      }),

    setSoundEffects: (on) =>
      set((state) => {
        state.soundEffects = Boolean(on);
      }),

    // Music. The store is the source of truth; AudioController mirrors it into
    // the single <audio> element. Lock/restart leave the music playing.
    playTrack: (id) =>
      set((state) => {
        if (trackById(tracks, id)) loadTrack(state, id, true);
      }),

    togglePlay: () =>
      set((state) => {
        if (!state.audio.currentTrackId) {
          if (tracks[0]) loadTrack(state, tracks[0].id, true);
          return;
        }
        state.audio.isPlaying = !state.audio.isPlaying;
      }),

    setPlaying: (playing) =>
      set((state) => {
        state.audio.isPlaying = Boolean(playing) && Boolean(state.audio.currentTrackId);
      }),

    // Next/previous keep play/pause, like Apple Music.
    nextTrack: () =>
      set((state) => {
        const { currentTrackId, isPlaying } = state.audio;
        if (!currentTrackId) return;

        const next = adjacentTrackId(tracks, currentTrackId, 1);
        if (next) {
          loadTrack(state, next, isPlaying);
        } else {
          state.audio.isPlaying = false;
          rewind(state);
        }
      }),

    previousTrack: () =>
      set((state) => {
        const { currentTrackId, position, isPlaying } = state.audio;
        if (!currentTrackId) return;

        const previous = position > 3 ? null : adjacentTrackId(tracks, currentTrackId, -1);
        if (previous) loadTrack(state, previous, isPlaying);
        else rewind(state);
      }),

    seekTo: (seconds) =>
      set((state) => {
        if (!state.audio.currentTrackId) return;
        const end = state.audio.duration || Infinity;
        state.audio.position = Math.min(end, Math.max(0, Number(seconds) || 0));
        state.audio.seekNonce += 1;
      }),

    // From the <audio> element: no seekNonce bump, so nothing echoes back.
    setAudioPosition: (seconds) =>
      set((state) => {
        state.audio.position = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      }),

    setAudioDuration: (seconds) =>
      set((state) => {
        state.audio.duration = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
      }),

    setVolume: (volume) =>
      set((state) => {
        state.audio.volume = clampVolume(volume);
      }),

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
        state.controlCenterOpen = false;
        state.notifications = [];
        state.bootPhase = 'locked';
      }),

    restart: () =>
      set((state) => {
        state.missionControl = null;
        state.spotlightOpen = false;
        state.controlCenterOpen = false;
        state.notifications = [];
        state.bootPhase = 'booting';
      }),
  }))
);

export default useSystemStore;
