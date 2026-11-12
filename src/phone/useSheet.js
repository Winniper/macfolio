import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';

import { prefersReducedMotion } from '../lib/boot';
import useSystemStore from '../store/system';

const SLIDE_SECONDS = 0.3;
const FADE_SECONDS = 0.15;

// Keeps a sheet mounted through its closing animation. `field` is the system
// store flag that opens it. Returns whether to render, the callback the sheet
// calls when its close animation ends, and the element to refocus afterwards.
export function useSheetMount(field) {
    const open = useSystemStore((state) => Boolean(state[field]));
    const [mounted, setMounted] = useState(open);
    const handleClosed = useCallback(() => setMounted(false), []);
    const returnFocus = useRef(null);

    // Noted when the store flips, before React renders: once the sheet is in, the
    // page behind it is inert and has dropped focus.
    useEffect(() => useSystemStore.subscribe((state, previous) => {
        if (!state[field] || previous[field]) return;
        returnFocus.current = document.activeElement;
        setMounted(true);
    }), [field]);

    return { render: open || mounted, onClosed: handleClosed, returnFocus };
}

// Slides (or fades) a sheet and its backdrop in and takes focus; slides out when
// `open` turns false, then restores focus and calls onClosed. Escape closes it
// wherever focus is (but not while an IME composition is active). While it
// closes the sheet root is `data-closing` (no taps). `slide: false` fades the
// sheet instead of sliding it (the app switcher).
export function useSheetMotion({ open, close, sheetRef, backdropRef, focusRef, onClosed, returnFocus, slide = true }) {
    useLayoutEffect(() => {
        const sheet = sheetRef.current;
        const backdrop = backdropRef.current;
        const reduced = prefersReducedMotion() || !slide;
        gsap.killTweensOf([sheet, backdrop]);

        if (open) {
            gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: FADE_SECONDS });
            gsap.fromTo(
                sheet,
                reduced ? { opacity: 0 } : { yPercent: -100 },
                { opacity: 1, yPercent: 0, duration: reduced ? FADE_SECONDS : SLIDE_SECONDS, ease: 'power3.out' },
            );
            focusRef.current?.focus({ preventScroll: true });
            return undefined;
        }

        gsap.to(backdrop, { opacity: 0, duration: FADE_SECONDS });
        gsap.to(sheet, {
            ...(reduced ? { opacity: 0 } : { yPercent: -100 }),
            duration: reduced ? FADE_SECONDS : SLIDE_SECONDS,
            ease: 'power2.in',
            onComplete: () => {
                const target = returnFocus.current;
                if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
                onClosed();
            },
        });
        return () => gsap.killTweensOf([sheet, backdrop]);
    }, [open, onClosed, returnFocus, sheetRef, backdropRef, focusRef, slide]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event) => {
            if (event.key !== 'Escape' || event.isComposing) return;
            event.preventDefault();
            close();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, close]);
}
