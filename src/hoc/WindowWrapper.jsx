import { useLayoutEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Draggable from 'gsap/Draggable';

import useWindowStore from '../store/window';

const WindowWrapper = (WrappedComponent, windowKey) => {
    const Wrapped = (props) => {
        const windowRef = useRef(null);
        const { windows, focusWindow } = useWindowStore();

        const windowState = windows[windowKey];
        const { isOpen, zIndex } = windowState || { isOpen: false, zIndex: 0 };

        useLayoutEffect(() => {
            const element = windowRef.current;
            if (!element) return;

            if (isOpen) {
                element.style.display = 'block';

                gsap.fromTo(
                    element,
                    { scale: 0.8, opacity: 0, y: 40 },
                    { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
                );
            } else {
                element.style.display = 'none';
            }
        }, [isOpen]);

        useGSAP(() => {
            const element = windowRef.current;
            if (!element) return;

            const [dragInstance] = Draggable.create(element, {
                onPress: () => {
                    focusWindow(windowKey);
                },
            });

            return () => {
                if (dragInstance) dragInstance.kill();
            };
        }, []);

        return (
            <section
                id={windowKey}
                ref={windowRef}
                style={{ zIndex }}
                className="absolute"
            >
                <WrappedComponent {...props} />
            </section>
        );
    };

    Wrapped.displayName = `WindowWrapper(${WrappedComponent.displayName || WrappedComponent.name || 'Component'
        })`;

    return Wrapped;
};

export default WindowWrapper;