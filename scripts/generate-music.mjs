// Regenerates the placeholder songs in public/music/: `npm run music`.
// src/lib/musicSynth.test.js fails if the committed files drift from this.
import { mkdirSync, writeFileSync } from 'node:fs';

import { PIECES, renderPiece } from '../src/lib/musicSynth.js';
import { SAMPLE_RATE, encodeWav } from '../src/lib/synth.js';

const directory = new URL('../public/music/', import.meta.url);

mkdirSync(directory, { recursive: true });

Object.keys(PIECES).forEach((id) => {
    const bytes = encodeWav(renderPiece(id), SAMPLE_RATE);
    writeFileSync(new URL(`${id}.wav`, directory), bytes);
    console.log(`${id}.wav  ${(bytes.length / 1024).toFixed(1)} KB`);
});
