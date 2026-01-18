import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Tooltip } from 'react-tooltip';

import { dockApps } from '../constants';
import useWindowStore from '../store/window';

const Dock = () => {
    const dockRef = useRef(null);
    const { windows, openWindow, closeWindow } = useWindowStore();

    useEffect(() => {
        const dock = dockRef.current;
        if (!dock) return;

        const icons = dock.querySelectorAll('.dock-icon');

        const handleMouseEnter = (e) => {
            gsap.to(e.currentTarget, {
                scale: 1.4,
                y: -12,
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

    const toggleApp = (app) => {
        if (!app.canOpen) return;

        const window = windows[app.id];

        if (!window) return;

        if (window.isOpen) {
            closeWindow(app.id);
        } else {
            openWindow(app.id);
        }
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
                            onClick={() => toggleApp(app)}
                        >
                            <img
                                src={`/images/${app.icon}`}
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