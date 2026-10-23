// System sounds over Web Audio. Silent until the first user gesture primes it
// (browser autoplay rules), and never throws: no Web Audio, a blocked context
// or a missing file just means no sound.

export const SOUND_NAMES = ['startup', 'minimize', 'restore', 'notification', 'spotlight'];

export const CUE_VOLUME = { startup: 0.5, minimize: 0.35, restore: 0.35, notification: 0.4, spotlight: 0.25 };

const defaultCreateContext = () => {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return AudioContext ? new AudioContext() : null;
};

const defaultLoadBuffer = async (context, name) => {
    const response = await fetch(`/sounds/${name}.wav`);
    if (!response.ok) throw new Error(`Missing sound: ${name}`);
    return context.decodeAudioData(await response.arrayBuffer());
};

export const createSoundPlayer = ({ createContext = defaultCreateContext, loadBuffer = defaultLoadBuffer } = {}) => {
    let context = null;
    let unavailable = false;
    const buffers = new Map();

    // A failed load is forgotten so the next play retries it.
    const load = (name) => {
        if (!buffers.has(name)) {
            const pending = loadBuffer(context, name);
            buffers.set(name, pending);
            pending.catch(() => buffers.delete(name));
        }
        return buffers.get(name);
    };

    return {
        // Call from a user gesture (pointerdown/pointerup/click/keydown): creates the context
        // once, resumes it if the browser suspended it, and preloads every sound.
        prime() {
            if (unavailable) return;

            if (!context) {
                try {
                    context = createContext();
                } catch {
                    context = null;
                }
                if (!context) {
                    unavailable = true;
                    return;
                }
                SOUND_NAMES.forEach((name) => load(name).catch(() => {}));
            }

            if (context.state !== 'running') context.resume?.().catch?.(() => {});
        },

        async play(name, volume = CUE_VOLUME[name]) {
            // A cue that can't sound now is dropped, not queued on a frozen clock
            // (it would burst out on the next tap).
            if (!context || context.state !== 'running' || !SOUND_NAMES.includes(name)) return;

            try {
                const buffer = await load(name);
                const source = context.createBufferSource();
                const gain = context.createGain();

                source.buffer = buffer;
                gain.gain.value = volume;
                source.connect(gain);
                gain.connect(context.destination);
                source.start(0);
            } catch {
                // Missing or undecodable file: stay silent.
            }
        },
    };
};

// Shared by SoundEffects; creating it touches no browser API.
export const systemSounds = createSoundPlayer();
