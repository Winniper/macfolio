import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { foregroundApp, phoneSpotlightEntries, recentApps } from './phone';
import useSystemStore, { createInitialSystemState } from '../store/system';
import useWindowStore, { createInitialWindowState } from '../store/window';

const system = () => useSystemStore.getState();
const windows = () => useWindowStore.getState();

beforeEach(() => {
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    useWindowStore.setState(createInitialWindowState());
    useSystemStore.setState(createInitialSystemState());
});

afterEach(() => {
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
});

describe('phone app state', () => {
    it('puts the last opened app in front and lists recents newest first', () => {
        windows().openWindow('finder'); windows().openWindow('safari');
        expect(foregroundApp(windows())).toBe('safari');
        expect(recentApps(windows())).toEqual(['safari', 'finder']);
    });

    it('goes home with two apps visible, keeping both in recents', () => {
        windows().openWindow('finder'); windows().openWindow('safari');
        system().goHome();
        expect(foregroundApp(windows())).toBeNull();
        expect(recentApps(windows())).toEqual(['safari', 'finder']);
        expect(windows().windows.finder.isOpen).toBe(true);
    });

    it('brings a recent app back to the front', () => {
        windows().openWindow('finder'); windows().openWindow('safari'); system().goHome();
        system().switchToApp('finder');
        expect(foregroundApp(windows())).toBe('finder');
        expect(recentApps(windows())).toEqual(['finder', 'safari']);
    });

    it('returns home when the only visible app is closed', () => {
        windows().openWindow('finder'); system().goHome(); windows().openWindow('music');
        windows().closeWindow('music');
        expect(foregroundApp(windows())).toBeNull();
        expect(recentApps(windows())).toEqual(['finder']);
    });

    it('relabels and filters Spotlight entries for the phone', () => {
        const entries = [
            { id: 'a', subtitle: 'Show in Finder', action: { type: 'openApp', id: 'finder' } },
            { id: 'b', subtitle: 'App', action: { type: 'missionControl' } },
        ];
        expect(phoneSpotlightEntries(entries)).toEqual([{ id: 'a', subtitle: 'Show in Projects', action: { type: 'openApp', id: 'finder' } }]);
    });
});
