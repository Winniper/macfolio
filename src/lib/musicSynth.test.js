import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PIECES, renderPiece } from './musicSynth';
import { SAMPLE_RATE, encodeWav } from './synth';
import { tracks } from '../constants';

const filePath = (src) => fileURLToPath(new URL(`../../public${src}`, import.meta.url));

describe('placeholder music', () => {
    it('has a piece for every track, as long as the track says, audible and in range', () => {
        expect(Object.keys(PIECES).sort()).toEqual(tracks.map((track) => track.id).sort());
        tracks.forEach((track) => {
            const samples = renderPiece(track.id);
            const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
            expect(samples.length / SAMPLE_RATE, track.id).toBeCloseTo(track.duration, 3);
            expect(peak, track.id).toBeGreaterThan(0.3);
            expect(peak, track.id).toBeLessThanOrEqual(1);
        });
    });

    it('is deterministic', () => {
        const id = tracks[0].id;
        expect(renderPiece(id)).toEqual(renderPiece(id));
    });

    it('matches the committed files (npm run music), each under 600 KB', () => {
        tracks.forEach((track) => {
            expect(statSync(filePath(track.src)).size, track.id).toBeLessThan(600 * 1024);
            expect(new Uint8Array(readFileSync(filePath(track.src))), track.id)
                .toEqual(encodeWav(renderPiece(track.id), SAMPLE_RATE));
        });
    });
});
