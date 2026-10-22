import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import useSystemStore, { createInitialSystemState } from './system';
import useWindowStore, { createInitialWindowState } from './window';

const system = () => useSystemStore.getState();
const windows = () => useWindowStore.getState();

beforeEach(() => {
    globalThis.innerWidth = 1440;
    globalThis.innerHeight = 900;
    useWindowStore.setState(createInitialWindowState());
    useSystemStore.setState(createInitialSystemState());
});

afterEach(() => {
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
});

describe('Mission Control state', () => {
    it('starts closed', () => {
        expect(system().missionControl).toBeNull();
    });

    it('lays out only visible windows, frontmost first', () => {
        windows().openWindow('finder');
        windows().openWindow('terminal');
        windows().openWindow('contact');
        windows().minimizeWindow('terminal');
        system().openMissionControl();
        expect(Object.keys(system().missionControl.layout)).toEqual(['contact', 'finder']);
    });

    it('closes', () => {
        windows().openWindow('finder');
        system().openMissionControl();
        system().closeMissionControl();
        expect(system().missionControl).toBeNull();
    });

    it('toggles open and closed', () => {
        system().toggleMissionControl();
        expect(system().missionControl).toEqual({ layout: {} });
        system().toggleMissionControl();
        expect(system().missionControl).toBeNull();
    });
});

describe('switchToApp', () => {
    it('leaves Mission Control and restores a minimized app', () => {
        windows().openWindow('finder');
        windows().openWindow('terminal');
        windows().minimizeWindow('terminal');
        system().openMissionControl();
        system().switchToApp('terminal');
        expect(system().missionControl).toBeNull();
        expect(windows().windows.terminal.isMinimized).toBe(false);
        expect(windows().focusedId).toBe('terminal');
    });

    it('leaves Mission Control and focuses a visible app', () => {
        windows().openWindow('finder');
        windows().openWindow('terminal');
        system().openMissionControl();
        system().switchToApp('finder');
        expect(system().missionControl).toBeNull();
        expect(windows().focusedId).toBe('finder');
    });
});
