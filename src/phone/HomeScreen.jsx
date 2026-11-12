import { useRef } from 'react';
import { Search } from 'lucide-react';

import { profile } from '../constants';
import { phoneDockApps, phoneGridApps } from '../constants/apps';
import { toRect } from '../lib/bounds';
import { pullDownTarget, swipeDirection } from '../lib/gestures';
import { initialsOf } from '../lib/profile';
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';
import { useGesture } from './useGesture';

// One app icon. It opens from its own rect, which the open animation grows from.
const AppIcon = ({ app }) => {
    const openWindow = useWindowStore((state) => state.openWindow);
    const iconRef = useRef(null);

    return (
        <button
            type="button"
            className="phone-app-icon"
            data-phone-app={app.id}
            onClick={() => openWindow(app.id, null, toRect(iconRef.current.getBoundingClientRect()))}
        >
            <img ref={iconRef} src={app.icon} alt="" draggable="false" />
            <span>{app.name}</span>
        </button>
    );
};

// Intro card, app grid, search pill and dock over the wallpaper. A swipe down
// that starts outside a button opens Spotlight (or Control Center from the
// top-right corner).
const HomeScreen = ({ inert }) => {
    const openWindow = useWindowStore((state) => state.openWindow);
    const openSpotlight = useSystemStore((state) => state.openSpotlight);
    const openControlCenter = useSystemStore((state) => state.openControlCenter);
    const rootRef = useRef(null);
    const startedOnButton = useRef(false);

    useGesture(rootRef, {
        onEnd: (sample) => {
            if (startedOnButton.current || swipeDirection(sample) !== 'down') return;
            if (pullDownTarget(sample, window.innerWidth) === 'controlCenter') openControlCenter();
            else openSpotlight();
        },
    });

    return (
        <div
            ref={rootRef}
            className="phone-home"
            inert={inert}
            onPointerDownCapture={(event) => {
                startedOnButton.current = Boolean(event.target.closest('button'));
            }}
        >
            <section className="phone-intro" aria-label="Introduction">
                <div className="phone-intro-head">
                    <div className="phone-intro-avatar" aria-hidden="true">
                        {profile.avatar ? <img src={profile.avatar} alt="" /> : initialsOf(profile.name)}
                    </div>
                    <div className="phone-intro-text">
                        <h1>{profile.name}</h1>
                        <p>Hey, I&apos;m Debaditya! Welcome to my portfolio.</p>
                    </div>
                </div>
                <div className="phone-intro-actions">
                    <button type="button" className="is-primary" onClick={() => openWindow('resume')}>Resume</button>
                    <button type="button" onClick={() => openWindow('contact')}>Contact</button>
                </div>
            </section>

            <div className="phone-app-grid">
                {phoneGridApps.map((app) => <AppIcon key={app.id} app={app} />)}
            </div>

            <div className="phone-home-spacer" />

            <button type="button" className="phone-search-pill" aria-label="Search" onClick={openSpotlight}>
                <Search size={14} strokeWidth={2.6} aria-hidden="true" />
                <span>Search</span>
            </button>

            <div className="phone-dock">
                {phoneDockApps.map((app) => <AppIcon key={app.id} app={app} />)}
            </div>
        </div>
    );
};

export default HomeScreen;
