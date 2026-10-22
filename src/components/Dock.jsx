import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Tooltip } from 'react-tooltip';

import { dockApps } from '../constants';
import useWindowStore from '../store/window';
import { getDockAction } from '../lib/dock';

const Dock = () => {
    const dockRef = useRef(null);
    const { windows, openWindow, focusWindow } = useWindowStore();

    useEffect(() => {
        const dock = dockRef.current;
        if (!dock) return;

        const icons = dock.querySelectorAll('.dock-icon');

        const handleMouseEnter = (e) => {
            gsap.to(e.currentTarget, {
                scale: 1.2,
                y: -8,
                duration: 0.2,
                ease: 'power1.out',
            });
        };

        const handleMouseLeave = (e) => {
            gsap.to(e.currentTarget, {
                scale: 1,
                y: 0,
                duration: 0.3,
                ease: 'power1.out',
            });
        };

        icons.forEach((icon) => {
            icon.addEventListener('mouseenter', handleMouseEnter);
            icon.addEventListener('mouseleave', handleMouseLeave);
        });

        return () => {
            icons.forEach((icon) => {
                icon.removeEventListener('mouseenter', handleMouseEnter);
                icon.removeEventListener('mouseleave', handleMouseLeave);
            });
        };
    }, []);

    const handleAppClick = (app) => {
        const action = getDockAction(app.canOpen ? windows[app.id] : undefined);

        if (action === 'open') openWindow(app.id);
        if (action === 'focus') focusWindow(app.id);
    };

    return (
        <section id="dock">
            <div ref={dockRef} className="dock-container">
                {dockApps.map((app) => (
                    <div key={app.id} className="relative flex justify-center">
                        <button
                            type="button"
                            className="dock-icon"
                            aria-label={app.name}
                            data-tooltip-id="dock-tooltip"
                            data-tooltip-content={app.name}
                            disabled={!app.canOpen}
                            onClick={() => handleAppClick(app)}
                        >
                            <img
                                src={app.icon}
                                alt={app.name}
                                loading="lazy"
                                className={!app.canOpen ? 'opacity-60' : ''}
                            />
                        </button>
                    </div>
                ))}
            </div>

            <Tooltip
                id="dock-tooltip"
                place="top"
                className="tooltip"
                delayShow={150}
            />
        </section>
    );
};

export default Dock;