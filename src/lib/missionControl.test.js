import { describe, it, expect } from 'vitest';
import { missionControlLayout } from './missionControl';

const viewport = { width: 1440, height: 900 };

describe('missionControlLayout', () => {
    it('lays out nothing when no windows are visible', () => {
        expect(missionControlLayout([], viewport)).toEqual({});
    });

    it('centers a single window that already fits, without enlarging it', () => {
        const layout = missionControlLayout([{ key: 'finder', bounds: { x: 128, y: 80, w: 760, h: 444 } }], viewport);
        expect(layout.finder).toEqual({
            x: 212, y: 94, scale: 1,
            label: { left: 340, top: 626, width: 760 },
        });
    });

    it('shrinks a maximized window to fit its slot', () => {
        const { finder } = missionControlLayout([{ key: 'finder', bounds: { x: 0, y: 40, w: 1440, h: 740 } }], viewport);
        expect(finder.scale).toBeCloseTo(568 / 740);
        expect(1440 * finder.scale).toBeLessThanOrEqual(1296);
    });

    it('arranges four windows in a 2x2 grid in the given order', () => {
        const bounds = { x: 0, y: 40, w: 400, h: 300 };
        const layout = missionControlLayout(
            ['a', 'b', 'c', 'd'].map((key) => ({ key, bounds })),
            viewport
        );
        expect(Object.keys(layout)).toEqual(['a', 'b', 'c', 'd']);
        expect(layout.a.scale).toBeCloseTo(0.82);
        expect(layout.a.x).toBeCloseTo(220);
        expect(layout.a.y).toBeCloseTo(72);
        expect(layout.d.x).toBeCloseTo(892);
        expect(layout.d.y).toBeCloseTo(394);
    });
});
