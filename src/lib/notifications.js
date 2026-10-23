// Notification banners (macOS style). Pure helpers; the list itself lives in
// the system store and Notifications.jsx renders it.

export const NOTIFICATION_LIFETIME = 5000;
export const MAX_NOTIFICATIONS = 3;

export const createNotification = ({ appId, title, body = '', action = null }, { id }) => ({
    id,
    appId,
    title: title.trim(),
    body,
    action,
});

// Newest last; older banners fall off so the stack never grows off-screen.
export const addNotification = (list, notification, max = MAX_NOTIFICATIONS) =>
    [...list, notification].slice(-max);

// The welcome banners after unlock. `unlessOpened` skips a nudge toward an
// app the visitor has already found on their own.
export const scheduleWelcome = (entries, { setTimer, wasOpened, notify }) =>
    entries.map(({ delay, unlessOpened, ...notification }) => setTimer(() => {
        if (unlessOpened && wasOpened(unlessOpened)) return;
        notify(notification);
    }, delay));
