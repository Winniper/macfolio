import { describe, it, expect } from 'vitest';
import { APPS, INITIAL_Z_INDEX, getApp, dockApps, desktopItems, buildWindowConfig } from './apps';
import { navLinks } from './index';

describe('app registry', () => {
    it('has unique ids', () => {
        const ids = APPS.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('gives every desktop app a desktop position', () => {
        APPS.filter((a) => a.placement.includes('desktop')).forEach((a) => {
            expect(a.desktopPosition, a.id).toEqual({ top: expect.any(Number), left: expect.any(Number) });
        });
    });

    it('looks up apps by id', () => {
        expect(getApp('terminal').title).toBe('Skills');
        expect(getApp('nope')).toBeUndefined();
    });

    it('derives dock items in registry order with full icon paths', () => {
        expect(dockApps.map((a) => a.id)).toEqual(['finder', 'contact', 'terminal', 'missionControl', 'trash']);
        expect(dockApps.find((a) => a.id === 'finder')).toEqual({
            id: 'finder', name: 'Projects', icon: '/images/finder.png', canOpen: true, action: null,
        });
        expect(dockApps.find((a) => a.id === 'trash').canOpen).toBe(false);
    });

    it('marks Mission Control as a dock launcher without a window', () => {
        expect(dockApps.find((a) => a.id === 'missionControl')).toEqual({
            id: 'missionControl', name: 'Mission Control', icon: '/images/mission-control.svg',
            canOpen: false, action: 'missionControl',
        });
        expect(buildWindowConfig().missionControl).toBeUndefined();
    });

    it('derives desktop items using label and desktopIcon overrides', () => {
        expect(desktopItems).toEqual([
            { id: 'finder', title: 'Projects', icon: '/images/folder.png', position: { top: 60, left: 20 } },
            { id: 'resume', title: 'Resume.pdf', icon: '/images/pdf.png', position: { top: 160, left: 20 } },
            { id: 'safari', title: 'Safari', icon: '/images/safari.png', position: { top: 260, left: 20 } },
        ]);
    });

    it('builds a closed window entry for every windowed app only', () => {
        const config = buildWindowConfig();
        expect(Object.keys(config).sort()).toEqual(['contact', 'finder', 'resume', 'safari', 'terminal']);
        expect(config.finder).toEqual({
            isOpen: false, zIndex: INITIAL_Z_INDEX, data: null,
            isMinimized: false, isMaximized: false, bounds: null, prevBounds: null, originRect: null,
        });
    });

    it('gives every windowed app a default size at least its minimum size', () => {
        APPS.filter((a) => a.hasWindow !== false).forEach((a) => {
            expect(a.defaultBounds, a.id).toEqual({
                x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number),
            });
            expect(a.minSize, a.id).toEqual({ w: expect.any(Number), h: expect.any(Number) });
            expect(a.defaultBounds.w, a.id).toBeGreaterThanOrEqual(a.minSize.w);
            expect(a.defaultBounds.h, a.id).toBeGreaterThanOrEqual(a.minSize.h);
        });
    });

    it('returns fresh objects on each build', () => {
        expect(buildWindowConfig().finder).not.toBe(buildWindowConfig().finder);
    });

    it('covers every menu-bar link with a window', () => {
        const config = buildWindowConfig();
        navLinks.forEach(({ type }) => expect(config[type], type).toBeDefined());
    });
});
