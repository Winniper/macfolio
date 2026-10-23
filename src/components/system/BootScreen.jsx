import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

import { prefersReducedMotion } from '../../lib/boot';
import useSystemStore from '../../store/system';

gsap.registerPlugin(DrawSVGPlugin);

// One continuous cursive stroke reading "hello".
// Hand-authored; replace with your own path if you like.
const HELLO_PATH = [
    'M 40 170 C 70 150, 110 90, 110 55 C 110 30, 85 30, 80 60 C 72 105, 70 150, 68 185',
    'C 80 140, 115 110, 130 125 C 142 138, 132 170, 140 182',
    'C 160 190, 200 160, 205 140 C 210 118, 180 118, 175 145 C 170 172, 195 190, 225 175',
    'C 255 155, 290 100, 288 60 C 286 30, 262 35, 262 70 C 262 110, 262 160, 280 182 C 290 190, 305 180, 315 165',
    'C 340 130, 362 95, 360 60 C 358 30, 334 35, 334 70 C 334 110, 334 160, 352 182 C 362 190, 378 180, 388 165',
    'C 400 140, 430 120, 450 135 C 470 150, 460 188, 432 188 C 408 188, 405 160, 420 140 C 432 126, 452 130, 470 135',
    'C 490 140, 510 130, 525 120',
].join(' ');

// Tight around the stroke (path bounds 40,36.8 485x151.2, plus half the 14px
// stroke) so centring the <svg> centres the drawing itself. Edit both together.
const HELLO_VIEWBOX = '33 29.8 499 165.2';

// Black screen that draws "hello", holds, and fades into the lock screen.
// Any click or key skips straight to the lock screen.
const BootScreen = () => {
    const rootRef = useRef(null);
    const pathRef = useRef(null);
    const finishBoot = useSystemStore((state) => state.finishBoot);

    useEffect(() => {
        const timeline = gsap.timeline({ onComplete: finishBoot });

        if (prefersReducedMotion()) {
            timeline
                .set(pathRef.current, { drawSVG: '100%' })
                .to(rootRef.current, { opacity: 0, duration: 0.4, delay: 0.8 });
        } else {
            timeline
                .fromTo(pathRef.current, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2.5, ease: 'power1.inOut' })
                .to(rootRef.current, { opacity: 0, duration: 0.5, delay: 0.5 });
        }

        const skip = () => {
            timeline.kill();
            finishBoot();
        };

        window.addEventListener('keydown', skip);

        return () => {
            window.removeEventListener('keydown', skip);
            timeline.kill();
        };
    }, [finishBoot]);

    return (
        <div ref={rootRef} className="boot-screen" onPointerDown={finishBoot}>
            <svg viewBox={HELLO_VIEWBOX} aria-label="hello" role="img">
                <path
                    ref={pathRef}
                    d={HELLO_PATH}
                    fill="none"
                    stroke="white"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};

export default BootScreen;
