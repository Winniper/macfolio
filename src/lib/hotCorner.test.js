import { describe, it, expect } from 'vitest';
import { shouldOpenFromHotCorner } from './hotCorner';

describe('shouldOpenFromHotCorner', () => {
    it('opens when a mouse with no buttons held reaches the corner', () => {
        expect(shouldOpenFromHotCorner({ pointerType: 'mouse', buttons: 0 })).toBe(true);
    });

    it('ignores the corner while a button is held, e.g. mid window-drag', () => {
        expect(shouldOpenFromHotCorner({ pointerType: 'mouse', buttons: 1 })).toBe(false);
    });

    it('ignores touch and pen', () => {
        expect(shouldOpenFromHotCorner({ pointerType: 'touch', buttons: 0 })).toBe(false);
        expect(shouldOpenFromHotCorner({ pointerType: 'pen', buttons: 0 })).toBe(false);
    });
});
