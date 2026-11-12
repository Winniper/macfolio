import { useRef, useState } from 'react';
import gsap from 'gsap';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { getApp, phoneRegistry } from '../constants/apps';
import { prefersReducedMotion } from '../lib/boot';
import { swipeDirection } from '../lib/gestures';
import { recentApps } from '../lib/phone';
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';
import { useGesture } from './useGesture';
import { useSheetMotion, useSheetMount } from './useSheet';

const FLY_SECONDS = 0.25;
const SPRING_SECONDS = 0.35;

// One open app: tap the card to open it, drag it up (or press its close
// button) to close it. The card is a button and the close button its sibling.
const SwitcherCard = ({ id, onClose }) => {
    // An app opened on the desktop before resizing has no phone placement.
    const app = phoneRegistry.find((entry) => entry.id === id) ?? getApp(id);
    const title = app?.title ?? id;
    const icon = app?.icon ?? '/images/about.svg';
    const switchToApp = useSystemStore((state) => state.switchToApp);
    const cardRef = useRef(null);

    // Vertical movement only: a horizontal drag is the row's own scroll, which
    // the browser takes over (and cancels this gesture).
    useGesture(cardRef, {
        onMove: ({ dx, dy }) => {
            if (dy < 0 && -dy > Math.abs(dx)) gsap.set(cardRef.current, { y: dy, opacity: 1 + dy / 600 });
        },
        onEnd: (sample) => {
            const card = cardRef.current;
            if (sample.dy < 0 && swipeDirection(sample) === 'up') {
                gsap.to(card, {
                    ...(prefersReducedMotion() ? {} : { y: -window.innerHeight * 0.6 }),
                    opacity: 0,
                    duration: prefersReducedMotion() ? 0.15 : FLY_SECONDS,
                    ease: 'power2.in',
                    onComplete: onClose,
                });
            } else {
                gsap.to(card, { y: 0, opacity: 1, duration: SPRING_SECONDS, ease: 'back.out(1.6)' });
            }
        },
        onCancel: () => gsap.to(cardRef.current, { y: 0, opacity: 1, duration: SPRING_SECONDS, ease: 'back.out(1.6)' }),
    });

    return (
        <li ref={cardRef} className="phone-switcher-card">
            <button type="button" className="phone-switcher-open" onClick={() => switchToApp(id)}>
                <span className="phone-switcher-head">
                    <img src={icon} alt="" draggable="false" />
                    <span>{title}</span>
                </span>
                <span className="phone-switcher-preview">
                    <img src={icon} alt="" draggable="false" />
                </span>
            </button>
            <button type="button" className="phone-switcher-close" aria-label={`Close ${title}`} onClick={onClose}>
                <X size={14} aria-hidden="true" />
            </button>
        </li>
    );
};

// Mounts only while shown (see useSheetMount); the cards are the open apps.
const SwitcherLayer = ({ onClosed, returnFocus }) => {
    const open = useSystemStore((state) => Boolean(state.missionControl));
    const closeMissionControl = useSystemStore((state) => state.closeMissionControl);
    const closeWindow = useWindowStore((state) => state.closeWindow);
    const ids = useWindowStore(useShallow(recentApps));
    const layerRef = useRef(null);
    const backdropRef = useRef(null);
    const trackRef = useRef(null);
    // Only a switcher that opened with nothing to show says so; closing the
    // last card fades the layer out without flashing the message.
    const [openedEmpty] = useState(ids.length === 0);

    useSheetMotion({
        open, close: closeMissionControl, sheetRef: trackRef, backdropRef, focusRef: layerRef, onClosed, returnFocus, slide: false,
    });

    const closeApp = (id) => {
        closeWindow(id);
        if (ids.length <= 1) closeMissionControl();
    };

    // A tap on the empty space around the cards (or anywhere, with none) returns.
    const handleBackgroundClick = (event) => {
        if (ids.length === 0 || event.target === event.currentTarget) closeMissionControl();
    };

    return (
        <div ref={layerRef} className="phone-switcher" data-closing={!open} role="dialog" aria-label="App Switcher" tabIndex={-1} onClick={handleBackgroundClick}>
            <div ref={backdropRef} className="phone-switcher-backdrop" />
            {openedEmpty && <p className="phone-switcher-empty">No Recent Apps</p>}
            <ul ref={trackRef} className="phone-switcher-track" onClick={handleBackgroundClick}>
                {ids.map((id) => <SwitcherCard key={id} id={id} onClose={() => closeApp(id)} />)}
            </ul>
        </div>
    );
};

const PhoneSwitcher = () => {
    const { render, onClosed, returnFocus } = useSheetMount('missionControl');

    return render ? <SwitcherLayer onClosed={onClosed} returnFocus={returnFocus} /> : null;
};

export default PhoneSwitcher;
