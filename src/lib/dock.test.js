import { describe, it, expect } from 'vitest';
import { getDockAction } from './dock';

describe('getDockAction', () => {
    it('does nothing for apps without a window', () => {
        expect(getDockAction(undefined)).toBe('none');
    });

    it('opens a closed window', () => {
        expect(getDockAction({ isOpen: false })).toBe('open');
    });

    it('focuses an open window instead of closing it', () => {
        expect(getDockAction({ isOpen: true })).toBe('focus');
    });
});
