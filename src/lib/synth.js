// Synthesizes the system sounds that scripts/generate-sounds.mjs writes to
// public/sounds/. Original and royalty-free; noise is seeded, so regenerating
// produces byte-identical files.

export const SAMPLE_RATE = 16000;

const length = (seconds) => Math.round(seconds * SAMPLE_RATE);
const tone = (frequency, t) => Math.sin(2 * Math.PI * frequency * t);
// Linear attack, then exponential decay with time constant `decay` (seconds).
const envelope = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

const render = (seconds, sampleAt) => {
    const samples = new Float32Array(length(seconds));
    for (let i = 0; i < samples.length; i += 1) samples[i] = sampleAt(i / SAMPLE_RATE);
    return samples;
};

// mulberry32: tiny seeded PRNG giving uniform noise in -1..1.
const seededNoise = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    };
};

// Noise through a one-pole low-pass whose cutoff sweeps from `from` to `to` Hz,
// swelling in and out.
const whoosh = (seconds, from, to, seed) => {
    const random = seededNoise(seed);
    const samples = new Float32Array(length(seconds));
    let low = 0;

    for (let i = 0; i < samples.length; i += 1) {
        const progress = i / samples.length;
        const cutoff = from + (to - from) * progress;
        const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
        low += alpha * (random() - low);
        samples[i] = low * Math.sin(Math.PI * progress);
    }
    return samples;
};

export const synthesizers = {
    // A soft C-major swell, nothing like Apple's chime.
    startup: () => render(1.3, (t) => {
        const chord = [261.63, 329.63, 392.0, 523.25];
        const sum = chord.reduce((total, frequency, i) => total + tone(frequency, t) * (1 - i * 0.15), 0);
        return sum * envelope(t, 0.06, 0.45);
    }),
    minimize: () => whoosh(0.28, 3200, 400, 1),
    restore: () => whoosh(0.28, 400, 3200, 2),
    notification: () => render(0.32, (t) => {
        const first = t < 0.14 ? tone(988, t) * envelope(t, 0.005, 0.05) : 0;
        const second = t >= 0.12 ? tone(1319, t - 0.12) * envelope(t - 0.12, 0.005, 0.07) : 0;
        return first + second;
    }),
    spotlight: () => render(0.06, (t) => tone(1800, t) * envelope(t, 0.002, 0.012)),
};

const PEAKS = { startup: 0.7, minimize: 0.6, restore: 0.6, notification: 0.6, spotlight: 0.5 };

export const renderSound = (name) => {
    const samples = synthesizers[name]();
    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0) || 1;
    return samples.map((sample) => (sample / peak) * PEAKS[name]);
};

// 16-bit mono PCM. Symmetric rounding, clamped to -1..1.
export const encodeWav = (samples, sampleRate) => {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const writeText = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));

    writeText(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    samples.forEach((sample, i) => {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(44 + i * 2, Math.sign(clamped) * Math.round(Math.abs(clamped) * 32767), true);
    });
    return bytes;
};
