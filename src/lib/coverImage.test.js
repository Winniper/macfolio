import { describe, it, expect } from 'vitest';
import { fitWithin } from './coverImage';

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
