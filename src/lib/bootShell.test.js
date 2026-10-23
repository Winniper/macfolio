import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOT_SEEN_KEY, SMALL_SCREEN_QUERY } from './boot';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

// index.html paints the page black before any JS runs when the boot will
// play, so the wallpaper never flashes ahead of the boot screen. Its inline
// script must decide exactly like initialBootPhase().
describe('boot shell in index.html', () => {
    it('marks the page as booting before first paint, using the same rules as boot.js', () => {
        const head = html.slice(0, html.indexOf('</head>'));
        expect(head).toContain("classList.add('booting')");
        expect(head).toContain(BOOT_SEEN_KEY);
        expect(head).toContain(SMALL_SCREEN_QUERY);
    });
});
