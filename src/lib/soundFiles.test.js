import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE, encodeWav, renderSound } from './synth';
import { SOUND_NAMES } from './sounds';

const soundPath = (name) => fileURLToPath(new URL(`../../public/sounds/${name}.wav`, import.meta.url));

describe('committed sound files', () => {
    it('exist, stay under 50 KB, and match the generator (npm run sounds)', () => {
        SOUND_NAMES.forEach((name) => {
            expect(statSync(soundPath(name)).size, name).toBeLessThan(50 * 1024);
            expect(new Uint8Array(readFileSync(soundPath(name))), name).toEqual(encodeWav(renderSound(name), SAMPLE_RATE));
        });
    });
});
