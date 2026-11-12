import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import { getApp } from '../constants/apps';
import { prefersReducedMotion } from '../lib/boot';
import { swipeDirection } from '../lib/gestures';
import { runMenuAction } from '../lib/menuActions';
import { NOTIFICATION_LIFETIME } from '../lib/notifications';
import useSystemStore from '../store/system';
import { useGesture } from './useGesture';

const SLIDE_SECONDS = 0.35;
const LEAVE_SECONDS = 0.25;
const FADE_SECONDS = 0.15;

// One banner: drops in, leaves after NOTIFICATION_LIFETIME. The clock stops
// while a finger drags it and resumes with the time that was left.
const Banner = ({ notification }) => {
    const dismissNotification = useSystemStore((state) => state.dismissNotification);
    const bannerRef = useRef(null);
    const remaining = useRef(NOTIFICATION_LIFETIME);
    const startedAt = useRef(0);
    const timer = useRef(null);
    const { id } = notification;

    const leave = (onDone) => {
        const reduced = prefersReducedMotion();
        gsap.killTweensOf(bannerRef.current);
        gsap.to(bannerRef.current, {
            ...(reduced ? {} : { yPercent: -130 }),
            opacity: 0,
            duration: reduced ? FADE_SECONDS : LEAVE_SECONDS,
            ease: 'power2.in',
            onComplete: onDone,
        });
    };

    // Reads the id from the closure of the render that set the timer.
    const startClock = () => {
        window.clearTimeout(timer.current);
        startedAt.current = Date.now();
        timer.current = window.setTimeout(() => leave(() => dismissNotification(id)), remaining.current);
    };

    const stopClock = () => {
        if (!timer.current) return;
        window.clearTimeout(timer.current);
        timer.current = null;
        remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };

    useEffect(() => {
        const banner = bannerRef.current;
        const reduced = prefersReducedMotion();
        gsap.fromTo(
            banner,
            reduced ? { opacity: 0 } : { yPercent: -130, opacity: 1 },
            { yPercent: 0, opacity: 1, duration: reduced ? FADE_SECONDS : SLIDE_SECONDS, ease: 'power3.out' },
        );
        startClock();
        return () => {
            window.clearTimeout(timer.current);
            gsap.killTweensOf(banner);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per banner (keyed by id)
    }, []);

    const springBack = () => {
        gsap.to(bannerRef.current, { y: 0, yPercent: 0, duration: 0.3, ease: 'back.out(1.6)' });
        startClock();
    };

    useGesture(bannerRef, {
        onMove: ({ dy }) => {
            stopClock();
            gsap.killTweensOf(bannerRef.current);
            gsap.set(bannerRef.current, { y: Math.min(0, dy) });
        },
        onEnd: (sample) => {
            if (sample.dy < 0 && swipeDirection(sample) === 'up') leave(() => dismissNotification(id));
            else springBack();
        },
        onCancel: springBack,
    });

    const open = () => {
        dismissNotification(id);
        if (notification.action) runMenuAction(notification.action);
    };

    return (
        <div ref={bannerRef} className="phone-banner" role="status">
            <button type="button" className="phone-banner-open" onClick={open}>
                <img src={getApp(notification.appId)?.icon ?? '/images/about.svg'} alt="" draggable="false" />
                <span className="phone-banner-text">
                    <span className="phone-banner-head">
                        <span className="phone-banner-title">{notification.title}</span>
                        <span className="phone-banner-time">now</span>
                    </span>
                    {notification.body && <span className="phone-banner-body">{notification.body}</span>}
                </span>
            </button>
        </div>
    );
};

// Shows only the newest notification; a newer one replaces the current banner
// and the replaced ones are dropped (they stay in Control Center's history), so
// they cannot reappear when the newest leaves.
const PhoneBanner = () => {
    const notifications = useSystemStore((state) => state.notifications);
    const dismissNotification = useSystemStore((state) => state.dismissNotification);
    const newest = notifications[notifications.length - 1];

    useEffect(() => {
        notifications.slice(0, -1).forEach((older) => dismissNotification(older.id));
    }, [notifications, dismissNotification]);

    return newest ? <Banner key={newest.id} notification={newest} /> : null;
};

export default PhoneBanner;
