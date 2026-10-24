import { describe, it, expect } from 'vitest';
import { fitWithin, withinDecodeLimits } from './coverImage';

describe('fitWithin', () => {
    it('scales a large landscape image down by its long side', () => {
        expect(fitWithin(1200, 600, 600)).toEqual({ width: 600, height: 300 });
    });
    it('scales a large portrait image down', () => {
        expect(fitWithin(600, 1500, 600)).toEqual({ width: 240, height: 600 });
    });
    it('never scales up', () => {
        expect(fitWithin(300, 200, 600)).toEqual({ width: 300, height: 200 });
        expect(fitWithin(600, 600, 600)).toEqual({ width: 600, height: 600 });
    });
    it('keeps at least 1px per side', () => {
        expect(fitWithin(5000, 2, 600)).toEqual({ width: 600, height: 1 });
    });
    it('handles invalid sizes without NaN', () => {
        expect(fitWithin(0, 0, 600)).toEqual({ width: 1, height: 1 });
        expect(fitWithin(NaN, 10, 600)).toEqual({ width: 1, height: 1 });
    });
});

describe('withinDecodeLimits', () => {
    it('accepts normal and unknown sizes', () => {
        expect(withinDecodeLimits({ width: 1200, height: 1200 })).toBe(true);
        expect(withinDecodeLimits(null)).toBe(true);
    });
    it('rejects a side over 8000 or over 40 megapixels', () => {
        expect(withinDecodeLimits({ width: 8001, height: 10 })).toBe(false);
        expect(withinDecodeLimits({ width: 7000, height: 7000 })).toBe(false);
        expect(withinDecodeLimits({ width: 8000, height: 5000 })).toBe(true);
    });
});
