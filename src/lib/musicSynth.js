// Placeholder songs for the Music app: short, original loops (pad + arpeggio +
// bass over four chords) written to public/music/ by scripts/generate-music.mjs.
// Deterministic, so regenerating gives byte-identical files.
import { SAMPLE_RATE } from './synth.js';

// Chords as semitones from A3 (220 Hz): C=[3,7,10], G=[-2,2,5], Am=[0,3,7], F=[-4,0,3], Dm=[-7,-4,0], D=[5,9,12].
export const PIECES = {
    'first-light': { seconds: 18, bpm: 84, chords: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]] },
    'night-shift': { seconds: 18, bpm: 72, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-2, 2, 5]] },
    'paper-planes': { seconds: 18, bpm: 96, chords: [[5, 9, 12], [3, 7, 10], [0, 3, 7], [-2, 2, 5]] },
};

const frequency = (semitones) => 220 * 2 ** (semitones / 12);
const sine = (semitones, t) => Math.sin(2 * Math.PI * frequency(semitones) * t);

export const renderPiece = (id) => {
    const { seconds, bpm, chords } = PIECES[id];
    const beat = 60 / bpm;
    const bar = beat * 4;
    const step = beat / 2;
    const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE));

    for (let i = 0; i < samples.length; i += 1) {
        const t = i / SAMPLE_RATE;
        const chord = chords[Math.floor(t / bar) % chords.length];
        // Short fades at bar edges hide the chord change.
        const barPosition = (t % bar) / bar;
        const barFade = Math.min(1, barPosition / 0.04, (1 - barPosition) / 0.04);
        const pad = chord.reduce((sum, note) => sum + sine(note, t), 0) / chord.length;

        const stepIndex = Math.floor(t / step);
        const intoStep = t - stepIndex * step;
        const arpeggio = sine(chord[stepIndex % chord.length] + 12, t) * Math.min(1, intoStep / 0.005) * Math.exp(-intoStep / 0.18) * Math.min(1, (step - intoStep) / 0.01);
        const bass = sine(chord[0] - 12, t);

        const fade = Math.min(1, t / 1.5, (seconds - t) / 1.5);
        samples[i] = (0.35 * pad * barFade + 0.4 * arpeggio + 0.25 * bass * barFade) * fade;
    }

    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0) || 1;
    return samples.map((sample) => (sample / peak) * 0.6);
};
