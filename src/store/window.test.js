import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import useWindowStore, { createInitialWindowState } from './window';
import { INITIAL_Z_INDEX } from '../constants/apps';
import { MENU_BAR_HEIGHT, maximizedBounds } from '../lib/bounds';

const store = () => useWindowStore.getState();
const setViewport = (width, height) => {
    globalThis.innerWidth = width;
    globalThis.innerHeight = height;
};

beforeEach(() => {
    setViewport(1440, 900);
    useWindowStore.setState(createInitialWindowState());
});

afterEach(() => {
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
});

describe('opening, focus and closing', () => {
    it('starts with every window closed and nothing focused', () => {
        expect(store().focusedId).toBeNull();
        expect(store().minimizedStack).toEqual([]);
        Object.values(store().windows).forEach((w) => expect(w.isOpen).toBe(false));
    });

    it('opens a window on top and focuses it', () => {
        store().openWindow('finder', { folder: 'projects' });
        expect(store().windows.finder).toMatchObject({
            isOpen: true, zIndex: INITIAL_Z_INDEX + 1, data: { folder: 'projects' },
        });
        expect(store().focusedId).toBe('finder');
    });

    it('stacks later windows above earlier ones', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        expect(store().windows.terminal.zIndex).toBeGreaterThan(store().windows.finder.zIndex);
        expect(store().focusedId).toBe('terminal');
    });

    it('raises a focused window above the rest', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        store().focusWindow('finder');
        expect(store().windows.finder.zIndex).toBeGreaterThan(store().windows.terminal.zIndex);
        expect(store().focusedId).toBe('finder');
    });

    it('does not bump z-index when the window is already focused', () => {
        store().openWindow('finder');
        const z = store().windows.finder.zIndex;
        const next = store().nextZIndex;
        store().focusWindow('finder');
        expect(store().windows.finder.zIndex).toBe(z);
        expect(store().nextZIndex).toBe(next);
    });

    it('ignores focus on a closed window', () => {
        store().openWindow('finder');
        const before = store().nextZIndex;
        store().focusWindow('terminal');
        expect(store().windows.terminal.isOpen).toBe(false);
        expect(store().nextZIndex).toBe(before);
        expect(store().focusedId).toBe('finder');
    });

    it('resets a closed window and hands focus to the next topmost open window', () => {
        store().openWindow('finder');
        store().openWindow('contact');
        store().openWindow('terminal', { x: 1 });
        store().closeWindow('terminal');
        expect(store().windows.terminal).toMatchObject({ isOpen: false, zIndex: INITIAL_Z_INDEX, data: null });
        expect(store().focusedId).toBe('contact');
    });

    it('keeps focus when closing a background window', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        store().closeWindow('finder');
        expect(store().focusedId).toBe('terminal');
    });

    it('clears focus when the last window closes', () => {
        store().openWindow('finder');
        store().closeWindow('finder');
        expect(store().focusedId).toBeNull();
    });

    it('ignores unknown window ids', () => {
        const before = store();
        store().openWindow('safari');
        store().closeWindow('safari');
        store().focusWindow('safari');
        store().minimizeWindow('safari');
        store().restoreWindow('safari');
        store().toggleMaximize('safari');
        store().setBounds('safari', { x: 0, y: 0, w: 1, h: 1 });
        expect(store().windows).toEqual(before.windows);
        expect(store().nextZIndex).toBe(before.nextZIndex);
    });
});

describe('bounds', () => {
    it('opens at the default bounds', () => {
        store().openWindow('finder');
        expect(store().windows.finder.bounds).toEqual({ x: 128, y: 80, w: 760, h: 444 });
    });

    it('fits the default bounds to a small screen', () => {
        setViewport(800, 600);
        store().openWindow('resume');
        expect(store().windows.resume.bounds).toEqual({ x: 700, y: 64, w: 700, h: 560 });
    });

    it('records where the window was launched from', () => {
        const rect = { x: 20, y: 60, w: 96, h: 80 };
        store().openWindow('finder', null, rect);
        expect(store().windows.finder.originRect).toEqual(rect);
    });

    it('clamps new bounds to the minimum size and below the menu bar', () => {
        store().openWindow('finder');
        store().setBounds('finder', { x: 0, y: 0, w: 10, h: 10 });
        expect(store().windows.finder.bounds).toEqual({ x: 0, y: MENU_BAR_HEIGHT, w: 520, h: 320 });
    });

    it('stores a fresh bounds object even when clamping gives the same values', () => {
        // WindowWrapper re-applies geometry whenever this reference changes; a drag
        // past the same clamp twice must still correct the DOM.
        store().openWindow('finder');
        store().setBounds('finder', { x: -5000, y: 80, w: 760, h: 444 });
        const first = store().windows.finder.bounds;
        store().setBounds('finder', { x: -6000, y: 80, w: 760, h: 444 });
        expect(store().windows.finder.bounds).toEqual(first);
        expect(store().windows.finder.bounds).not.toBe(first);
    });

    it('reopens a window where it was left', () => {
        store().openWindow('finder');
        store().setBounds('finder', { x: 300, y: 200, w: 600, h: 400 });
        store().closeWindow('finder');
        store().openWindow('finder');
        expect(store().windows.finder.bounds).toEqual({ x: 300, y: 200, w: 600, h: 400 });
    });

    it('keeps every window reachable when the screen shrinks', () => {
        store().openWindow('finder');
        store().setBounds('finder', { x: 1200, y: 700, w: 600, h: 400 });
        setViewport(1000, 700);
        store().fitToViewport();
        expect(store().windows.finder.bounds).toEqual({ x: 920, y: 656, w: 600, h: 400 });
    });
});

describe('minimize and restore', () => {
    it('minimizes into the dock stack and hands focus on', () => {
        store().openWindow('finder');
        store().openWindow('terminal');
        store().minimizeWindow('terminal');
        expect(store().windows.terminal).toMatchObject({ isOpen: true, isMinimized: true });
        expect(store().minimizedStack).toEqual(['terminal']);
        expect(store().focusedId).toBe('finder');
    });

    it('ignores minimizing a closed or already-minimized window', () => {
        store().minimizeWindow('finder');
        expect(store().windows.finder.isMinimized).toBe(false);
        store().openWindow('finder');
        store().minimizeWindow('finder');
        store().minimizeWindow('finder');
        expect(store().minimizedStack).toEqual(['finder']);
    });

    it('does not focus a minimized window', () => {
        store().openWindow('finder');
        store().minimizeWindow('finder');
        store().focusWindow('finder');
        expect(store().focusedId).toBeNull();
    });

    it('restores a minimized window on top', () => {
        const rect = { x: 900, y: 840, w: 56, h: 56 };
        store().openWindow('finder');
        store().openWindow('terminal');
        store().minimizeWindow('finder');
        store().restoreWindow('finder', rect);
        expect(store().windows.finder).toMatchObject({ isMinimized: false, originRect: rect });
        expect(store().windows.finder.zIndex).toBeGreaterThan(store().windows.terminal.zIndex);
        expect(store().minimizedStack).toEqual([]);
        expect(store().focusedId).toBe('finder');
    });

    it('restores a minimized window when it is opened again', () => {
        store().openWindow('resume');
        store().minimizeWindow('resume');
        store().openWindow('resume');
        expect(store().windows.resume.isMinimized).toBe(false);
        expect(store().minimizedStack).toEqual([]);
        expect(store().focusedId).toBe('resume');
    });

    it('drops a minimized window from the dock when it is closed', () => {
        store().openWindow('finder');
        store().minimizeWindow('finder');
        store().closeWindow('finder');
        expect(store().minimizedStack).toEqual([]);
        expect(store().windows.finder.isMinimized).toBe(false);
    });
});

describe('maximize', () => {
    it('fills the screen and restores the previous bounds', () => {
        store().openWindow('finder');
        store().toggleMaximize('finder');
        expect(store().windows.finder).toMatchObject({
            isMaximized: true,
            bounds: maximizedBounds({ width: 1440, height: 900 }),
            prevBounds: { x: 128, y: 80, w: 760, h: 444 },
        });
        store().toggleMaximize('finder');
        expect(store().windows.finder).toMatchObject({
            isMaximized: false, bounds: { x: 128, y: 80, w: 760, h: 444 }, prevBounds: null,
        });
    });

    it('ignores closed windows', () => {
        store().toggleMaximize('finder');
        expect(store().windows.finder.isMaximized).toBe(false);
    });

    it('reopens a closed maximized window maximized to the current screen', () => {
        store().openWindow('finder');
        store().toggleMaximize('finder');
        store().closeWindow('finder');
        setViewport(1000, 700);
        store().openWindow('finder');
        expect(store().windows.finder).toMatchObject({
            isMaximized: true, bounds: maximizedBounds({ width: 1000, height: 700 }),
        });
    });

    it('refits maximized windows when the screen changes', () => {
        store().openWindow('finder');
        store().toggleMaximize('finder');
        setViewport(1000, 700);
        store().fitToViewport();
        expect(store().windows.finder.bounds).toEqual(maximizedBounds({ width: 1000, height: 700 }));
    });
});
