import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runMenuAction } from './menuActions';
import useWindowStore, { createInitialWindowState } from '../store/window';
import useSystemStore, { createInitialSystemState } from '../store/system';

const windows = () => useWindowStore.getState();
const system = () => useSystemStore.getState();

beforeEach(() => {
    useWindowStore.setState(createInitialWindowState());
    useSystemStore.setState({ ...createInitialSystemState(), bootPhase: 'desktop' });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('runMenuAction', () => {
    it('opens an app', () => {
        runMenuAction({ type: 'openApp', id: 'about' });
        expect(windows().windows.about.isOpen).toBe(true);
        expect(windows().focusedId).toBe('about');
    });

    it('switches to an app, restoring it if minimized', () => {
        windows().openWindow('finder');
        windows().minimizeWindow('finder');
        runMenuAction({ type: 'focusApp', id: 'finder' });
        expect(windows().windows.finder.isMinimized).toBe(false);
        expect(windows().focusedId).toBe('finder');
    });

    it('closes, minimizes and zooms a window', () => {
        windows().openWindow('finder');
        runMenuAction({ type: 'zoom', id: 'finder' });
        expect(windows().windows.finder.isMaximized).toBe(true);
        runMenuAction({ type: 'minimize', id: 'finder' });
        expect(windows().windows.finder.isMinimized).toBe(true);
        runMenuAction({ type: 'close', id: 'finder' });
        expect(windows().windows.finder.isOpen).toBe(false);
    });

    it('toggles Mission Control', () => {
        runMenuAction({ type: 'missionControl' });
        expect(system().missionControl).not.toBeNull();
        runMenuAction({ type: 'missionControl' });
        expect(system().missionControl).toBeNull();
    });

    it('asks Safari for a new tab every time', () => {
        runMenuAction({ type: 'safariNewTab' });
        const first = windows().windows.safari.data;
        runMenuAction({ type: 'safariNewTab' });
        expect(windows().windows.safari.data).toEqual({ newTab: true });
        // A fresh object each time is what re-fires Browser's newTab effect.
        expect(windows().windows.safari.data).not.toBe(first);
        expect(windows().focusedId).toBe('safari');
    });

    it('drops keyboard focus before locking or restarting', () => {
        const phases = [];
        const blur = vi.fn(() => phases.push(system().bootPhase));
        vi.stubGlobal('document', { activeElement: { blur } });
        runMenuAction({ type: 'lock' });
        expect(system().bootPhase).toBe('locked');
        useSystemStore.setState({ bootPhase: 'desktop' });
        runMenuAction({ type: 'restart' });
        expect(system().bootPhase).toBe('booting');
        expect(phases).toEqual(['desktop', 'desktop']);
    });

    it('copies the selected text', () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        vi.stubGlobal('getSelection', () => ({ toString: () => 'hello' }));
        runMenuAction({ type: 'copySelection' });
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('swallows a refused clipboard write and skips empty selections', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        vi.stubGlobal('getSelection', () => ({ toString: () => '' }));
        runMenuAction({ type: 'copySelection' });
        expect(writeText).not.toHaveBeenCalled();
        vi.stubGlobal('getSelection', () => ({ toString: () => 'hi' }));
        runMenuAction({ type: 'copySelection' });
        await Promise.resolve();
        expect(writeText).toHaveBeenCalledWith('hi');
    });

    it('tidies the desktop icons', () => {
        runMenuAction({ type: 'cleanUp' });
        runMenuAction({ type: 'cleanUp' });
        expect(system().desktopCleanups).toBe(2);
    });

    it('ignores unknown actions', () => {
        expect(() => runMenuAction({ type: 'nope' })).not.toThrow();
    });
});
