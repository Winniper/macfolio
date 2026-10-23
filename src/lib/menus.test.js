import { describe, it, expect } from 'vitest';
import { DESKTOP_TITLE, buildMenuBar, clampMenuPosition, desktopMenuItems } from './menus';
import { buildWindowConfig } from '../constants/apps';

const windowsWith = (open = {}) => {
    const windows = buildWindowConfig();
    Object.entries(open).forEach(([id, patch]) => Object.assign(windows[id], { isOpen: true }, patch));
    return windows;
};
const bar = (options = {}) =>
    buildMenuBar({ focusedId: null, windows: windowsWith(), isMac: true, hasSelection: false, ...options });
const menu = (menuBar, id) => menuBar.menus.find((m) => m.id === id);
const item = (menuBar, id, label) => menu(menuBar, id).items.find((i) => i.label === label);
const labels = (items) => items.filter((i) => !i.separator).map((i) => i.label);

describe('buildMenuBar', () => {
    it('names the desktop when no window is focused', () => {
        expect(menu(bar(), 'app')).toMatchObject({ title: DESKTOP_TITLE, bold: true });
    });

    it('names the focused app', () => {
        expect(menu(bar({ focusedId: 'terminal', windows: windowsWith({ terminal: {} }) }), 'app').title).toBe('Skills');
    });

    it('offers About This Mac, Restart and Lock Screen in the Apple menu', () => {
        expect(bar().apple.filter((i) => !i.separator).map((i) => [i.label, i.action])).toEqual([
            ['About This Mac', { type: 'openApp', id: 'about' }],
            ['Restart…', { type: 'restart' }],
            ['Lock Screen', { type: 'lock' }],
        ]);
    });

    it('offers to close the focused app, or About This Mac on the desktop', () => {
        const focused = bar({ focusedId: 'terminal', windows: windowsWith({ terminal: {} }) });
        expect(menu(focused, 'app').items.map((i) => [i.label, i.action])).toEqual([
            ['Close Skills', { type: 'close', id: 'terminal' }],
        ]);
        expect(menu(bar(), 'app').items.map((i) => i.action)).toEqual([{ type: 'openApp', id: 'about' }]);
    });

    it('adds New Tab to the File menu only for Safari', () => {
        expect(labels(menu(bar({ focusedId: 'safari', windows: windowsWith({ safari: {} }) }), 'file').items))
            .toEqual(['New Tab', 'Close Window']);
        expect(labels(menu(bar({ focusedId: 'finder', windows: windowsWith({ finder: {} }) }), 'file').items))
            .toEqual(['Close Window']);
    });

    it('disables window commands when nothing is focused', () => {
        const menuBar = bar();
        expect(item(menuBar, 'window', 'Minimize').disabled).toBe(true);
        expect(item(menuBar, 'window', 'Zoom').disabled).toBe(true);
        expect(item(menuBar, 'file', 'Close Window').disabled).toBe(true);
    });

    it('points window commands at the focused window', () => {
        const menuBar = bar({ focusedId: 'finder', windows: windowsWith({ finder: {} }) });
        expect(item(menuBar, 'window', 'Minimize')).toMatchObject({ disabled: false, action: { type: 'minimize', id: 'finder' } });
        expect(item(menuBar, 'window', 'Zoom').action).toEqual({ type: 'zoom', id: 'finder' });
        expect(item(menuBar, 'file', 'Close Window').action).toEqual({ type: 'close', id: 'finder' });
    });

    it('lists open windows in the Window menu and checks the focused one', () => {
        const menuBar = bar({
            focusedId: 'resume',
            windows: windowsWith({ finder: {}, resume: {}, contact: { isMinimized: true } }),
        });
        const list = menu(menuBar, 'window').items.filter((i) => i.action?.type === 'focusApp');
        expect(list.map((i) => [i.label, i.checked])).toEqual([
            ['Projects', false],
            ['Contact', false],
            ['Resume', true],
        ]);
    });

    it('enables Copy only while text is selected', () => {
        expect(item(bar(), 'edit', 'Copy')).toMatchObject({ disabled: true, action: { type: 'copySelection' } });
        expect(item(bar({ hasSelection: true }), 'edit', 'Copy').disabled).toBe(false);
    });

    it('only shows shortcuts that work on this platform', () => {
        expect(item(bar({ isMac: true }), 'window', 'Mission Control').shortcut).toBeUndefined();
        expect(item(bar({ isMac: false }), 'window', 'Mission Control').shortcut).toBe('⌃↑');
        expect(item(bar({ isMac: true }), 'help', 'Switch apps')).toMatchObject({ shortcut: '⌥⇥  ⌃`', disabled: true });
        expect(item(bar({ isMac: false }), 'help', 'Switch apps').shortcut).toBe('⌃`');
    });

    it('opens apps from the Go menu and Contact from Help', () => {
        expect(menu(bar(), 'go').items.map((i) => [i.label, i.action])).toEqual([
            ['Projects', { type: 'openApp', id: 'finder' }],
            ['Safari', { type: 'openApp', id: 'safari' }],
            ['Resume', { type: 'openApp', id: 'resume' }],
            ['Contact', { type: 'openApp', id: 'contact' }],
        ]);
        expect(item(bar(), 'help', 'Contact Debaditya').action).toEqual({ type: 'openApp', id: 'contact' });
    });
});

describe('desktopMenuItems', () => {
    it('offers Open Terminal, Clean Up and About This Mac on the wallpaper', () => {
        expect(desktopMenuItems.filter((i) => !i.separator).map((i) => [i.label, i.action])).toEqual([
            ['Open Terminal', { type: 'openApp', id: 'terminal' }],
            ['Clean Up', { type: 'cleanUp' }],
            ['About This Mac', { type: 'openApp', id: 'about' }],
        ]);
    });
});

describe('clampMenuPosition', () => {
    const viewport = { width: 1440, height: 900 };
    const size = { w: 220, h: 120 };

    it('keeps a menu that fits where it was opened', () => {
        expect(clampMenuPosition({ x: 300, y: 200 }, size, viewport)).toEqual({ x: 300, y: 200 });
    });

    it('pulls a menu back on screen near the right and bottom edges', () => {
        expect(clampMenuPosition({ x: 1400, y: 880 }, size, viewport)).toEqual({ x: 1216, y: 776 });
    });

    it('never goes past the top-left margin', () => {
        expect(clampMenuPosition({ x: -10, y: 0 }, size, { width: 200, height: 100 })).toEqual({ x: 4, y: 4 });
    });
});
