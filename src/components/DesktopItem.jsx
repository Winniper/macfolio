import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';

import useWindowStore from '../store/window';
import useSystemStore from '../store/system';
import { toRect } from '../lib/bounds';

gsap.registerPlugin(Draggable);

const DesktopItem = ({ item, style }) => {
    const itemRef = useRef(null);
    const dragRef = useRef(null);
    const cleanupTween = useRef(null);
    const { openWindow } = useWindowStore();
    const cleanups = useSystemStore((state) => state.desktopCleanups);

    useEffect(() => {
        const element = itemRef.current;

        if (!element) return;

        const draggableInstance = Draggable.create(element, {
            type: 'x,y',
            inertia: true,
        });

        dragRef.current = draggableInstance[0];

        return () => {
            dragRef.current = null;
            if (draggableInstance[0]) {
                draggableInstance[0].kill();
            }
        };
    }, []);

    // Desktop → Clean Up: slide back to the default spot.
    useEffect(() => {
        const element = itemRef.current;

        if (cleanups === 0 || !element) return;

        cleanupTween.current?.kill();
        cleanupTween.current = gsap.to(element, {
            x: 0,
            y: 0,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => dragRef.current?.update(),
        });

        return () => cleanupTween.current?.kill();
    }, [cleanups]);

    const handleOpen = (event) => {
        openWindow(item.id, null, toRect(event.currentTarget.getBoundingClientRect()));
    };

    return (
        <div
            ref={itemRef}
            className="absolute flex w-24 flex-col items-center justify-center gap-1 p-2 cursor-pointer hover:bg-white/20 rounded-md transition-colors select-none"
            data-desktop-item={item.id}
            style={style}
            onClick={handleOpen}
        >
            <div className="flex h-14 w-14 items-center justify-center">
                <img src={item.icon} alt={item.title} className="w-12 h-12 object-contain" />
            </div>

            <span className="rounded px-1 py-0.5 text-center text-xs font-medium text-white text-shadow">
                {item.title}
            </span>
        </div>
    );
};

export default DesktopItem;
