// Platform-aware keyboard shortcuts. macOS reserves Ctrl+↑/F3 (Mission
// Control) and Cmd+Tab; Windows reserves Alt+Tab — so each shortcut is only
// claimed where the visitor's OS leaves it free.

export const isMacPlatform = (platform) => /mac/i.test(platform);

export const getPlatform = () =>
    globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || '';

export const isMissionControlKey = (event, isMac) =>
    !isMac && event.ctrlKey && event.key === 'ArrowUp';

// The held modifier that starts the app switcher, or null: Option+Tab on
// macOS (Windows reserves Alt+Tab), Ctrl+` everywhere.
export const switcherModifier = (event, isMac) => {
    if (isMac && event.altKey && event.key === 'Tab') return 'Alt';
    if (event.ctrlKey && event.code === 'Backquote') return 'Control';
    return null;
};
