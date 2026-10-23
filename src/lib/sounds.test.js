import { describe, it, expect, vi } from 'vitest';
import { CUE_VOLUME, SOUND_NAMES, createSoundPlayer } from './sounds';

const fakeContext = () => {
    const started = [];
    const context = {
        state: 'suspended',
        destination: { name: 'speakers' },
        resume: vi.fn(() => { context.state = 'running'; return Promise.resolve(); }),
        createBufferSource: () => {
            const source = { buffer: null, connect: vi.fn(), start: vi.fn(() => started.push(source.buffer)) };
            return source;
        },
        createGain: () => ({ gain: { value: 1 }, connect: vi.fn() }),
    };
    return { context, started };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createSoundPlayer', () => {
    it('stays silent and creates no audio context before the first gesture', async () => {
        const createContext = vi.fn();
        const player = createSoundPlayer({ createContext, loadBuffer: vi.fn() });
        await player.play('startup');
        expect(createContext).not.toHaveBeenCalled();
    });

    it('creates one context on the first gesture, resumes it, and preloads every sound', async () => {
        const { context } = fakeContext();
        const createContext = vi.fn(() => context);
        const loadBuffer = vi.fn(async (_context, name) => `buffer:${name}`);
        const player = createSoundPlayer({ createContext, loadBuffer });

        player.prime();
        player.prime();
        await flush();

        expect(createContext).toHaveBeenCalledTimes(1);
        expect(context.resume).toHaveBeenCalled();
        expect(loadBuffer.mock.calls.map(([, name]) => name)).toEqual(SOUND_NAMES);
    });

    it('plays a sound at its cue volume, loading each file once', async () => {
        const { context, started } = fakeContext();
        const loadBuffer = vi.fn(async (_context, name) => `buffer:${name}`);
        const gains = [];
        const createGain = context.createGain;
        context.createGain = () => { const gain = createGain(); gains.push(gain); return gain; };
        const player = createSoundPlayer({ createContext: () => context, loadBuffer });

        player.prime();
        await player.play('minimize');
        await player.play('minimize');

        expect(started).toEqual(['buffer:minimize', 'buffer:minimize']);
        expect(gains[0].gain.value).toBe(CUE_VOLUME.minimize);
        expect(loadBuffer.mock.calls.filter(([, name]) => name === 'minimize')).toHaveLength(1);
    });

    it('stays silent when a file fails to load, then retries next time', async () => {
        const { context, started } = fakeContext();
        const loadBuffer = vi.fn(async (_context, name) => `buffer:${name}`)
            .mockRejectedValueOnce(new Error('404'));
        const player = createSoundPlayer({ createContext: () => context, loadBuffer });

        player.prime();
        await flush();
        await expect(player.play('startup')).resolves.toBeUndefined();
        await player.play('startup');
        // The failed preload was forgotten: the first play reloaded, the second reused it.
        expect(started).toEqual(['buffer:startup', 'buffer:startup']);
    });

    it('does nothing where Web Audio is missing or blocked', async () => {
        const throwing = createSoundPlayer({ createContext: () => { throw new Error('blocked'); }, loadBuffer: vi.fn() });
        expect(() => throwing.prime()).not.toThrow();
        await expect(throwing.play('startup')).resolves.toBeUndefined();

        const missing = createSoundPlayer({ createContext: () => null, loadBuffer: vi.fn() });
        expect(() => missing.prime()).not.toThrow();
        await expect(missing.play('startup')).resolves.toBeUndefined();
    });

    it('ignores unknown sounds', async () => {
        const { context, started } = fakeContext();
        const player = createSoundPlayer({ createContext: () => context, loadBuffer: vi.fn(async () => 'buffer') });
        player.prime();
        await player.play('boing');
        expect(started).toEqual([]);
    });
});
