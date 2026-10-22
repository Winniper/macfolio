import { describe, it, expect } from 'vitest';
import gsap from 'gsap';
import { createAnimationSlot } from './animationSlot';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createAnimationSlot', () => {
    it('cancels the running timeline, including its onComplete, when a new animation plays', async () => {
        const slot = createAnimationSlot();
        const target = { x: 0 };
        let completed = false;

        slot.play(
            gsap.timeline({ onComplete: () => { completed = true; } })
                .to(target, { x: 100, duration: 0.3 })
        );
        await wait(50);
        slot.play(gsap.to(target, { x: -100, duration: 0.05 }));
        await wait(450);

        expect(completed).toBe(false);
        expect(target.x).toBe(-100);
    });

    it('finishes the running animation at its end values', () => {
        const slot = createAnimationSlot();
        const target = { width: 100 };

        slot.play(gsap.to(target, { width: 500, duration: 1 }));
        slot.finish();

        expect(target.width).toBe(500);
    });

    it('stops the running animation where it is', async () => {
        const slot = createAnimationSlot();
        const target = { width: 100 };

        slot.play(gsap.to(target, { width: 500, duration: 0.2 }));
        slot.stop();
        await wait(300);

        expect(target.width).toBeLessThan(500);
    });

    it('is safe to finish or stop when nothing is playing', () => {
        const slot = createAnimationSlot();
        expect(() => { slot.finish(); slot.stop(); }).not.toThrow();
    });
});
