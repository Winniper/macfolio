import { useMemo, useState } from 'react';
import { Disc3, ListMusic, Pause, Play, Radio, SkipBack, SkipForward, Volume1, Volume2 } from 'lucide-react';

import { tracks } from '../constants';
import WindowControls from '../components/WindowControl';
import WindowWrapper from '../hoc/WindowWrapper';
import { albumsOf, coverGradient, formatTime, trackById } from '../lib/music';
import useSystemStore from '../store/system';

const Cover = ({ title, cover, size }) => (
    <span
        className={`music-cover music-cover-${size}`}
        style={cover || !title ? undefined : { background: coverGradient(title) }}
    >
        {cover && <img src={cover} alt="" />}
    </span>
);

// Transport, LCD (cover, title, scrubber) and volume; doubles as the title bar.
const PlayerBar = () => {
    const audio = useSystemStore((state) => state.audio);
    const togglePlay = useSystemStore((state) => state.togglePlay);
    const nextTrack = useSystemStore((state) => state.nextTrack);
    const previousTrack = useSystemStore((state) => state.previousTrack);
    const seekTo = useSystemStore((state) => state.seekTo);
    const setVolume = useSystemStore((state) => state.setVolume);
    const track = trackById(tracks, audio.currentTrackId);
    const duration = audio.duration || track?.duration || 0;
    const position = Math.min(audio.position, duration);

    return (
        <div className="music-player" data-titlebar>
            <WindowControls target="music" />

            <div className="music-transport">
                <button type="button" aria-label="Previous" disabled={!track} onClick={previousTrack}><SkipBack /></button>
                <button type="button" className="music-play" aria-label={audio.isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                    {audio.isPlaying ? <Pause /> : <Play />}
                </button>
                <button type="button" aria-label="Next" disabled={!track} onClick={nextTrack}><SkipForward /></button>
            </div>

            <div className="music-lcd">
                <Cover title={track?.album} cover={track?.cover} size="sm" />
                <div className="music-lcd-info">
                    {track ? (
                        <>
                            <p className="music-lcd-title">{track.title}</p>
                            <p className="music-lcd-artist">{track.artist} — {track.album}</p>
                        </>
                    ) : (
                        <p className="music-lcd-title">Not Playing</p>
                    )}
                    <div className="music-scrubber">
                        <span>{formatTime(position)}</span>
                        <input
                            type="range"
                            min={0}
                            max={duration}
                            step={0.1}
                            value={position}
                            disabled={!track}
                            aria-label="Playback position"
                            onChange={(event) => seekTo(Number(event.target.value))}
                        />
                        <span>-{formatTime(duration - position)}</span>
                    </div>
                </div>
            </div>

            <label className="music-volume">
                <Volume1 aria-hidden="true" />
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={audio.volume}
                    aria-label="Volume"
                    onChange={(event) => setVolume(Number(event.target.value))}
                />
                <Volume2 aria-hidden="true" />
            </label>
        </div>
    );
};

const SongTable = ({ list }) => {
    const currentTrackId = useSystemStore((state) => state.audio.currentTrackId);
    const playTrack = useSystemStore((state) => state.playTrack);

    return (
        <table className="music-songs">
            <thead>
                <tr><th>Title</th><th>Artist</th><th>Album</th><th>Time</th></tr>
            </thead>
            <tbody>
                {list.map((track) => (
                    <tr key={track.id} className={track.id === currentTrackId ? 'is-current' : undefined}>
                        <td>
                            <button type="button" onClick={() => playTrack(track.id)}>
                                <Cover title={track.album} cover={track.cover} size="xs" />
                                {track.title}
                            </button>
                        </td>
                        <td>{track.artist}</td>
                        <td>{track.album}</td>
                        <td>{formatTime(track.duration)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const AlbumGrid = ({ albums, onOpen }) => (
    <div className="music-albums">
        {albums.map((album) => (
            <button key={album.title} type="button" className="music-album" onClick={() => onOpen(album.title)}>
                <Cover title={album.title} cover={album.cover} size="lg" />
                <span className="music-album-title">{album.title}</span>
                <span className="music-album-artist">{album.artist}</span>
            </button>
        ))}
    </div>
);

const LIBRARY = [
    { id: 'songs', label: 'Songs', icon: ListMusic },
    { id: 'albums', label: 'Albums', icon: Disc3 },
];

const Music = () => {
    const playTrack = useSystemStore((state) => state.playTrack);
    const [view, setView] = useState({ id: 'listenNow' });
    const albums = useMemo(() => albumsOf(tracks), []);
    const openAlbum = (title) => setView({ id: 'album', album: title });
    const album = albums.find((entry) => entry.title === view.album);

    const sidebarButton = (id, label, icon) => {
        const Icon = icon;

        return (
            <button
                key={id}
                type="button"
                className={`music-nav-item${view.id === id ? ' is-active' : ''}`}
                onClick={() => setView({ id })}
            >
                <Icon aria-hidden="true" /> {label}
            </button>
        );
    };

    return (
        <div className="music">
            <PlayerBar />

            <div className="music-main">
                <aside className="music-sidebar">
                    {sidebarButton('listenNow', 'Listen Now', Radio)}
                    <p className="music-sidebar-heading">Library</p>
                    {LIBRARY.map(({ id, label, icon }) => sidebarButton(id, label, icon))}
                </aside>

                <div className="music-content">
                    {view.id === 'listenNow' && (
                        <>
                            <h2 className="music-heading">Listen Now</h2>
                            <p className="music-subheading">Top Picks</p>
                            <AlbumGrid albums={albums} onOpen={openAlbum} />
                        </>
                    )}
                    {view.id === 'songs' && (
                        <>
                            <h2 className="music-heading">Songs</h2>
                            <SongTable list={tracks} />
                        </>
                    )}
                    {view.id === 'albums' && (
                        <>
                            <h2 className="music-heading">Albums</h2>
                            <AlbumGrid albums={albums} onOpen={openAlbum} />
                        </>
                    )}
                    {view.id === 'album' && album && (
                        <>
                            <div className="music-album-header">
                                <Cover title={album.title} cover={album.cover} size="xl" />
                                <div>
                                    <h2 className="music-heading">{album.title}</h2>
                                    <p className="music-subheading">{album.artist}</p>
                                    <button type="button" className="music-play-album" onClick={() => playTrack(album.tracks[0].id)}>
                                        <Play aria-hidden="true" /> Play
                                    </button>
                                </div>
                            </div>
                            <SongTable list={album.tracks} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const MusicWindow = WindowWrapper(Music, 'music');
export default MusicWindow;
