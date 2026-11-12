import { useRef } from 'react';

import { homeBarGesture } from '../lib/gestures';
import { useGesture } from './useGesture';

// The Home indicator: tap or short swipe up goes home, a long press or a
// swipe up and hold opens the app switcher. Its touch area is the full width
// and sits above the bottom safe area (the very bottom edge belongs to iOS).
const HomeBar = ({ onHome, onSwitcher }) => {
    const barRef = useRef(null);

    useGesture(barRef, {
        onEnd: (sample) => {
            const gesture = homeBarGesture(sample, window.innerHeight);
            if (gesture === 'home') onHome();
            else if (gesture === 'switcher') onSwitcher();
        },
    });

    return (
        <button
            ref={barRef}
            type="button"
            className="phone-home-bar"
            aria-label="Home"
            // Pointer input is handled by the gesture; this is the keyboard path.
            onClick={(event) => { if (event.detail === 0) onHome(); }}
        >
            <span className="phone-home-indicator" />
        </button>
    );
};

export default HomeBar;
