import { useLayoutEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';

import { getApp } from '../constants/apps';
import { resizeBounds } from '../lib/bounds';
import useWindowStore from '../store/window';

const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const INTERACTIVE = 'button, a, input, textarea, select';

// While a window is dragged or resized, iframes would otherwise swallow the
// pointer and the gesture "sticks" (see .window-interacting in index.css).
const setInteracting = (active) => document.body.classList.toggle('window-interacting', active);

const WindowWrapper = (WrappedComponent, windowKey) => {
    const app = getApp(windowKey);

    if (!app) {
        throw new Error(`WindowWrapper: "${windowKey}" is not in the app registry (src/constants/apps.js)`);
    }

    const Wrapped = (props) => {
        const windowRef = useRef(null);
        const dragRef = useRef(null);
        const wasVisibleRef = useRef(false);

        const windowState = useWindowStore((state) => state.windows[windowKey]);
        const focusWindow = useWindowStore((state) => state.focusWindow);
        const setBounds = useWindowStore((state) => state.setBounds);
        const toggleMaximize = useWindowStore((state) => state.toggleMaximize);

        const { isOpen, isMinimized, isMaximized, zIndex, bounds } = windowState;
        const isVisible = isOpen && !isMinimized;

        // Show / hide. Task 4 replaces this with the full animation set.
        useLayoutEffect(() => {
            const element = windowRef.current;
            const wasVisible = wasVisibleRef.current;
            wasVisibleRef.current = isVisible;

            if (!element || isVisible === wasVisible) return;

            if (isVisible) {
                element.style.display = 'flex';
                gsap.fromTo(
                    element,
                    { scale: 0.8, opacity: 0, y: 40 },
                    { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
                );
            } else {
                element.style.display = 'none';
            }
        }, [isVisible]);

        // Keep Draggable in sync with store-driven geometry; no dragging while zoomed.
        useLayoutEffect(() => {
            const drag = dragRef.current;

            if (!drag) return;

            drag.update();

            if (isMaximized) drag.disable();
            else drag.enable();
        }, [bounds, isMaximized]);

        useGSAP(() => {
            const element = windowRef.current;

            if (!element) return;

            const titlebar = element.querySelector('[data-titlebar]');

            const [dragInstance] = Draggable.create(element, {
                type: 'top,left',
                trigger: titlebar ?? element,
                onDragStart: () => setInteracting(true),
                onDragEnd() {
                    setInteracting(false);

                    const current = useWindowStore.getState().windows[windowKey].bounds;
                    setBounds(windowKey, { ...current, x: this.x, y: this.y });
                },
            });

            dragRef.current = dragInstance;

            const handleDoubleClick = (event) => {
                if (event.target.closest(INTERACTIVE)) return;
                toggleMaximize(windowKey);
            };

            titlebar?.addEventListener('dblclick', handleDoubleClick);

            return () => {
                titlebar?.removeEventListener('dblclick', handleDoubleClick);
                dragInstance.kill();
                dragRef.current = null;
            };
        }, []);

        const startResize = (edge) => (event) => {
            if (event.button !== 0) return;

            event.preventDefault();
            event.stopPropagation();

            const handle = event.currentTarget;
            const start = useWindowStore.getState().windows[windowKey].bounds;
            const origin = { x: event.clientX, y: event.clientY };

            const handleMove = (moveEvent) => {
                setBounds(
                    windowKey,
                    resizeBounds(start, edge, moveEvent.clientX - origin.x, moveEvent.clientY - origin.y, app.minSize)
                );
            };

            const handleUp = () => {
                setInteracting(false);
                handle.removeEventListener('pointermove', handleMove);
                handle.removeEventListener('pointerup', handleUp);
                handle.removeEventListener('pointercancel', handleUp);
            };

            handle.setPointerCapture(event.pointerId);
            handle.addEventListener('pointermove', handleMove);
            handle.addEventListener('pointerup', handleUp);
            handle.addEventListener('pointercancel', handleUp);

            setInteracting(true);
            focusWindow(windowKey);
        };

        return (
            <section
                id={windowKey}
                ref={windowRef}
                className="absolute hidden flex-col"
                style={{
                    zIndex,
                    left: bounds?.x,
                    top: bounds?.y,
                    width: bounds?.w,
                    height: bounds?.h,
                }}
                onPointerDown={() => focusWindow(windowKey)}
            >
                <WrappedComponent {...props} />

                {!isMaximized && RESIZE_EDGES.map((edge) => (
                    <div
                        key={edge}
                        className={`window-resize window-resize-${edge}`}
                        onPointerDown={startResize(edge)}
                    />
                ))}
            </section>
        );
    };

    Wrapped.displayName = `WindowWrapper(${WrappedComponent.displayName || WrappedComponent.name || 'Component'
        })`;

    return Wrapped;
};

export default WindowWrapper;
