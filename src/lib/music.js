// Pure helpers for the Music app and its player (state lives in the system
// store; AudioController drives the <audio> element).

export const formatTime = (seconds) => {
    const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const trackById = (list, id) => list.find((track) => track.id === id) ?? null;

export const adjacentTrackId = (list, id, step) => {
    const index = list.findIndex((track) => track.id === id);
    if (index === -1) return null;
    return list[index + step]?.id ?? null;
};

export const clampVolume = (volume) => Math.min(1, Math.max(0, Number(volume) || 0));

// Songs without an album or artist still need something to show.
export const UNKNOWN_ARTIST = 'Unknown artist';
export const albumTitleOf = (track) => track.album || track.title;
export const artistOf = (track) => track.artist || UNKNOWN_ARTIST;

export const albumsOf = (list) => list.reduce((albums, track) => {
    let album = albums.find((entry) => entry.title === albumTitleOf(track));
    if (!album) {
        album = { title: albumTitleOf(track), artist: artistOf(track), cover: track.cover ?? null, tracks: [] };
        albums.push(album);
    }
    album.tracks.push(track);
    return albums;
}, []);

// Stand-in artwork until real covers exist: a gradient whose hue comes from the name.
export const coverGradient = (seed) => {
    const hue = [...String(seed)].reduce((value, char) => (value * 31 + char.charCodeAt(0)) % 360, 7);
    return `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 50) % 360} 75% 34%))`;
};

export const nowPlayingNotification = (track) => ({
    appId: 'music',
    title: 'Now Playing',
    body: track.artist ? `${track.title} — ${track.artist}` : track.title,
    action: { type: 'openApp', id: 'music' },
});
