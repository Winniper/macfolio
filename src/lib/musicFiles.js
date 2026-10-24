// Upload rules for the music bucket (mirrors its 10 MB / mime limits) and the
// library fallback. Pure, so it is testable without Supabase.
export const MAX_TRACK_BYTES = 10 * 1024 * 1024;
// Past this many songs the admin panel warns about the free plan's egress.
export const TRACK_SOFT_LIMIT = 5;

// Browsers report the same audio under different MIME types (or none at all),
// so an upload is judged by its canonical type, from the MIME alias or the extension.
const AUDIO_ALIASES = {
    'audio/mpeg': 'audio/mpeg',
    'audio/mp3': 'audio/mpeg',
    'audio/mp4': 'audio/mp4',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'audio/aac': 'audio/aac',
};
const AUDIO_EXTENSIONS = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac' };
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const canonicalAudioType = (file) => {
    const byType = AUDIO_ALIASES[String(file?.type ?? '').toLowerCase()];
    if (byType) return byType;
    const ext = String(file?.name ?? '').split('.').pop().toLowerCase();
    return AUDIO_EXTENSIONS[ext] ?? null;
};

const validate = (file, isAllowed, typeMessage) => {
    if (!file) return 'Choose a file first.';
    if (!isAllowed(file)) return typeMessage;
    if (!file.size) return 'That file is empty.';
    if (file.size > MAX_TRACK_BYTES) return 'That file is over 10 MB.';
    return null;
};

export const validateAudio = (file) => validate(file, canonicalAudioType, 'Songs must be MP3, M4A or AAC audio.');

export const validateCover = (file) => validate(file, (f) => COVER_TYPES.includes(f.type), 'Covers must be JPEG, PNG or WebP images.');

// `rand` is passed in so tests stay deterministic.
export const trackFilePath = (kind, ext, now, rand) =>
    `${kind === 'audio' ? 'audio' : 'covers'}/${now}-${rand}.${ext}`;

// Placeholders play only while nothing has been uploaded.
export const libraryOrPlaceholders = (fetched, placeholders) =>
    Array.isArray(fetched) && fetched.length > 0 ? fetched : placeholders;

// The list with the song at `index` moved by `delta` places; a move past either
// end returns the list unchanged.
export const reorder = (list, index, delta) => {
    const target = index + delta;
    if (index < 0 || index >= list.length || target < 0 || target >= list.length || delta === 0) return list;
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
};
