import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Edit2, Save, X, Play, Pause, ArrowUp, ArrowDown, Check, RefreshCw } from 'lucide-react';
import { fetchTracks, createTrack, updateTrack, deleteTrack, renumberTracks } from '../../lib/tracksApi';
import { validateAudio, validateCover, canonicalAudioType, reorder, TRACK_SOFT_LIMIT } from '../../lib/musicFiles';
import { readEmbeddedCover } from '../../lib/coverImage';
import { formatTime, coverGradient } from '../../lib/music';

const inputClass = 'w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white placeholder-gray-500';
const emptyForm = { title: '', artist: '', album: '' };
// How much of a song to fetch when looking for its cover (the ID3 tag sits at the start).
const COVER_SCAN_BYTES = 8 * 1024 * 1024;

// Reads a song's length in seconds; resolves null if the browser can't decode it.
// Gives up (null) after PROBE_TIMEOUT_MS so a stuck decode can't block Save.
const PROBE_TIMEOUT_MS = 5000;
const readDuration = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    let timer = null;
    const done = (value) => {
        clearTimeout(timer);
        probe.removeAttribute('src');
        URL.revokeObjectURL(url);
        resolve(value);
    };
    timer = setTimeout(() => done(null), PROBE_TIMEOUT_MS);
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? Math.round(probe.duration) : null);
    probe.onerror = () => done(null);
    probe.src = url;
});

// A preview URL for a picked image, revoked when the file changes or on unmount.
const useObjectUrl = (file) => {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    return url;
};

const Art = ({ src, seed, size = 'w-12 h-12' }) => (
    <div
        className={`${size} rounded bg-cover bg-center shrink-0`}
        style={src ? { backgroundImage: `url(${src})` } : { background: coverGradient(seed) }}
    />
);

const MusicManager = () => {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [success, setSuccess] = useState(null);
    const [busy, setBusy] = useState(false);
    const [playingId, setPlayingId] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [audioFile, setAudioFile] = useState(null);
    const [duration, setDuration] = useState(null);
    const [probing, setProbing] = useState(false);
    const probeFile = useRef(null);
    const [coverFile, setCoverFile] = useState(null);
    const [coverSource, setCoverSource] = useState(null); // 'manual' | 'embedded' | null
    const [lookingForCover, setLookingForCover] = useState(false);
    const [coverInputKey, setCoverInputKey] = useState(0);
    const coverSourceRef = useRef(null);
    const coverPreview = useObjectUrl(coverFile);

    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState(emptyForm);
    const [editCover, setEditCover] = useState(null);
    const editPreview = useObjectUrl(editCover);
    const [scanning, setScanning] = useState(false);
    const [scanNote, setScanNote] = useState(null);
    const scanId = useRef(0);

    const previewRef = useRef(null);
    const successTimer = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            setTracks(await fetchTracks());
            setLoadFailed(false);
        } catch (err) {
            console.error('Error fetching tracks:', err);
            setLoadFailed(true);
            setError('Could not load songs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        return () => {
            clearTimeout(successTimer.current);
            previewRef.current?.pause();
            previewRef.current = null;
        };
    }, []);

    const begin = () => {
        clearTimeout(successTimer.current);
        setSuccess(null);
        setError(null);
    };

    const flash = (message) => {
        setSuccess(message);
        successTimer.current = setTimeout(() => setSuccess(null), 3000);
    };

    const stopPreview = () => {
        previewRef.current?.pause();
        setPlayingId(null);
    };

    const togglePreview = (track) => {
        if (playingId === track.id) {
            stopPreview();
            return;
        }
        if (!previewRef.current) {
            previewRef.current = new Audio();
            previewRef.current.onended = () => setPlayingId(null);
        }
        const audio = previewRef.current;
        audio.src = track.src;
        setPlayingId(track.id);
        audio.play().catch((err) => {
            // A newer preview (or a pause) interrupting this one is not a failure.
            if (err?.name === 'AbortError') return;
            console.error('Preview failed:', err);
            setPlayingId(null);
            setError('Could not play that preview.');
        });
    };

    const setAddCover = (file, source) => {
        coverSourceRef.current = source;
        setCoverSource(source);
        setCoverFile(file);
    };

    const clearCover = () => {
        setAddCover(null, null);
        setCoverInputKey((k) => k + 1);
    };

    const resetAddForm = () => {
        setShowForm(false);
        setForm(emptyForm);
        setAudioFile(null);
        setDuration(null);
        setProbing(false);
        probeFile.current = null;
        setLookingForCover(false);
        clearCover();
    };

    const pickAudio = async (e) => {
        const input = e.target;
        const file = input.files[0];
        if (!file) return;
        begin();
        const problem = validateAudio(file);
        if (problem) {
            setError(problem);
            input.value = '';
            return;
        }
        setAudioFile(file);
        setForm((current) => ({ ...current, title: current.title || file.name.replace(/\.[^.]+$/, '') }));
        setDuration(null);
        setProbing(true);
        probeFile.current = file;
        // A cover found in an earlier song's tag does not carry over to this one.
        if (coverSourceRef.current === 'embedded') clearCover();
        const lookup = canonicalAudioType(file) === 'audio/mpeg';
        setLookingForCover(lookup);
        const coverPromise = lookup ? readEmbeddedCover(file) : Promise.resolve(null);
        const seconds = await readDuration(file);
        // A newer pick (or a reset) owns the form now; drop this stale result.
        if (probeFile.current !== file) return;
        setDuration(seconds);
        setProbing(false);
        const embedded = await coverPromise;
        if (probeFile.current !== file) return;
        setLookingForCover(false);
        // A cover the admin chose by hand wins over the one in the file.
        if (embedded && coverSourceRef.current !== 'manual') setAddCover(embedded, 'embedded');
    };

    const pickCover = (e, setter) => {
        const input = e.target;
        const file = input.files[0];
        if (!file) return;
        begin();
        const problem = validateCover(file);
        if (problem) {
            setError(problem);
            input.value = '';
            return;
        }
        setter(file);
    };

    const pickAddCover = (e) => pickCover(e, (file) => setAddCover(file, 'manual'));

    const handleAdd = async () => {
        if (!audioFile || !form.title.trim() || busy || probing || lookingForCover) return;
        begin();
        setBusy(true);
        try {
            const position = tracks.length ? Math.max(...tracks.map((t) => t.order)) + 1 : 0;
            await createTrack({ ...form, audio: audioFile, cover: coverFile, duration }, position);
            resetAddForm();
            flash('Song uploaded!');
            await load();
        } catch (err) {
            console.error('Error adding track:', err);
            setError('Upload failed — check that you are signed in as the admin.');
        } finally {
            setBusy(false);
        }
    };

    const startEdit = (track) => {
        begin();
        setEditing(track.id);
        setEditForm({ title: track.title, artist: track.artist, album: track.album });
        setEditCover(null);
        setScanNote(null);
    };

    const stopEdit = () => {
        scanId.current += 1; // drops an in-flight cover scan
        setEditing(null);
        setEditForm(emptyForm);
        setEditCover(null);
        setScanning(false);
        setScanNote(null);
    };

    // Fetches the start of the stored song (the ID3 tag) and takes its cover as the pending new one.
    const scanForCover = async (track) => {
        if (busy || scanning) return;
        begin();
        setScanNote(null);
        setScanning(true);
        const id = ++scanId.current;
        let cover = null;
        let failed = false;
        try {
            const res = await fetch(track.src, { headers: { Range: `bytes=0-${COVER_SCAN_BYTES - 1}` } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            cover = await readEmbeddedCover(blob.slice(0, COVER_SCAN_BYTES));
        } catch (err) {
            console.error('Could not read the song for a cover:', err);
            failed = true;
        }
        if (scanId.current !== id) return;
        setScanning(false);
        if (cover) setEditCover(cover);
        else setScanNote(failed ? 'Could not read this file.' : 'No cover found in this file.');
    };

    const handleUpdate = async (track) => {
        if (!editForm.title.trim() || busy) return;
        begin();
        setBusy(true);
        try {
            await updateTrack(track.id, editForm, editCover, track.coverPath);
            stopEdit();
            flash('Song updated!');
            await load();
        } catch (err) {
            console.error('Error updating track:', err);
            setError('Could not save — check that you are signed in as the admin.');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (track) => {
        if (!confirm(`Delete "${track.title}"? Its audio and cover files are removed too.`)) return;
        begin();
        setBusy(true);
        try {
            if (playingId === track.id) stopPreview();
            await deleteTrack(track);
            if (editing === track.id) stopEdit();
            flash('Song deleted.');
            await load();
        } catch (err) {
            console.error('Error deleting track:', err);
            setError('Could not delete — check that you are signed in as the admin.');
        } finally {
            setBusy(false);
        }
    };

    const handleMove = async (index, step) => {
        const next = reorder(tracks, index, step);
        if (next === tracks || busy) return;
        begin();
        setBusy(true);
        try {
            await renumberTracks(next);
        } catch (err) {
            console.error('Error reordering tracks:', err);
            setError('Could not reorder — check that you are signed in as the admin.');
        } finally {
            await load();
            setBusy(false);
        }
    };

    if (loading && tracks.length === 0) {
        return <div className="text-gray-400">Loading songs...</div>;
    }

    if (loadFailed && tracks.length === 0) {
        return (
            <div className="flex items-center gap-3 text-red-400">
                <span>Could not load songs.</span>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white rounded transition-colors"
                >
                    <RefreshCw size={16} />
                    Retry
                </button>
            </div>
        );
    }

    const iconButton = 'p-2 hover:bg-[#3d3d3d] text-gray-400 hover:text-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Music</h2>
                <button
                    onClick={() => { begin(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    Add Song
                </button>
            </div>

            {success && (
                <div className="flex items-center gap-2 text-green-400">
                    <Check size={20} />
                    <span>{success}</span>
                </div>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {tracks.length > TRACK_SOFT_LIMIT && (
                <p className="text-amber-400 text-sm">
                    You have {tracks.length} songs. The free plan&apos;s 5 GB/month of downloads covers about 1,000 full plays, and more songs share that budget.
                </p>
            )}

            {showForm && (
                <div className="bg-[#252525] rounded-lg p-4 space-y-4">
                    <h3 className="text-white font-medium">New Song</h3>
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Audio file</label>
                        <input
                            type="file"
                            accept="audio/mpeg,audio/mp4,audio/aac,.mp3,.m4a,.aac"
                            onChange={pickAudio}
                            disabled={busy}
                            className="block w-full text-sm text-gray-400"
                        />
                        {audioFile && (
                            <p className="mt-1 text-gray-500 text-sm">
                                {audioFile.name}{duration ? ` · ${formatTime(duration)}` : ''}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-1">Cover image (optional)</label>
                        <div className="flex items-center gap-3">
                            {coverPreview && <Art src={coverPreview} seed="" />}
                            <input
                                key={coverInputKey}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={pickAddCover}
                                disabled={busy}
                                className="block w-full text-sm text-gray-400"
                            />
                        </div>
                        {lookingForCover && <p className="mt-1 text-gray-500 text-sm">Looking for a cover…</p>}
                        {coverFile && (
                            <p className="mt-1 text-gray-500 text-sm">
                                {coverSource === 'embedded' && <>Cover found in the file{' · '}</>}
                                <button
                                    type="button"
                                    onClick={clearCover}
                                    disabled={busy}
                                    className="text-blue-400 hover:underline disabled:opacity-50"
                                >
                                    Remove cover
                                </button>
                            </p>
                        )}
                    </div>
                    <input
                        type="text"
                        placeholder="Title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className={inputClass}
                    />
                    <input
                        type="text"
                        placeholder="Artist"
                        value={form.artist}
                        onChange={(e) => setForm({ ...form, artist: e.target.value })}
                        className={inputClass}
                    />
                    <input
                        type="text"
                        placeholder="Album"
                        value={form.album}
                        onChange={(e) => setForm({ ...form, album: e.target.value })}
                        className={inputClass}
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleAdd}
                            disabled={busy || probing || lookingForCover || !audioFile || !form.title.trim()}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {busy ? 'Uploading…' : probing ? 'Reading length…' : lookingForCover ? 'Looking for a cover…' : 'Save'}
                        </button>
                        <button
                            onClick={resetAddForm}
                            disabled={busy}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {tracks.length === 0 && !showForm && !loadFailed && (
                    <p className="text-gray-500 text-center py-8">No songs yet. The site plays its placeholder songs until you add one.</p>
                )}
                {tracks.map((track, index) => (
                    <div key={track.id} className="bg-[#252525] rounded-lg p-4">
                        {editing === track.id ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className={inputClass}
                                />
                                <input
                                    type="text"
                                    placeholder="Artist"
                                    value={editForm.artist}
                                    onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                                    className={inputClass}
                                />
                                <input
                                    type="text"
                                    placeholder="Album"
                                    value={editForm.album}
                                    onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                                    className={inputClass}
                                />
                                <div className="flex items-center gap-3">
                                    <Art src={editPreview ?? track.cover} seed={track.album || track.title} />
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(e) => pickCover(e, setEditCover)}
                                        disabled={busy}
                                        className="block w-full text-sm text-gray-400"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => scanForCover(track)}
                                        disabled={busy || scanning}
                                        className="px-3 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white text-sm rounded transition-colors disabled:opacity-50"
                                    >
                                        {scanning ? 'Looking…' : 'Use cover from the MP3'}
                                    </button>
                                    {scanNote && <span className="text-gray-400 text-sm">{scanNote}</span>}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleUpdate(track)}
                                        disabled={busy || scanning || !editForm.title.trim()}
                                        aria-label="Save"
                                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                    </button>
                                    <button
                                        onClick={stopEdit}
                                        disabled={busy}
                                        aria-label="Cancel"
                                        className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded disabled:opacity-50"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Art src={track.cover} seed={track.album || track.title} />
                                    <div className="min-w-0">
                                        <h3 className="text-white font-medium truncate">{track.title}</h3>
                                        <p className="text-sm text-gray-400 truncate">
                                            {[track.artist, track.album].filter(Boolean).join(' · ') || 'Unknown artist'}
                                            {' · '}{formatTime(track.duration)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={() => togglePreview(track)}
                                        aria-label={playingId === track.id ? 'Pause preview' : 'Play preview'}
                                        className={iconButton}
                                    >
                                        {playingId === track.id ? <Pause size={16} /> : <Play size={16} />}
                                    </button>
                                    <button
                                        onClick={() => handleMove(index, -1)}
                                        disabled={busy || index === 0}
                                        aria-label="Move up"
                                        className={iconButton}
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleMove(index, 1)}
                                        disabled={busy || index === tracks.length - 1}
                                        aria-label="Move down"
                                        className={iconButton}
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                    <button onClick={() => startEdit(track)} disabled={busy} aria-label="Edit" className={iconButton}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(track)}
                                        disabled={busy}
                                        aria-label="Delete"
                                        className="p-2 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded transition-colors disabled:opacity-30"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 bg-[#1e1e1e] rounded-lg">
                <p className="text-gray-400 text-sm">
                    <strong className="text-gray-300">Note:</strong> MP3/M4A/AAC up to 10 MB, covers JPG/PNG/WebP. Changes appear on the site after a reload.
                </p>
            </div>
        </div>
    );
};

export default MusicManager;
