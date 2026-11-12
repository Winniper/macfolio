import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';

import useMediaQuery from '../hooks/useMediaQuery';
import { PHONE_LANDSCAPE_QUERY } from '../lib/boot';

const FIELD = 'input, textarea, [contenteditable]:not([contenteditable="false"])';
const isTypingInField = () => Boolean(document.activeElement?.matches?.(FIELD));

// True while a text field has focus, so the keyboard shrinking the layout
// viewport on some browsers does not read as a rotation.
const useFieldFocus = () => {
    const [typing, setTyping] = useState(isTypingInField);

    useEffect(() => {
        const update = () => setTyping(isTypingInField());
        // focusout fires before the next element is focused: read it a tick later.
        const afterBlur = () => setTimeout(update, 0);
        document.addEventListener('focusin', update);
        document.addEventListener('focusout', afterBlur);
        return () => {
            document.removeEventListener('focusin', update);
            document.removeEventListener('focusout', afterBlur);
        };
    }, []);

    return typing;
};

// The phone UI is portrait only; held sideways, this covers it (music plays on).
// It is portaled to <body> so it can sit above the lock screen and the boot
// overlay, which live outside #phone.
const RotateCard = () => {
    const landscape = useMediaQuery(PHONE_LANDSCAPE_QUERY);
    const typing = useFieldFocus();

    if (!landscape || typing) return null;
    return createPortal(
        <div className="phone-rotate-card" role="alert">
            <RotateCcw size={44} strokeWidth={1.6} aria-hidden="true" />
            <p>Rotate your phone</p>
        </div>,
        document.body,
    );
};

export default RotateCard;
