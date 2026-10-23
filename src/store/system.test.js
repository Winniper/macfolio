import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import useSystemStore, { createInitialSystemState, isDesktopPhase } from './system';
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

describe('boot phase', () => {
    const memoryStorage = () => {
        const data = {};
        return {
            getItem: (key) => (key in data ? data[key] : null),
            setItem: (key, value) => { data[key] = String(value); },
        };
    };

    afterEach(() => {
        delete globalThis.sessionStorage;
    });

    it('boots on a first visit and skips once the boot was seen in this tab', () => {
        globalThis.sessionStorage = memoryStorage();
        expect(createInitialSystemState().bootPhase).toBe('booting');
        globalThis.sessionStorage.setItem('portfolio:bootSeen', '1');
        expect(createInitialSystemState().bootPhase).toBe('desktop');
    });

    it('goes from booting to locked, and only from booting', () => {
        useSystemStore.setState({ bootPhase: 'booting' });
        system().finishBoot();
        expect(system().bootPhase).toBe('locked');
        useSystemStore.setState({ bootPhase: 'desktop' });
        system().finishBoot();
        expect(system().bootPhase).toBe('desktop');
    });

    it('unlocks to the desktop and remembers the boot was seen', () => {
        globalThis.sessionStorage = memoryStorage();
        useSystemStore.setState({ bootPhase: 'locked' });
        system().unlock();
        expect(system().bootPhase).toBe('desktop');
        expect(globalThis.sessionStorage.getItem('portfolio:bootSeen')).toBe('1');
    });

    it('only unlocks from the lock screen', () => {
        useSystemStore.setState({ bootPhase: 'booting' });
        system().unlock();
        expect(system().bootPhase).toBe('booting');
    });

    it('locks and restarts without touching open windows, closing Mission Control', () => {
        windows().openWindow('finder');
        windows().setBounds('finder', { x: 300, y: 200, w: 600, h: 400 });
        const before = windows().windows.finder;
        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openMissionControl();

        system().lock();
        expect(system().bootPhase).toBe('locked');
        expect(system().missionControl).toBeNull();

        system().openMissionControl();
        system().restart();
        expect(system().bootPhase).toBe('booting');
        expect(system().missionControl).toBeNull();
        expect(windows().windows.finder).toEqual(before);
    });

    it('accepts desktop shortcuts only on the desktop', () => {
        expect(isDesktopPhase({ bootPhase: 'desktop' })).toBe(true);
        expect(isDesktopPhase({ bootPhase: 'locked' })).toBe(false);
        expect(isDesktopPhase({ bootPhase: 'booting' })).toBe(false);
    });
});

describe('Spotlight state', () => {
    beforeEach(() => {
        useSystemStore.setState({ bootPhase: 'desktop' });
    });

    it('starts closed, opens, closes and toggles', () => {
        expect(system().spotlightOpen).toBe(false);
        system().openSpotlight();
        expect(system().spotlightOpen).toBe(true);
        system().closeSpotlight();
        expect(system().spotlightOpen).toBe(false);
        system().toggleSpotlight();
        expect(system().spotlightOpen).toBe(true);
        system().toggleSpotlight();
        expect(system().spotlightOpen).toBe(false);
    });

    it('never stacks with Mission Control', () => {
        system().openMissionControl();
        system().openSpotlight();
        expect(system().missionControl).toBeNull();
        expect(system().spotlightOpen).toBe(true);
        system().openMissionControl();
        expect(system().spotlightOpen).toBe(false);
        expect(system().missionControl).not.toBeNull();
    });

    it('opens only on the desktop and closes on lock and restart', () => {
        useSystemStore.setState({ bootPhase: 'locked' });
        system().openSpotlight();
        expect(system().spotlightOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openSpotlight();
        system().lock();
        expect(system().spotlightOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openSpotlight();
        system().restart();
        expect(system().spotlightOpen).toBe(false);
    });
});

describe('notifications', () => {
    beforeEach(() => {
        useSystemStore.setState({ bootPhase: 'desktop' });
    });

    it('adds banners with increasing ids', () => {
        const first = system().notify({ appId: 'contact', title: 'Messages', body: 'Hi' });
        const second = system().notify({ appId: 'safari', title: 'Safari' });
        expect(second).toBe(first + 1);
        expect(system().notifications.map((n) => [n.id, n.title])).toEqual([[first, 'Messages'], [second, 'Safari']]);
    });

    it('keeps at most three on screen', () => {
        ['a', 'b', 'c', 'd'].forEach((title) => system().notify({ appId: 'safari', title }));
        expect(system().notifications.map((n) => n.title)).toEqual(['b', 'c', 'd']);
    });

    it('ignores banners off the desktop or without a title', () => {
        expect(system().notify({ appId: 'safari', title: '   ' })).toBeNull();
        expect(system().notify({ appId: 'safari' })).toBeNull();
        useSystemStore.setState({ bootPhase: 'locked' });
        expect(system().notify({ appId: 'safari', title: 'Safari' })).toBeNull();
        expect(system().notifications).toEqual([]);
    });

    it('dismisses one banner by id', () => {
        const first = system().notify({ appId: 'contact', title: 'One' });
        system().notify({ appId: 'safari', title: 'Two' });
        system().dismissNotification(first);
        expect(system().notifications.map((n) => n.title)).toEqual(['Two']);
        system().dismissNotification(999);
        expect(system().notifications).toHaveLength(1);
    });

    it('clears banners on lock and restart', () => {
        system().notify({ appId: 'safari', title: 'Safari' });
        system().lock();
        expect(system().notifications).toEqual([]);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().notify({ appId: 'safari', title: 'Safari' });
        system().restart();
        expect(system().notifications).toEqual([]);
    });

    it('has sound effects on by default and can switch them', () => {
        expect(system().soundEffects).toBe(true);
        system().setSoundEffects(false);
        expect(system().soundEffects).toBe(false);
        system().setSoundEffects(true);
        expect(system().soundEffects).toBe(true);
    });
});
