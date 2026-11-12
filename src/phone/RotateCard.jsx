import { RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';

import useMediaQuery from '../hooks/useMediaQuery';
import { PHONE_LANDSCAPE_QUERY } from '../lib/boot';

// The phone UI is portrait only; held sideways, this covers it (music plays on).
// It is portaled to <body> so it can sit above the lock screen and the boot
// overlay, which live outside #phone.
const RotateCard = () => {
    const landscape = useMediaQuery(PHONE_LANDSCAPE_QUERY);

    if (!landscape) return null;
    return createPortal(
        <div className="phone-rotate-card" role="alert">
            <RotateCcw size={44} strokeWidth={1.6} aria-hidden="true" />
            <p>Rotate your phone</p>
        </div>,
        document.body,
    );
};

export default RotateCard;
