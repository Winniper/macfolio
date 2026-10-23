import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MENU_BAR_HEIGHT } from './bounds';

const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

// Windows (bounds.js), the menu bar, notification banners and Control Center
// all depend on one menu-bar height; the CSS variable must match the JS one.
describe('menu bar height', () => {
    it('is the same in CSS and in bounds.js', () => {
        expect(css).toMatch(new RegExp(`--menu-bar-height:\\s*${MENU_BAR_HEIGHT}px;`));
    });

    it('positions the nav, banners and Control Center from that variable', () => {
        const rule = (selector) => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)));
        expect(rule('.notifications')).toMatch(/top:\s*calc\(var\(--menu-bar-height\)/);
        expect(rule('.control-center')).toMatch(/top:\s*calc\(var\(--menu-bar-height\)/);
        expect(css).toMatch(/nav \{[^}]*height:\s*var\(--menu-bar-height\)/);
    });
});
