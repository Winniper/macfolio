import { RotateCcw } from 'lucide-react';

import useMediaQuery from '../hooks/useMediaQuery';
import { PHONE_LANDSCAPE_QUERY } from '../lib/boot';

// The phone UI is portrait only; held sideways, this covers it (music plays on).
const RotateCard = () => {
    const landscape = useMediaQuery(PHONE_LANDSCAPE_QUERY);

    if (!landscape) return null;
    return (
        <div className="phone-rotate-card" role="alert">
            <RotateCcw size={44} strokeWidth={1.6} aria-hidden="true" />
            <p>Rotate your phone</p>
        </div>
    );
};

export default RotateCard;
