import { describe, it, expect } from 'vitest';
import { initialsOf } from './profile';

describe('initialsOf', () => {
    it('uses the first letters of the first two names', () => {
        expect(initialsOf('Debaditya Barman')).toBe('DB');
        expect(initialsOf('  ada  king lovelace ')).toBe('AK');
        expect(initialsOf('Prince')).toBe('P');
    });
});
