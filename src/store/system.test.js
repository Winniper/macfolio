import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import useSystemStore, { createInitialSystemState, isDesktopPhase } from './system';
import useWindowStore, { createInitialWindowState } from './window';
import { placeholderTracks as tracks } from '../constants';

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

describe('music playback', () => {
    const [first, second, third] = tracks;

    it('starts stopped, at the default volume, with nothing loaded', () => {
        expect(system().audio).toEqual({
            currentTrackId: null, isPlaying: false, volume: 0.6, position: 0, duration: 0, seekNonce: 0,
        });
    });

    it('plays a track from the start and ignores unknown ones', () => {
        system().playTrack(second.id);
        expect(system().audio).toMatchObject({ currentTrackId: second.id, isPlaying: true, position: 0, seekNonce: 1 });
        system().playTrack('nope');
        expect(system().audio.currentTrackId).toBe(second.id);
    });

    it('lock keeps the music playing but restart stops it', () => {
        system().playTrack(second.id);
        system().lock();
        expect(system().audio.isPlaying).toBe(true);
        useSystemStore.setState({ bootPhase: 'desktop' });
        system().restart();
        expect(system().audio).toMatchObject({ isPlaying: false, currentTrackId: second.id });
    });

    it('toggles play, starting the first track when nothing is loaded', () => {
        system().togglePlay();
        expect(system().audio).toMatchObject({ currentTrackId: first.id, isPlaying: true });
        system().togglePlay();
        expect(system().audio.isPlaying).toBe(false);
        system().togglePlay();
        expect(system().audio.isPlaying).toBe(true);
    });

    it('skips forward keeping play state, and stops at the end of the list', () => {
        system().playTrack(second.id);
        system().nextTrack();
        expect(system().audio).toMatchObject({ currentTrackId: third.id, isPlaying: true });
        system().setAudioPosition(5);
        system().nextTrack();
        expect(system().audio).toMatchObject({ currentTrackId: third.id, isPlaying: false, position: 0 });
    });

    it('goes back a track, or restarts one more than 3 seconds in', () => {
        system().playTrack(second.id);
        system().setAudioPosition(10);
        const nonce = system().audio.seekNonce;
        system().previousTrack();
        expect(system().audio).toMatchObject({ currentTrackId: second.id, position: 0, seekNonce: nonce + 1 });
        system().previousTrack();
        expect(system().audio.currentTrackId).toBe(first.id);
        system().previousTrack();
        expect(system().audio).toMatchObject({ currentTrackId: first.id, position: 0 });
    });

    it('clamps volume and seeks, counting only the seeks someone asked for', () => {
        system().setVolume(2);
        expect(system().audio.volume).toBe(1);
        system().setVolume(-1);
        expect(system().audio.volume).toBe(0);

        system().playTrack(first.id);
        system().setAudioDuration(18);
        const nonce = system().audio.seekNonce;
        system().setAudioPosition(4);
        expect(system().audio).toMatchObject({ position: 4, seekNonce: nonce });
        system().seekTo(30);
        expect(system().audio).toMatchObject({ position: 18, seekNonce: nonce + 1 });
        system().seekTo(-5);
        expect(system().audio.position).toBe(0);
        system().setAudioDuration(NaN);
        expect(system().audio.duration).toBe(0);
    });

    it('can be paused and resumed from outside (media keys, a refused play)', () => {
        system().setPlaying(true);
        expect(system().audio.isPlaying).toBe(false);
        system().playTrack(first.id);
        system().setPlaying(false);
        expect(system().audio.isPlaying).toBe(false);
        system().setPlaying(true);
        expect(system().audio.isPlaying).toBe(true);
    });
});

describe('Control Center', () => {
    beforeEach(() => {
        useSystemStore.setState({ bootPhase: 'desktop' });
    });

    it('opens, closes and toggles, only on the desktop', () => {
        expect(system().controlCenterOpen).toBe(false);
        system().openControlCenter();
        expect(system().controlCenterOpen).toBe(true);
        system().closeControlCenter();
        expect(system().controlCenterOpen).toBe(false);
        system().toggleControlCenter();
        expect(system().controlCenterOpen).toBe(true);
        system().toggleControlCenter();
        expect(system().controlCenterOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'locked' });
        system().openControlCenter();
        expect(system().controlCenterOpen).toBe(false);
    });

    it('never stacks with Spotlight or Mission Control', () => {
        system().openSpotlight();
        system().openMissionControl();
        system().openControlCenter();
        expect(system()).toMatchObject({ controlCenterOpen: true, spotlightOpen: false, missionControl: null });

        system().openSpotlight();
        expect(system()).toMatchObject({ controlCenterOpen: false, spotlightOpen: true });

        system().openControlCenter();
        system().openMissionControl();
        expect(system().controlCenterOpen).toBe(false);
        expect(system().missionControl).not.toBeNull();
    });

    it('closes on lock and restart', () => {
        system().openControlCenter();
        system().lock();
        expect(system().controlCenterOpen).toBe(false);

        useSystemStore.setState({ bootPhase: 'desktop' });
        system().openControlCenter();
        system().restart();
        expect(system().controlCenterOpen).toBe(false);
    });

    it('dims the display down to 30%', () => {
        expect(system().brightness).toBe(1);
        system().setBrightness(0.5);
        expect(system().brightness).toBe(0.5);
        system().setBrightness(0.1);
        expect(system().brightness).toBe(0.3);
        system().setBrightness(2);
        expect(system().brightness).toBe(1);
        system().setBrightness('x');
        expect(system().brightness).toBe(0.3);
    });

    it('Focus hides banners but still keeps them in the history', () => {
        system().setFocusMode(true);
        const id = system().notify({ appId: 'safari', title: 'Quiet' });
        expect(id).not.toBeNull();
        expect(system().notifications).toEqual([]);
        expect(system().notificationHistory.map((n) => n.title)).toEqual(['Quiet']);

        system().setFocusMode(false);
        system().notify({ appId: 'safari', title: 'Loud' });
        expect(system().notifications.map((n) => n.title)).toEqual(['Loud']);
    });

    it('keeps the ten newest notifications across lock, until cleared', () => {
        Array.from({ length: 12 }, (_, i) => system().notify({ appId: 'safari', title: `n${i}` }));
        expect(system().notificationHistory.map((n) => n.title)).toEqual(
            Array.from({ length: 10 }, (_, i) => `n${i + 2}`),
        );
        system().lock();
        expect(system().notificationHistory).toHaveLength(10);
        system().clearNotificationHistory();
        expect(system().notificationHistory).toEqual([]);
    });
});

describe('music library', () => {
    const [first, second] = tracks;
    const uploaded = [{ id: 'u1', title: 'Mine', artist: 'Me', album: 'LP', cover: null, src: '/u1.mp3', duration: 90 }];

    it('starts with the placeholder songs', () => {
        expect(system().library).toEqual(tracks);
    });

    it('keeps the current track when it is still in the new list', () => {
        system().playTrack(second.id);
        system().setLibrary([first, second]);
        expect(system().audio).toMatchObject({ currentTrackId: second.id, isPlaying: true });
    });

    it('stops and clears the current track when it disappears', () => {
        system().playTrack(second.id);
        system().setLibrary(uploaded);
        expect(system().library).toEqual(uploaded);
        expect(system().audio).toMatchObject({ currentTrackId: null, isPlaying: false });
    });

    it('plays from the new library', () => {
        system().setLibrary(uploaded);
        system().playTrack(first.id);
        expect(system().audio.currentTrackId).toBeNull();
        system().togglePlay();
        expect(system().audio).toMatchObject({ currentTrackId: 'u1', isPlaying: true });
    });

    it('leaves playback alone when nothing is loaded', () => {
        system().setLibrary([]);
        system().togglePlay();
        expect(system().audio).toMatchObject({ currentTrackId: null, isPlaying: false });
    });
});
