import { useRef } from 'react';
import dayjs from 'dayjs';

import useClock from '../hooks/useClock';
import { TAP_SLOP, swipeDirection } from '../lib/gestures';
import useSystemStore from '../store/system';
import { useGesture } from './useGesture';

// Signal, Wi-Fi and battery, drawn like iOS's. Decorative.
export const StatusGlyphs = () => (
    <span className="phone-status-glyphs" aria-hidden="true">
        <svg viewBox="0 0 18 12" width="18" height="12">
            <rect x="0" y="8" width="3" height="4" rx="1" />
            <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
            <rect x="10" y="3" width="3" height="9" rx="1" />
            <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" width="16" height="12">
            <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Z" />
            <path d="M8 5.6c1.4 0 2.6.5 3.6 1.4l1.2-1.3A7.1 7.1 0 0 0 8 3.8c-1.8 0-3.5.7-4.8 1.9L4.4 7c1-.9 2.2-1.4 3.6-1.4Z" />
            <path d="M8 9c.5 0 1 .2 1.3.5L8 11.6 6.7 9.5C7 9.2 7.5 9 8 9Z" />
        </svg>
        <svg viewBox="0 0 27 13" width="27" height="13">
            <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" strokeOpacity="0.4" />
            <rect x="2" y="2" width="17" height="9" rx="2.5" />
            <path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fillOpacity="0.4" />
        </svg>
    </span>
);

// Clock on the left; the right third opens Control Center (tap, or swipe down).
const StatusBar = () => {
    const now = useClock();
    const toggleControlCenter = useSystemStore((state) => state.toggleControlCenter);
    const openControlCenter = useSystemStore((state) => state.openControlCenter);
    const controlRef = useRef(null);

    // Pointer taps and swipes come through the gesture; a keyboard press
    // (click with detail 0) through onClick, so a tap never counts twice.
    useGesture(controlRef, {
        onEnd: (sample) => {
            if (Math.abs(sample.dx) <= TAP_SLOP && Math.abs(sample.dy) <= TAP_SLOP) toggleControlCenter();
            else if (swipeDirection(sample) === 'down') openControlCenter();
        },
    });

    return (
        <div className="phone-status-bar">
            <span className="phone-status-clock">{dayjs(now).format('h:mm')}</span>
            <button
                ref={controlRef}
                type="button"
                className="phone-status-control"
                aria-label="Control Center"
                onClick={(event) => { if (event.detail === 0) toggleControlCenter(); }}
            >
                <StatusGlyphs />
            </button>
        </div>
    );
};

export default StatusBar;
