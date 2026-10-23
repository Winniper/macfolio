// Regenerates public/sounds/*.wav from src/lib/synth.js: `npm run sounds`.
// src/lib/soundFiles.test.js fails if the committed files drift from this.
import { mkdirSync, writeFileSync } from 'node:fs';

import { SAMPLE_RATE, encodeWav, renderSound } from '../src/lib/synth.js';
import { SOUND_NAMES } from '../src/lib/sounds.js';

const directory = new URL('../public/sounds/', import.meta.url);

mkdirSync(directory, { recursive: true });

SOUND_NAMES.forEach((name) => {
    const bytes = encodeWav(renderSound(name), SAMPLE_RATE);
    writeFileSync(new URL(`${name}.wav`, directory), bytes);
    console.log(`${name}.wav  ${(bytes.length / 1024).toFixed(1)} KB`);
});
