import { describe, it, expect } from 'vitest';
import { homeBarGesture, pullDownTarget, swipeDirection } from './gestures';

describe('swipeDirection', () => {
    it('reads a long drag by its dominant axis', () => {
        expect(swipeDirection({ dx: 5, dy: -60, dt: 300 })).toBe('up');
        expect(swipeDirection({ dx: 70, dy: 20, dt: 200 })).toBe('right');
        expect(swipeDirection({ dx: -4, dy: 90, dt: 400 })).toBe('down');
    });
    it('reads a short fast flick', () => {
        expect(swipeDirection({ dx: 0, dy: -20, dt: 30 })).toBe('up');
    });
    it('ignores a touch that barely moved, however fast', () => {
        expect(swipeDirection({ dx: 3, dy: 4, dt: 80 })).toBeNull();
        expect(swipeDirection({ dx: 0, dy: -12, dt: 10 })).toBeNull();
    });
});

describe('homeBarGesture', () => {
    const at = (sample) => homeBarGesture({ startX: 195, startY: 830, dx: 0, restMs: 0, ...sample }, 844);
    it('goes home on a tap or a short swipe up', () => {
        expect(at({ dy: -2, dt: 120 })).toBe('home');
        expect(at({ dy: -80, dt: 200, restMs: 20 })).toBe('home');
    });
    it('opens the switcher on a long press, a held swipe or a long drag', () => {
        expect(at({ dy: 0, dt: 600 })).toBe('switcher');
        expect(at({ dy: -120, dt: 700, restMs: 300 })).toBe('switcher');
        expect(at({ dy: -300, dt: 300 })).toBe('switcher');
    });
    it('ignores downward and sideways drags', () => {
        expect(at({ dy: 60, dt: 200 })).toBeNull();
        expect(at({ dx: 90, dy: -10, dt: 200 })).toBeNull();
    });
});

describe('pullDownTarget', () => {
    it('opens Control Center only from the top-right corner', () => {
        expect(pullDownTarget({ startX: 300, startY: 20 }, 390)).toBe('controlCenter');
        expect(pullDownTarget({ startX: 100, startY: 20 }, 390)).toBe('spotlight');
        expect(pullDownTarget({ startX: 300, startY: 200 }, 390)).toBe('spotlight');
    });
});
