// Phone-view state derived from the window store.

// The app in front: the focused window, if it is on screen.
export const foregroundApp = (windowState) => {
    const window = windowState.windows[windowState.focusedId];

    return window?.isOpen && !window.isMinimized ? windowState.focusedId : null;
};

// Every open app, minimized or not, most recently raised first.
export const recentApps = (windowState) =>
    Object.entries(windowState.windows)
        .filter(([, window]) => window.isOpen)
        .sort(([, a], [, b]) => b.zIndex - a.zIndex)
        .map(([id]) => id);

// Spotlight on the phone: no Mission Control, and projects live in "Projects".
export const phoneSpotlightEntries = (entries) =>
    entries
        .filter((entry) => entry.action?.type !== 'missionControl')
        .map((entry) => (entry.subtitle === 'Show in Finder' ? { ...entry, subtitle: 'Show in Projects' } : entry));
