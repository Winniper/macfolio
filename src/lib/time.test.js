import { describe, it, expect } from 'vitest';
import { msUntilNextMinute } from './time';

describe('msUntilNextMinute', () => {
    it('counts down to the next minute boundary', () => {
        expect(msUntilNextMinute(new Date(2026, 9, 22, 10, 30, 45, 500))).toBe(14500);
    });

    it('waits a full minute when exactly on a boundary', () => {
        expect(msUntilNextMinute(new Date(2026, 9, 22, 10, 30, 0, 0))).toBe(60000);
    });

    it('handles the last millisecond of a minute', () => {
        expect(msUntilNextMinute(new Date(2026, 9, 22, 23, 59, 59, 999))).toBe(1);
    });
});
