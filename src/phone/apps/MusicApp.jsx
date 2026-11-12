import { useState } from 'react';
import { ChevronDown, Pause, Play, SkipBack, SkipForward, Volume1, Volume2 } from 'lucide-react';

import { albumTitleOf, artistOf, coverGradient, formatTime, trackById } from '../../lib/music';
import { volumeIsSettable } from '../../lib/volumeSupport';
import useSystemStore from '../../store/system';
import AppScreen from '../AppScreen';

const Cover = ({ track, size }) => (
    <span
        className={`phone-music-cover phone-music-cover-${size}`}
        style={track.cover ? undefined : { background: coverGradient(albumTitleOf(track)) }}
    >
        {track.cover && <img src={track.cover} alt="" />}
    </span>
);

// The range is shown at the dragged position and seeks on release, so the
// store's clock does not pull the thumb back mid-drag.
const Scrubber = ({ position, duration }) => {
    const seekTo = useSystemStore((state) => state.seekTo);
    const [dragValue, setDragValue] = useState(null);
    const shown = dragValue ?? position;

    const commit = () => {
        if (dragValue === null) return;
        seekTo(dragValue);
        setDragValue(null);
    };

    return (
        <div className="phone-music-scrubber">
            <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={Math.min(shown, duration)}
                disabled={!duration}
                aria-label="Playback position"
                style={{ '--fill': duration ? `${(Math.min(shown, duration) / duration) * 100}%` : '0%' }}
                onChange={(event) => setDragValue(Number(event.target.value))}
                onPointerUp={commit}
                onPointerCancel={commit}
                onKeyUp={commit}
                onBlur={commit}
            />
            <div className="phone-music-times">
                <span>{formatTime(shown)}</span>
                <span>-{formatTime(duration - shown)}</span>
            </div>
        </div>
    );
};

const NowPlaying = ({ track, onClose }) => {
    const audio = useSystemStore((state) => state.audio);
    const togglePlay = useSystemStore((state) => state.togglePlay);
    const nextTrack = useSystemStore((state) => state.nextTrack);
    const previousTrack = useSystemStore((state) => state.previousTrack);
    const setVolume = useSystemStore((state) => state.setVolume);
    const duration = audio.duration || track.duration || 0;

    return (
        <div className="phone-music-sheet" role="dialog" aria-label="Now Playing">
            <button type="button" className="phone-music-close" aria-label="Close Now Playing" onClick={onClose}>
                <ChevronDown size={30} aria-hidden="true" />
            </button>
            <Cover track={track} size="xl" />
            <div className="phone-music-meta">
                <p className="phone-music-title">{track.title}</p>
                <p className="phone-music-artist">{artistOf(track)}</p>
            </div>
            <Scrubber position={Math.min(audio.position, duration)} duration={duration} />
            <div className="phone-music-transport">
                <button type="button" aria-label="Previous" onClick={previousTrack}>
                    <SkipBack size={34} fill="currentColor" aria-hidden="true" />
                </button>
                <button type="button" className="is-main" aria-label={audio.isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                    {audio.isPlaying
                        ? <Pause size={46} fill="currentColor" aria-hidden="true" />
                        : <Play size={46} fill="currentColor" aria-hidden="true" />}
                </button>
                <button type="button" aria-label="Next" onClick={nextTrack}>
                    <SkipForward size={34} fill="currentColor" aria-hidden="true" />
                </button>
            </div>
            {volumeIsSettable() && (
                <label className="phone-music-volume">
                    <Volume1 size={18} aria-hidden="true" />
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={audio.volume}
                        aria-label="Volume"
                        style={{ '--fill': `${audio.volume * 100}%` }}
                        onChange={(event) => setVolume(Number(event.target.value))}
                    />
                    <Volume2 size={18} aria-hidden="true" />
                </label>
            )}
        </div>
    );
};

const MusicApp = () => {
    const library = useSystemStore((state) => state.library);
    const audio = useSystemStore((state) => state.audio);
    const playTrack = useSystemStore((state) => state.playTrack);
    const togglePlay = useSystemStore((state) => state.togglePlay);
    const nextTrack = useSystemStore((state) => state.nextTrack);
    const [sheetOpen, setSheetOpen] = useState(false);
    const current = trackById(library, audio.currentTrackId);

    const play = (id) => {
        playTrack(id);
        setSheetOpen(true);
    };

    const miniPlayer = current && (
        <div className="phone-music-mini">
            <button type="button" className="phone-music-mini-open" onClick={() => setSheetOpen(true)}>
                <Cover track={current} size="sm" />
                <span className="phone-music-mini-title">{current.title}</span>
            </button>
            <button type="button" aria-label={audio.isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                {audio.isPlaying
                    ? <Pause size={24} fill="currentColor" aria-hidden="true" />
                    : <Play size={24} fill="currentColor" aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Next" onClick={nextTrack}>
                <SkipForward size={24} fill="currentColor" aria-hidden="true" />
            </button>
        </div>
    );

    return (
        <div className="phone-music">
            <AppScreen title="Music" toolbar={miniPlayer}>
                {library.length === 0 ? (
                    <p className="phone-empty">No songs yet.</p>
                ) : (
                    <ul className="phone-group">
                        {library.map((track) => (
                            <li key={track.id}>
                                <button
                                    type="button"
                                    className={`phone-row phone-music-row${track.id === audio.currentTrackId ? ' is-current' : ''}`}
                                    onClick={() => play(track.id)}
                                >
                                    <Cover track={track} size="sm" />
                                    <span className="phone-music-row-text">
                                        <span className="phone-music-row-title">{track.title}</span>
                                        <span className="phone-music-row-artist">{artistOf(track)}</span>
                                    </span>
                                    <span className="phone-row-value">{formatTime(track.duration)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </AppScreen>
            {sheetOpen && current && <NowPlaying track={current} onClose={() => setSheetOpen(false)} />}
        </div>
    );
};

export default MusicApp;
