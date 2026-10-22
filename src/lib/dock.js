// What a dock icon click should do, given that app's window state
// (undefined when the app has no window, e.g. Archive).
export const getDockAction = (windowState) => {
    if (!windowState) return 'none';
    if (!windowState.isOpen) return 'open';
    return windowState.isMinimized ? 'restore' : 'focus';
};
