// Upload rules for the music bucket (mirrors its 10 MB / mime limits) and the
// library fallback. Pure, so it is testable without Supabase.
export const MAX_TRACK_BYTES = 10 * 1024 * 1024;
// Past this many songs the admin panel warns about the free plan's egress.
export const TRACK_SOFT_LIMIT = 5;

const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac'];
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const validate = (file, types, typeMessage) => {
    if (!file) return 'Choose a file first.';
    if (!types.includes(file.type)) return typeMessage;
    if (!file.size) return 'That file is empty.';
    if (file.size > MAX_TRACK_BYTES) return 'That file is over 10 MB.';
    return null;
};

export const validateAudio = (file) => validate(file, AUDIO_TYPES, 'Songs must be MP3, M4A or AAC audio.');

export const validateCover = (file) => validate(file, COVER_TYPES, 'Covers must be JPEG, PNG or WebP images.');

// `rand` is passed in so tests stay deterministic.
export const trackFilePath = (kind, ext, now, rand) =>
    `${kind === 'audio' ? 'audio' : 'covers'}/${now}-${rand}.${ext}`;

// Placeholders play only while nothing has been uploaded.
export const libraryOrPlaceholders = (fetched, placeholders) =>
    Array.isArray(fetched) && fetched.length > 0 ? fetched : placeholders;
