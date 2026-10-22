import { describe, it, expect } from 'vitest';
import { switcherOrder, switcherReducer } from './switcher';

const win = (isOpen, isMinimized, zIndex) => ({ isOpen, isMinimized, zIndex });

describe('switcherOrder', () => {
    it('lists open windows, visible first, each by recency', () => {
        expect(switcherOrder({
            finder: win(true, false, 1003),
            terminal: win(true, true, 1005),
            contact: win(true, false, 1004),
            resume: win(false, false, 1000),
        })).toEqual(['contact', 'finder', 'terminal']);
    });

    it('is empty when nothing is open', () => {
        expect(switcherOrder({ finder: win(false, false, 1000) })).toEqual([]);
    });
});

describe('switcherReducer', () => {
    const order = ['contact', 'finder', 'terminal'];
    const mac = { isMac: true, order };
    const optionTab = { type: 'keydown', key: 'Tab', code: 'Tab', altKey: true, ctrlKey: false, shiftKey: false };
    const ctrlBackquote = { type: 'keydown', key: '`', code: 'Backquote', altKey: false, ctrlKey: true, shiftKey: false };
    const open = { order, index: 1, modifier: 'Alt' };

    it('opens on Option+Tab with the previous app selected', () => {
        expect(switcherReducer(null, optionTab, mac)).toEqual({ state: open, commit: null, handled: true });
    });

    it('opens on Ctrl+` off macOS', () => {
        expect(switcherReducer(null, ctrlBackquote, { isMac: false, order }).state)
            .toEqual({ order, index: 1, modifier: 'Control' });
    });

    it('selects the only app when one window is open', () => {
        expect(switcherReducer(null, optionTab, { isMac: true, order: ['finder'] }).state.index).toBe(0);
    });

    it('stays closed and lets the key through when nothing is open', () => {
        expect(switcherReducer(null, ctrlBackquote, { isMac: true, order: [] }))
            .toEqual({ state: null, commit: null, handled: false });
    });

    it('advances on Tab and wraps around', () => {
        const once = switcherReducer(open, optionTab, mac).state;
        expect(once.index).toBe(2);
        expect(switcherReducer(once, optionTab, mac).state.index).toBe(0);
    });

    it('advances on ` too', () => {
        const state = { order, index: 1, modifier: 'Control' };
        expect(switcherReducer(state, ctrlBackquote, mac).state.index).toBe(2);
    });

    it('goes back on Shift+Tab', () => {
        expect(switcherReducer(open, { ...optionTab, shiftKey: true }, mac).state.index).toBe(0);
    });

    it('switches to the selection when the modifier is released', () => {
        expect(switcherReducer(open, { type: 'keyup', key: 'Alt' }, mac))
            .toEqual({ state: null, commit: 'finder', handled: true });
    });

    it('ignores releasing other keys', () => {
        expect(switcherReducer(open, { type: 'keyup', key: 'Tab' }, mac))
            .toEqual({ state: open, commit: null, handled: false });
    });

    it('cancels on Escape without switching', () => {
        expect(switcherReducer(open, { ...optionTab, key: 'Escape', code: 'Escape' }, mac))
            .toEqual({ state: null, commit: null, handled: true });
    });

    it('cancels when the page loses focus, so it never sticks open', () => {
        expect(switcherReducer(open, { type: 'blur' }, mac))
            .toEqual({ state: null, commit: null, handled: false });
    });

    it('lets unrelated keys through while open', () => {
        expect(switcherReducer(open, { ...optionTab, key: 'a', code: 'KeyA' }, mac))
            .toEqual({ state: open, commit: null, handled: false });
    });
});
