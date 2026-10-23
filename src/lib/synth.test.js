import { describe, it, expect } from 'vitest';
import { SAMPLE_RATE, encodeWav, renderSound, synthesizers } from './synth';
import { SOUND_NAMES } from './sounds';

const text = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));

describe('synthesizers', () => {
    it('has one for every system sound', () => {
        expect(Object.keys(synthesizers).sort()).toEqual([...SOUND_NAMES].sort());
    });

    it('renders short, audible, in-range sounds', () => {
        SOUND_NAMES.forEach((name) => {
            const samples = renderSound(name);
            const peak = Math.max(...samples.map(Math.abs));
            expect(samples.length / SAMPLE_RATE, name).toBeLessThan(1.5);
            expect(peak, name).toBeGreaterThan(0.1);
            expect(peak, name).toBeLessThanOrEqual(1);
        });
    });

    it('is deterministic, so regenerating gives identical files', () => {
        SOUND_NAMES.forEach((name) => {
            expect(Array.from(renderSound(name)), name).toEqual(Array.from(renderSound(name)));
        });
    });
});

describe('encodeWav', () => {
    it('writes a 16-bit mono PCM WAV', () => {
        const bytes = encodeWav(new Float32Array([0, 0.5, -0.5]), 16000);
        const view = new DataView(bytes.buffer);
        expect(bytes.length).toBe(44 + 3 * 2);
        expect(text(bytes, 0, 4)).toBe('RIFF');
        expect(view.getUint32(4, true)).toBe(36 + 6);
        expect(text(bytes, 8, 4)).toBe('WAVE');
        expect(text(bytes, 12, 4)).toBe('fmt ');
        expect(view.getUint16(20, true)).toBe(1);
        expect(view.getUint16(22, true)).toBe(1);
        expect(view.getUint32(24, true)).toBe(16000);
        expect(view.getUint32(28, true)).toBe(32000);
        expect(view.getUint16(34, true)).toBe(16);
        expect(text(bytes, 36, 4)).toBe('data');
        expect(view.getUint32(40, true)).toBe(6);
        expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([0, 16384, -16384]);
    });

    it('clamps samples outside -1..1', () => {
        const view = new DataView(encodeWav(new Float32Array([2, -2]), 16000).buffer);
        expect([view.getInt16(44, true), view.getInt16(46, true)]).toEqual([32767, -32767]);
    });
});
