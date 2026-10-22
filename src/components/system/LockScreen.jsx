import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import dayjs from 'dayjs';

import { profile } from '../../constants';
import useClock from '../../hooks/useClock';
import { prefersReducedMotion } from '../../lib/boot';
import useSystemStore from '../../store/system';

const initials = (name) =>
    name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

const MODIFIER_KEYS = new Set(['Meta', 'Alt', 'Control', 'Shift']);

// Blurred desktop, clock, and the visitor's way in: any click or key slides
// the lock screen up and reveals the desktop.
const LockScreen = () => {
    const rootRef = useRef(null);
    const unlock = useSystemStore((state) => state.unlock);
    const bootPhase = useSystemStore((state) => state.bootPhase);
    const now = useClock();

    useEffect(() => {
        // Listen only once locked: the key/click that skips the boot must not
        // also dismiss the lock screen mounted beneath it.
        if (bootPhase !== 'locked') return;

        const root = rootRef.current;
        let leaving = false;

        const leave = (event) => {
            if (event.type === 'keydown' && (event.repeat || MODIFIER_KEYS.has(event.key))) return;
            if (leaving) return;
            leaving = true;

            gsap.to(root, prefersReducedMotion()
                ? { opacity: 0, duration: 0.3, onComplete: unlock }
                : { yPercent: -100, opacity: 0, duration: 0.6, ease: 'power3.inOut', onComplete: unlock });
        };

        window.addEventListener('keydown', leave);
        root.addEventListener('pointerdown', leave);

        return () => {
            window.removeEventListener('keydown', leave);
            root.removeEventListener('pointerdown', leave);
            gsap.killTweensOf(root);
        };
    }, [unlock, bootPhase]);

    return (
        <div ref={rootRef} className="lock-screen">
            <div className="lock-clock">
                <p className="lock-date">{dayjs(now).format('dddd, MMMM D')}</p>
                <p className="lock-time">{dayjs(now).format('h:mm')}</p>
            </div>

            <div className="lock-user">
                <div className="lock-avatar">
                    {profile.avatar
                        ? <img src={profile.avatar} alt="" />
                        : initials(profile.name)}
                </div>
                <p className="lock-name">{profile.name}</p>
                <p className="lock-hint">Click or press any key to enter</p>
            </div>
        </div>
    );
};

export default LockScreen;
