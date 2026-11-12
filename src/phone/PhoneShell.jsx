import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { useShallow } from 'zustand/react/shallow';

import { phoneRegistry } from '../constants/apps';
import { prefersReducedMotion } from '../lib/boot';
import { foregroundApp, recentApps } from '../lib/phone';
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';
import AppScreen from './AppScreen';
import { PHONE_APPS } from './apps';
import HomeBar from './HomeBar';
import HomeScreen from './HomeScreen';
import RotateCard from './RotateCard';
import StatusBar from './StatusBar';

const OPEN_SECONDS = 0.35;
const CLOSE_SECONDS = 0.3;
const FADE_IN_SECONDS = 0.2;
const REDUCED_SECONDS = 0.15;
const APP_RADIUS = 44;

// An app section is laid out full screen; its icon's rect becomes a transform
// (position and scale from the top-left corner) so the tween never re-lays out.
const iconTransform = (section, rect) => {
    const screen = section.parentElement.getBoundingClientRect();

    return {
        x: rect.x - (screen.left + section.offsetLeft),
        y: rect.y - (screen.top + section.offsetTop),
        scaleX: rect.w / section.offsetWidth,
        scaleY: rect.h / section.offsetHeight,
    };
};

const FULL_SCREEN = { x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 0, opacity: 1 };

const animateOpen = (section, originRect) => {
    gsap.killTweensOf(section);
    gsap.set(section, { clearProps: 'transform,opacity,borderRadius,transformOrigin' });

    if (prefersReducedMotion()) {
        gsap.fromTo(section, { opacity: 0 }, { opacity: 1, duration: REDUCED_SECONDS, clearProps: 'opacity' });
    } else if (originRect) {
        gsap.fromTo(
            section,
            { ...iconTransform(section, originRect), borderRadius: APP_RADIUS, opacity: 0.4, transformOrigin: '0 0' },
            {
                ...FULL_SCREEN,
                duration: OPEN_SECONDS,
                ease: 'power3.out',
                clearProps: 'transform,opacity,borderRadius,transformOrigin',
            },
        );
    } else {
        gsap.fromTo(section, { opacity: 0 }, { opacity: 1, duration: FADE_IN_SECONDS, clearProps: 'opacity' });
    }
};

// Shrinks (or fades) the app section into its home screen icon, then calls done.
const animateClose = (section, icon, done) => {
    gsap.killTweensOf(section);

    if (prefersReducedMotion() || !icon) {
        gsap.to(section, { opacity: 0, duration: prefersReducedMotion() ? REDUCED_SECONDS : FADE_IN_SECONDS, onComplete: done });
        return;
    }

    const rect = icon.getBoundingClientRect();
    gsap.set(section, { transformOrigin: '0 0' });
    gsap.to(section, {
        ...iconTransform(section, { x: rect.x, y: rect.y, w: rect.width, h: rect.height }),
        borderRadius: APP_RADIUS,
        opacity: 0,
        duration: CLOSE_SECONDS,
        ease: 'power2.in',
        onComplete: done,
    });
};

// Stands in for an app whose screen has not been built yet.
const ComingSoon = ({ id }) => {
    const title = phoneRegistry.find((app) => app.id === id)?.title ?? id;

    return (
        <AppScreen title={title}>
            <p className="phone-empty">Coming soon</p>
        </AppScreen>
    );
};

// One open app. Hidden apps stay mounted (they keep their scroll position and
// state) but are invisible, inert and out of the accessibility tree.
const PhoneApp = ({ id, front }) => {
    const sectionRef = useRef(null);
    const Screen = PHONE_APPS[id];

    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (front) animateOpen(section, useWindowStore.getState().windows[id].originRect);
        return () => gsap.killTweensOf(section);
    }, [front, id]);

    return (
        <section
            ref={sectionRef}
            className="phone-app"
            data-app={id}
            data-front={front}
            inert={!front}
            aria-hidden={!front}
        >
            {Screen ? <Screen /> : <ComingSoon id={id} />}
        </section>
    );
};

// The phone UI: status bar, home screen, open apps and Home bar over the
// wallpaper. Sheets and banners mount in here too (later tasks).
const PhoneShell = () => {
    const foreground = useWindowStore(foregroundApp);
    const open = useWindowStore(useShallow(recentApps));
    const goHome = useSystemStore((state) => state.goHome);
    const openMissionControl = useSystemStore((state) => state.openMissionControl);
    const rootRef = useRef(null);
    const closing = useRef(false);

    // The page itself must never scroll or bounce under a gesture.
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add('phone-mode');
        return () => root.classList.remove('phone-mode');
    }, []);

    // Home: the front app shrinks into its icon first. A second press while
    // that runs does nothing.
    const onHome = () => {
        if (closing.current) return;
        const id = useWindowStore.getState().focusedId;
        const section = foreground && rootRef.current.querySelector(`.phone-app[data-app="${id}"]`);

        if (!section) {
            goHome();
            return;
        }

        closing.current = true;
        // The icon picture, not its label, is what the app shrinks into.
        const icon = rootRef.current.querySelector(`[data-phone-app="${id}"] img`);
        animateClose(section, icon, () => {
            closing.current = false;
            goHome();
        });
    };

    return (
        <div id="phone" ref={rootRef}>
            <HomeScreen inert={foreground !== null} />
            {open.map((id) => <PhoneApp key={id} id={id} front={id === foreground} />)}
            <StatusBar />
            <HomeBar onHome={onHome} onSwitcher={openMissionControl} />
            <RotateCard />
        </div>
    );
};

export default PhoneShell;
