import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import dayjs from 'dayjs';

import { welcomeNotifications } from '../constants';
import { getApp } from '../constants/apps';
import useClock from '../hooks/useClock';
import { prefersReducedMotion } from '../lib/boot';
import { TAP_SLOP, swipeDirection } from '../lib/gestures';
import useSystemStore from '../store/system';
import { StatusGlyphs } from './StatusBar';
import { useGesture } from './useGesture';

const MODIFIER_KEYS = new Set(['Meta', 'Alt', 'Control', 'Shift']);
const message = welcomeNotifications[0];

// iPhone lock screen: date, big clock, one message, and a swipe up (or a tap,
// or any key) slides it away. Mounted under the boot overlay, so it reacts
// only once the boot has finished.
const PhoneLockScreen = () => {
    const rootRef = useRef(null);
    const leavingRef = useRef(false);
    const unlock = useSystemStore((state) => state.unlock);
    const bootPhase = useSystemStore((state) => state.bootPhase);
    const now = useClock();
    const locked = bootPhase === 'locked';

    const leave = useCallback(() => {
        if (leavingRef.current) return;
        leavingRef.current = true;

        gsap.to(rootRef.current, prefersReducedMotion()
            ? { opacity: 0, duration: 0.3, onComplete: unlock }
            : { y: -window.innerHeight, duration: 0.45, ease: 'power2.out', overwrite: true, onComplete: unlock });
    }, [unlock]);

    const springBack = () => {
        gsap.to(rootRef.current, { y: 0, duration: 0.5, ease: 'back.out(1.6)', overwrite: true });
    };

    useGesture(rootRef, {
        onMove: ({ dy }) => {
            if (!locked || leavingRef.current || prefersReducedMotion()) return;
            gsap.set(rootRef.current, { y: Math.min(0, dy) });
        },
        onEnd: (sample) => {
            if (!locked || leavingRef.current) return;
            const tap = Math.abs(sample.dx) <= TAP_SLOP && Math.abs(sample.dy) <= TAP_SLOP;
            if (tap || swipeDirection(sample) === 'up') leave();
            else springBack();
        },
        onCancel: () => {
            if (locked && !leavingRef.current) springBack();
        },
    });

    useEffect(() => {
        // The key that skips the boot must not also unlock.
        if (!locked) return undefined;

        const onKey = (event) => {
            if (event.repeat || MODIFIER_KEYS.has(event.key)) return;
            leave();
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [locked, leave]);

    useEffect(() => {
        const root = rootRef.current;
        return () => gsap.killTweensOf(root);
    }, []);

    return (
        <div ref={rootRef} className="phone-lock">
            <div className="phone-lock-status" aria-hidden="true">
                <StatusGlyphs />
            </div>

            <div className="phone-lock-clock">
                <p className="phone-lock-date">{dayjs(now).format('dddd, MMMM D')}</p>
                <p className="phone-lock-time">{dayjs(now).format('h:mm')}</p>
            </div>

            <div className="phone-lock-message">
                <img src={getApp(message.appId)?.icon ?? '/images/about.svg'} alt="" draggable="false" />
                <div className="phone-lock-message-text">
                    <p className="phone-lock-message-head">
                        <span>{message.title}</span>
                        <span className="phone-lock-message-time">now</span>
                    </p>
                    <p className="phone-lock-message-body">{message.body}</p>
                </div>
            </div>

            <p className="phone-lock-hint">Swipe up or tap to open</p>
            <span className="phone-lock-indicator" aria-hidden="true" />
        </div>
    );
};

export default PhoneLockScreen;
