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
        expect(windows().windows.safari.data).not.toBe(first);
        expect(windows().focusedId).toBe('safari');
    });

    it('drops keyboard focus before locking or restarting', () => {
        const blur = vi.fn();
        vi.stubGlobal('document', { activeElement: { blur } });
        runMenuAction({ type: 'lock' });
        expect(blur).toHaveBeenCalledTimes(1);
        expect(system().bootPhase).toBe('locked');
        runMenuAction({ type: 'restart' });
        expect(blur).toHaveBeenCalledTimes(2);
        expect(system().bootPhase).toBe('booting');
    });

    it('copies the selected text', () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        vi.stubGlobal('getSelection', () => ({ toString: () => 'hello' }));
        runMenuAction({ type: 'copySelection' });
        expect(writeText).toHaveBeenCalledWith('hello');
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
