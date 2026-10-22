import { describe, it, expect, beforeEach } from 'vitest';
import useWindowStore, { createInitialWindowState } from './window';
import { INITIAL_Z_INDEX } from '../constants/apps';

const store = () => useWindowStore.getState();

beforeEach(() => {
    useWindowStore.setState(createInitialWindowState());
});

describe('window store', () => {
    it('starts with every window closed and nothing focused', () => {
        expect(store().focusedId).toBeNull();
        Object.values(store().windows).forEach((w) => expect(w.isOpen).toBe(false));
    });

    it('opens a window on top and focuses it', () => {
        store().openWindow('finder', { folder: 'projects' });
        const w = store().windows.finder;
        expect(w).toEqual({ isOpen: true, zIndex: INITIAL_Z_INDEX + 1, data: { folder: 'projects' } });
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
        expect(store().windows.terminal).toEqual({ isOpen: false, zIndex: INITIAL_Z_INDEX, data: null });
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
        expect(store().windows).toEqual(before.windows);
        expect(store().nextZIndex).toBe(before.nextZIndex);
    });
});
