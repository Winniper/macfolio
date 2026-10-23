// Which system sound to play when the stores change, from two snapshots.

export const soundSnapshot = (windowState, systemState) => ({
    bootPhase: systemState.bootPhase,
    spotlightOpen: systemState.spotlightOpen,
    notificationIds: systemState.notifications.map((notification) => notification.id),
    minimized: windowState.minimizedStack,
    visible: Object.keys(windowState.windows)
        .filter((id) => windowState.windows[id].isOpen && !windowState.windows[id].isMinimized),
});

export const soundCues = (previous, next) => {
    const cues = [];

    if (previous.bootPhase === 'locked' && next.bootPhase === 'desktop') cues.push('startup');
    if (next.minimized.some((id) => !previous.minimized.includes(id))) cues.push('minimize');
    // Leaving the dock counts as a restore only if the window is back on screen
    // (closing a minimized window also takes it off the dock).
    if (previous.minimized.some((id) => !next.minimized.includes(id) && next.visible.includes(id))) cues.push('restore');
    if (next.notificationIds.some((id) => !previous.notificationIds.includes(id))) cues.push('notification');
    if (!previous.spotlightOpen && next.spotlightOpen) cues.push('spotlight');

    return cues;
};
