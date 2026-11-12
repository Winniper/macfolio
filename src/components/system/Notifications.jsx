import { useCallback, useEffect, useRef, useState } from 'react';

import { getApp } from '../../constants/apps';
import { runMenuAction } from '../../lib/menuActions';
import { NOTIFICATION_LIFETIME } from '../../lib/notifications';
import useSystemStore from '../../store/system';

// One banner: leaves after NOTIFICATION_LIFETIME; hovering pauses the clock and
// leaving resumes it with the time that was left.
const NotificationBanner = ({ notification }) => {
    const dismissNotification = useSystemStore((state) => state.dismissNotification);
    const [leaving, setLeaving] = useState(false);
    const remaining = useRef(NOTIFICATION_LIFETIME);
    const startedAt = useRef(0);
    const timer = useRef(null);

    const resume = useCallback(() => {
        window.clearTimeout(timer.current);
        startedAt.current = Date.now();
        timer.current = window.setTimeout(() => setLeaving(true), remaining.current);
    }, []);

    const pause = () => {
        window.clearTimeout(timer.current);
        remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };

    useEffect(() => {
        resume();
        return () => window.clearTimeout(timer.current);
    }, [resume]);

    const dismiss = () => dismissNotification(notification.id);

    const open = () => {
        dismiss();
        if (notification.action) runMenuAction(notification.action);
    };

    const icon = getApp(notification.appId)?.icon ?? '/images/about.svg';

    return (
        <div
            className={`notification${leaving ? ' is-leaving' : ''}`}
            role="status"
            onPointerEnter={() => { if (!leaving) pause(); }}
            onPointerLeave={() => { if (!leaving) resume(); }}
            onFocus={() => { if (!leaving) pause(); }}
            onBlur={() => { if (!leaving) resume(); }}
            // The slide-in also ends with animationend; only the slide-out removes it.
            onAnimationEnd={() => { if (leaving) dismiss(); }}
        >
            <button type="button" className="notification-open" onClick={open}>
                <img src={icon} alt="" />
                <span className="notification-text">
                    <span className="notification-head">
                        <span className="notification-title">{notification.title}</span>
                        <span className="notification-time">now</span>
                    </span>
                    {notification.body && <span className="notification-body">{notification.body}</span>}
                </span>
            </button>
            <button type="button" className="notification-close" aria-label="Dismiss notification" onClick={dismiss}>
                ×
            </button>
        </div>
    );
};

// Stacked top-right, newest on top.
const Notifications = () => {
    const notifications = useSystemStore((state) => state.notifications);

    return (
        <div className="notifications" aria-live="polite">
            {[...notifications].reverse().map((notification) => (
                <NotificationBanner key={notification.id} notification={notification} />
            ))}
        </div>
    );
};

export default Notifications;
