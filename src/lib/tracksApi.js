import { toTrack, trackRow } from './records';
import { canonicalAudioType, trackFilePath } from './musicFiles';
import { supabase } from './supabase';

const MUSIC_BUCKET = 'music';
const CACHE_CONTROL = '31536000';

const bucket = () => supabase.storage.from(MUSIC_BUCKET);
const urlFor = (path) => bucket().getPublicUrl(path).data.publicUrl;

// RLS-blocked updates and deletes affect 0 rows without an error.
const assertWritten = (rows) => {
    if (!rows || rows.length === 0) throw new Error('Not allowed — sign in as the admin.');
};

const extensionOf = (file, fallback) => {
    const ext = String(file.name ?? '').split('.').pop().toLowerCase();
    return /^[a-z0-9]{2,5}$/.test(ext) ? ext : fallback;
};

const randomId = () => Math.random().toString(36).slice(2, 10);

// Long cacheControl lets repeat plays come from the CDN's cached egress quota.
const upload = async (kind, file, fallbackExt, contentType) => {
    const path = trackFilePath(kind, extensionOf(file, fallbackExt), Date.now(), randomId());
    const { error } = await bucket().upload(path, file, {
        contentType,
        cacheControl: CACHE_CONTROL,
        upsert: false,
    });
    if (error) throw error;
    return path;
};

// A failed removal only leaves an orphan file: log it, never fail the caller.
const removeQuietly = async (paths) => {
    const list = paths.filter(Boolean);
    if (list.length === 0) return;
    try {
        const { error } = await bucket().remove(list);
        if (error) throw error;
    } catch (err) {
        console.error('Could not remove music files:', err);
    }
};

// Read for the Music app, Spotlight and Control Center; written by the admin panel.
export const fetchTracks = async () => {
    const { data, error } = await supabase
        .from('tracks')
        .select('id, title, artist, album, audio_path, cover_path, duration, position')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data.map((row) => toTrack(row, urlFor));
};

// Upload first; if the row insert fails the uploaded files are removed again.
export const createTrack = async ({ audio, cover, duration, ...form }, position) => {
    const audioPath = await upload('audio', audio, 'mp3', canonicalAudioType(audio));
    let coverPath = null;

    try {
        if (cover) coverPath = await upload('cover', cover, 'jpg', cover.type);
        const { data, error } = await supabase
            .from('tracks')
            .insert({
                ...trackRow(form),
                audio_path: audioPath,
                cover_path: coverPath,
                duration: Number.isFinite(duration) && duration > 0 ? duration : null,
                position,
            })
            .select('id');
        if (error) throw error;
        assertWritten(data);
    } catch (err) {
        await removeQuietly([audioPath, coverPath]);
        throw err;
    }
};

// A new cover uploads first, then the row changes, then the old cover goes.
export const updateTrack = async (id, form, newCover = null, oldCoverPath = null) => {
    const row = trackRow(form);
    let coverPath = null;

    if (newCover) {
        coverPath = await upload('cover', newCover, 'jpg', newCover.type);
        row.cover_path = coverPath;
    }

    try {
        const { data, error } = await supabase.from('tracks').update(row).eq('id', id).select('id');
        if (error) throw error;
        assertWritten(data);
    } catch (err) {
        await removeQuietly([coverPath]);
        throw err;
    }

    if (coverPath && oldCoverPath) await removeQuietly([oldCoverPath]);
};

export const deleteTrack = async (track) => {
    const { data, error } = await supabase.from('tracks').delete().eq('id', track.id).select('id');
    if (error) throw error;
    assertWritten(data);

    await removeQuietly([track.audioPath, track.coverPath]);
};

// Reordering: `list` is the desired order. Every row whose position differs
// from its index is rewritten, which also heals duplicate positions.
export const renumberTracks = async (list) => {
    for (const [index, track] of list.entries()) {
        if (track.order === index) continue;
        const { data, error } = await supabase.from('tracks').update({ position: index }).eq('id', track.id).select('id');
        if (error) throw error;
        assertWritten(data);
    }
};
