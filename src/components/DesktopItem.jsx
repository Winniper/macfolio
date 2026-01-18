import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';

import useWindowStore from '../store/window';

gsap.registerPlugin(Draggable);

const DesktopItem = ({ item, style }) => {
    const itemRef = useRef(null);
    const { openWindow } = useWindowStore();

    useEffect(() => {
        const element = itemRef.current;

        if (!element) return;

        const draggableInstance = Draggable.create(element, {
            type: 'x,y',
            inertia: true,
        });

        return () => {
            if (draggableInstance[0]) {
                draggableInstance[0].kill();
            }
        };
    }, []);

    const handleDoubleClick = () => {
        openWindow(item.id);
    };

    return (
        <div
            ref={itemRef}
            className="absolute flex w-24 flex-col items-center justify-center gap-1 p-2 cursor-pointer hover:bg-white/20 rounded-md transition-colors select-none"
            style={style}
            onClick={handleDoubleClick}
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
