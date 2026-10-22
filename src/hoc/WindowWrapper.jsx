import { useLayoutEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';

import { getApp } from '../constants/apps';
import { resizeBounds, toRect, transformToRect } from '../lib/bounds';
import useWindowStore from '../store/window';

const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const INTERACTIVE = 'button, a, input, textarea, select';

// While a window is dragged or resized, iframes would otherwise swallow the
// pointer and the gesture "sticks" (see .window-interacting in index.css).
const setInteracting = (active) => document.body.classList.toggle('window-interacting', active);

const hideWindow = (element) => {
    element.style.display = 'none';
    gsap.set(element, { clearProps: 'transform,opacity,transformOrigin' });
};

const minimizeTarget = (windowKey) => {
    const tile = document.querySelector(`[data-dock-minimized="${windowKey}"]`);
    return tile ? toRect(tile.getBoundingClientRect()) : null;
};

const WindowWrapper = (WrappedComponent, windowKey) => {
    const app = getApp(windowKey);

    if (!app) {
        throw new Error(`WindowWrapper: "${windowKey}" is not in the app registry (src/constants/apps.js)`);
    }

    const Wrapped = (props) => {
        const windowRef = useRef(null);
        const dragRef = useRef(null);
        const wasVisibleRef = useRef(false);
        const lastBoundsRef = useRef(null);
        const lastMaximizedRef = useRef(false);

        const windowState = useWindowStore((state) => state.windows[windowKey]);
        const focusWindow = useWindowStore((state) => state.focusWindow);
        const setBounds = useWindowStore((state) => state.setBounds);
        const toggleMaximize = useWindowStore((state) => state.toggleMaximize);

        const { isOpen, isMinimized, isMaximized, zIndex, bounds } = windowState;
        const isVisible = isOpen && !isMinimized;

        // Show / hide with macOS-style motion. Reads the latest state from the
        // store so the effect only re-runs when visibility actually flips.
        useLayoutEffect(() => {
            const element = windowRef.current;
            const wasVisible = wasVisibleRef.current;
            wasVisibleRef.current = isVisible;

            if (!element || isVisible === wasVisible) return;

            const { bounds: current, originRect, isMinimized: minimized } =
                useWindowStore.getState().windows[windowKey];

            gsap.killTweensOf(element);

            if (isVisible) {
                element.style.display = 'flex';

                if (originRect && current) {
                    // Grow out of the icon/tile that launched it.
                    gsap.fromTo(
                        element,
                        { transformOrigin: '0 0', ...transformToRect(current, originRect), opacity: 0 },
                        { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.35, ease: 'power3.out' }
                    );
                } else {
                    gsap.fromTo(
                        element,
                        { transformOrigin: '50% 50%', scale: 0.8, opacity: 0, y: 40 },
                        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
                    );
                }

                return;
            }

            const target = minimized ? minimizeTarget(windowKey) : null;

            if (target && current) {
                // Genie-lite: height collapses faster than width, so the window
                // squashes as it slides into its dock tile.
                const to = transformToRect(current, target);

                gsap.set(element, { transformOrigin: '0 0' });
                gsap.timeline({ onComplete: () => hideWindow(element) })
                    .to(element, { y: to.y, scaleY: to.scaleY, duration: 0.45, ease: 'power2.in' }, 0)
                    .to(element, { x: to.x, scaleX: to.scaleX, duration: 0.45, ease: 'power3.in' }, 0)
                    .to(element, { opacity: 0.4, duration: 0.45, ease: 'none' }, 0);
            } else {
                gsap.to(element, {
                    transformOrigin: '50% 50%',
                    scale: 0.92,
                    opacity: 0,
                    duration: 0.18,
                    ease: 'power1.in',
                    onComplete: () => hideWindow(element),
                });
            }
        }, [isVisible]);

        // Keep Draggable in sync with store-driven geometry, tween zoom
        // changes (~0.3s), and disable dragging while zoomed.
        useLayoutEffect(() => {
            const element = windowRef.current;
            const drag = dragRef.current;
            const previous = lastBoundsRef.current;
            const zoomChanged = lastMaximizedRef.current !== isMaximized;

            lastBoundsRef.current = bounds;
            lastMaximizedRef.current = isMaximized;

            if (drag) {
                if (isMaximized) drag.disable();
                else drag.enable();
            }

            if (element && zoomChanged && previous && bounds && isVisible) {
                gsap.fromTo(
                    element,
                    { left: previous.x, top: previous.y, width: previous.w, height: previous.h },
                    {
                        left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h,
                        duration: 0.3,
                        ease: 'power2.inOut',
                        onComplete: () => drag?.update(),
                    }
                );
            } else {
                drag?.update();
            }
        }, [bounds, isMaximized, isVisible]);

        useGSAP(() => {
            const element = windowRef.current;

            if (!element) return;

            const titlebar = element.querySelector('[data-titlebar]');

            const [dragInstance] = Draggable.create(element, {
                type: 'top,left',
                // The store owns z-index; Draggable's default boost would overwrite it.
                zIndexBoost: false,
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
