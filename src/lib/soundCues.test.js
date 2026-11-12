import { describe, it, expect } from 'vitest';
import { soundCues, soundSnapshot } from './soundCues';

const snap = (overrides = {}) => ({
    bootPhase: 'desktop',
    spotlightOpen: false,
    notificationIds: [],
    minimized: [],
    visible: [],
    ...overrides,
});

describe('soundSnapshot', () => {
    it('keeps only what sounds react to', () => {
        const windowState = {
            minimizedStack: ['resume'],
            windows: {
                finder: { isOpen: true, isMinimized: false },
                resume: { isOpen: true, isMinimized: true },
                safari: { isOpen: false, isMinimized: false },
            },
        };
        const systemState = { bootPhase: 'desktop', spotlightOpen: true, notifications: [{ id: 4 }, { id: 5 }] };
        expect(soundSnapshot(windowState, systemState)).toEqual({
            bootPhase: 'desktop',
            spotlightOpen: true,
            notificationIds: [4, 5],
            minimized: ['resume'],
            visible: ['finder'],
        });
    });
});

describe('soundCues', () => {
    it('chimes only when the visitor unlocks', () => {
        expect(soundCues(snap({ bootPhase: 'locked' }), snap())).toEqual(['startup']);
        expect(soundCues(snap({ bootPhase: 'booting' }), snap({ bootPhase: 'locked' }))).toEqual([]);
        expect(soundCues(snap({ bootPhase: 'booting' }), snap())).toEqual([]);
    });

    it('whooshes when a window minimizes', () => {
        expect(soundCues(snap({ visible: ['finder'] }), snap({ minimized: ['finder'] }))).toEqual(['minimize']);
    });

    it('whooshes back on restore, but not when a minimized window is closed', () => {
        expect(soundCues(snap({ minimized: ['finder'] }), snap({ visible: ['finder'] }))).toEqual(['restore']);
        expect(soundCues(snap({ minimized: ['finder'] }), snap())).toEqual([]);
    });

    it('blips once per new notification batch', () => {
        expect(soundCues(snap({ notificationIds: [1] }), snap({ notificationIds: [1, 2] }))).toEqual(['notification']);
        expect(soundCues(snap({ notificationIds: [1, 2] }), snap({ notificationIds: [2] }))).toEqual([]);
    });

    it('ticks when Spotlight opens', () => {
        expect(soundCues(snap(), snap({ spotlightOpen: true }))).toEqual(['spotlight']);
        expect(soundCues(snap({ spotlightOpen: true }), snap())).toEqual([]);
    });

    it('stays quiet for unrelated changes', () => {
        const before = snap({ visible: ['finder'], notificationIds: [3] });
        expect(soundCues(before, snap({ visible: ['finder', 'resume'], notificationIds: [3] }))).toEqual([]);
        expect(soundCues(before, before)).toEqual([]);
    });
});

describe('soundCues on the phone', () => {
    it('never plays minimize or restore', () => {
        const base = { bootPhase: 'desktop', spotlightOpen: false, notificationIds: [], minimized: [], visible: ['finder'] };
        const home = { ...base, minimized: ['finder'], visible: [] };
        expect(soundCues(base, home, { phone: true })).toEqual([]);
        expect(soundCues(home, base, { phone: true })).toEqual([]);
        expect(soundCues(base, { ...base, spotlightOpen: true }, { phone: true })).toEqual(['spotlight']);
    });
});
