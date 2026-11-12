import { describe, it, expect, afterEach } from 'vitest';
import {
    MENU_BAR_HEIGHT, DOCK_RESERVE, TITLE_BAR_HEIGHT, MIN_VISIBLE,
    getViewport, clampBounds, fitOnScreen, maximizedBounds, resizeBounds, toRect, transformToRect,
} from './bounds';

const viewport = { width: 1440, height: 900 };
const minSize = { w: 300, h: 200 };

describe('getViewport', () => {
    afterEach(() => {
        delete globalThis.innerWidth;
        delete globalThis.innerHeight;
    });

    it('reads the window size', () => {
        globalThis.innerWidth = 1280;
        globalThis.innerHeight = 720;
        expect(getViewport()).toEqual({ width: 1280, height: 720 });
    });

    it('falls back to 1440x900 outside a browser', () => {
        expect(getViewport()).toEqual({ width: 1440, height: 900 });
    });
});

describe('clampBounds', () => {
    it('leaves in-range bounds alone', () => {
        const b = { x: 100, y: 100, w: 500, h: 400 };
        expect(clampBounds(b, minSize, viewport)).toEqual(b);
    });

    it('grows to the minimum size', () => {
        expect(clampBounds({ x: 10, y: 100, w: 100, h: 100 }, minSize, viewport))
            .toEqual({ x: 10, y: 100, w: 300, h: 200 });
    });

    it('shrinks to fit the screen below the menu bar', () => {
        expect(clampBounds({ x: 0, y: MENU_BAR_HEIGHT, w: 2000, h: 2000 }, minSize, viewport))
            .toEqual({ x: 0, y: MENU_BAR_HEIGHT, w: 1440, h: 900 - MENU_BAR_HEIGHT });
    });

    it('keeps at least MIN_VISIBLE px on screen horizontally', () => {
        expect(clampBounds({ x: -1000, y: 100, w: 500, h: 300 }, minSize, viewport).x).toBe(MIN_VISIBLE - 500);
        expect(clampBounds({ x: 5000, y: 100, w: 500, h: 300 }, minSize, viewport).x).toBe(1440 - MIN_VISIBLE);
    });

    it('keeps the title bar between the menu bar and the bottom edge', () => {
        expect(clampBounds({ x: 100, y: 0, w: 500, h: 300 }, minSize, viewport).y).toBe(MENU_BAR_HEIGHT);
        expect(clampBounds({ x: 100, y: 2000, w: 500, h: 300 }, minSize, viewport).y).toBe(900 - TITLE_BAR_HEIGHT);
    });
});

describe('maximizedBounds', () => {
    it('fills the space between the menu bar and the dock', () => {
        expect(maximizedBounds(viewport)).toEqual({
            x: 0, y: MENU_BAR_HEIGHT, w: 1440, h: 900 - MENU_BAR_HEIGHT - DOCK_RESERVE,
        });
    });

    it('never goes shorter than a title bar on tiny screens', () => {
        expect(maximizedBounds({ width: 400, height: 100 }).h).toBe(TITLE_BAR_HEIGHT);
    });
});

describe('resizeBounds', () => {
    const start = { x: 100, y: 100, w: 400, h: 300 };

    it('grows from the east edge', () => {
        expect(resizeBounds(start, 'e', 50, 999, minSize)).toEqual({ x: 100, y: 100, w: 450, h: 300 });
    });

    it('grows from the south edge', () => {
        expect(resizeBounds(start, 's', 999, 40, minSize)).toEqual({ x: 100, y: 100, w: 400, h: 340 });
    });

    it('moves the left edge and keeps the right edge fixed', () => {
        expect(resizeBounds(start, 'w', -20, 0, minSize)).toEqual({ x: 80, y: 100, w: 420, h: 300 });
    });

    it('stops the west edge at the minimum width without moving the right edge', () => {
        expect(resizeBounds(start, 'w', 200, 0, minSize)).toEqual({ x: 200, y: 100, w: 300, h: 300 });
    });

    it('resizes both axes from a corner', () => {
        expect(resizeBounds(start, 'nw', -20, -30, minSize)).toEqual({ x: 80, y: 70, w: 420, h: 330 });
    });

    it('stops the north edge at the menu bar without moving the bottom edge', () => {
        const nearTop = { x: 100, y: 60, w: 400, h: 300 };
        expect(resizeBounds(nearTop, 'n', 0, -50, minSize))
            .toEqual({ x: 100, y: MENU_BAR_HEIGHT, w: 400, h: 320 });
    });
});

describe('toRect', () => {
    it('converts a DOMRect-like object', () => {
        expect(toRect({ left: 1, top: 2, width: 3, height: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    });
});

describe('transformToRect', () => {
    it('maps a window onto a target rect from its top-left corner', () => {
        expect(transformToRect({ x: 100, y: 100, w: 400, h: 300 }, { x: 600, y: 850, w: 48, h: 48 }))
            .toEqual({ x: 500, y: 750, scaleX: 0.12, scaleY: 0.16 });
    });
});

describe('fitOnScreen', () => {
    const laptop = { width: 1280, height: 800 };
    const min = { w: 400, h: 360 };

    it('moves a window that hangs off the right edge back on screen', () => {
        expect(fitOnScreen({ x: 700, y: 64, w: 700, h: 600 }, min, laptop)).toEqual({ x: 568, y: 64, w: 700, h: 600 });
    });
    it('leaves a window alone when it is already fully on screen', () => {
        expect(fitOnScreen({ x: 100, y: 100, w: 400, h: 400 }, min, laptop)).toEqual({ x: 100, y: 100, w: 400, h: 400 });
    });
    it('shrinks a window larger than the area between menu bar and dock', () => {
        expect(fitOnScreen({ x: 200, y: 70, w: 1000, h: 680 }, { w: 480, h: 360 }, { width: 1024, height: 768 }))
            .toEqual({ x: 12, y: 52, w: 1000, h: 584 });
    });
    it('takes the whole area when the screen is smaller than the minimum size', () => {
        expect(fitOnScreen({ x: 240, y: 90, w: 900, h: 560 }, { w: 640, h: 400 }, { width: 700, height: 500 }))
            .toEqual({ x: 12, y: 52, w: 676, h: 316 });
    });
    it('raises a too-small window to its minimum size', () => {
        expect(fitOnScreen({ x: 100, y: 100, w: 200, h: 100 }, min, laptop)).toEqual({ x: 100, y: 100, w: 400, h: 360 });
    });
    it('pulls a window in from beyond the left and top edges', () => {
        expect(fitOnScreen({ x: -300, y: 10, w: 400, h: 400 }, min, laptop)).toEqual({ x: 12, y: 52, w: 400, h: 400 });
    });
});
