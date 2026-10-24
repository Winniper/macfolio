import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Edit2, Save, X, Play, Pause, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { fetchTracks, createTrack, updateTrack, deleteTrack, swapTrackPositions } from '../../lib/tracksApi';
import { validateAudio, validateCover, TRACK_SOFT_LIMIT } from '../../lib/musicFiles';
import { formatTime, coverGradient } from '../../lib/music';

const inputClass = 'w-full px-3 py-2 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-white placeholder-gray-500';
const emptyForm = { title: '', artist: '', album: '' };

// Reads a song's length in seconds; resolves null if the browser can't decode it.
const readDuration = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (value) => {
        probe.removeAttribute('src');
        URL.revokeObjectURL(url);
        resolve(value);
    };
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
    const [success, setSuccess] = useState(null);
    const [busy, setBusy] = useState(false);
    const [playingId, setPlayingId] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [audioFile, setAudioFile] = useState(null);
    const [duration, setDuration] = useState(null);
    const [coverFile, setCoverFile] = useState(null);
    const coverPreview = useObjectUrl(coverFile);

    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState(emptyForm);
    const [editCover, setEditCover] = useState(null);
    const editPreview = useObjectUrl(editCover);

    const previewRef = useRef(null);
    const successTimer = useRef(null);

    const load = async () => {
        try {
            setTracks(await fetchTracks());
        } catch (err) {
            console.error('Error fetching tracks:', err);
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
            console.error('Preview failed:', err);
            setPlayingId(null);
            setError('Could not play that preview.');
        });
    };

    const resetAddForm = () => {
        setShowForm(false);
        setForm(emptyForm);
        setAudioFile(null);
        setDuration(null);
        setCoverFile(null);
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
        setDuration(await readDuration(file));
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

    const handleAdd = async () => {
        if (!audioFile || !form.title.trim() || busy) return;
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
    };

    const stopEdit = () => {
        setEditing(null);
        setEditForm(emptyForm);
        setEditCover(null);
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
            await load();
        } catch (err) {
            console.error('Error deleting track:', err);
            setError('Could not delete — check that you are signed in as the admin.');
        } finally {
            setBusy(false);
        }
    };

    const handleMove = async (index, step) => {
        const other = tracks[index + step];
        if (!other || busy) return;
        begin();
        setBusy(true);
        try {
            await swapTrackPositions(tracks[index], other);
        } catch (err) {
            console.error('Error reordering tracks:', err);
            setError('Could not reorder — check that you are signed in as the admin.');
        } finally {
            await load();
            setBusy(false);
        }
    };

    if (loading) {
        return <div className="text-gray-400">Loading songs...</div>;
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
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => pickCover(e, setCoverFile)}
                                disabled={busy}
                                className="block w-full text-sm text-gray-400"
                            />
                        </div>
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
                            disabled={busy || !audioFile || !form.title.trim()}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {busy ? 'Uploading…' : 'Save'}
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
                {tracks.length === 0 && !showForm && (
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
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleUpdate(track)}
                                        disabled={busy || !editForm.title.trim()}
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
                                    <button onClick={() => startEdit(track)} aria-label="Edit" className={iconButton}>
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
