import { useEffect, useRef } from 'react';

import { tracks } from '../../constants';
import { nowPlayingNotification, trackById } from '../../lib/music';
import useSystemStore from '../../store/system';
import useWindowStore from '../../store/window';

const audioState = () => useSystemStore.getState().audio;

// Owns the only <audio> element. The store is the source of truth: this
// mirrors it into the element (source, play/pause, volume, seeks) and mirrors
// the element's clock back (position, duration, end of track). The element's
// own `pause` event is deliberately ignored — changing `src` fires it.
const AudioController = () => {
    const audioRef = useRef(null);
    const announcedRef = useRef(null);
    const currentTrackId = useSystemStore((state) => state.audio.currentTrackId);
    const isPlaying = useSystemStore((state) => state.audio.isPlaying);
    const volume = useSystemStore((state) => state.audio.volume);
    const seekNonce = useSystemStore((state) => state.audio.seekNonce);

    useEffect(() => {
        const element = audioRef.current;
        const track = trackById(tracks, currentTrackId);
        if (!element || !track) return;

        element.src = track.src;
        element.load();
    }, [currentTrackId]);

    useEffect(() => {
        const element = audioRef.current;
        if (!element || !currentTrackId) return;

        if (isPlaying) {
            // A refused play (autoplay rules, missing file) leaves the player
            // paused; AbortError only means a newer load interrupted it.
            element.play()?.catch?.((error) => {
                if (error?.name !== 'AbortError') useSystemStore.getState().setPlaying(false);
            });
        } else {
            element.pause();
        }
    }, [isPlaying, currentTrackId]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    useEffect(() => {
        const element = audioRef.current;
        if (!element || seekNonce === 0) return;
        element.currentTime = audioState().position;
    }, [seekNonce]);

    // A track that starts while Music is closed gets a banner, once per track.
    useEffect(() => {
        if (!isPlaying || !currentTrackId || announcedRef.current === currentTrackId) return;

        announcedRef.current = currentTrackId;
        if (useWindowStore.getState().windows.music?.isOpen) return;

        const track = trackById(tracks, currentTrackId);
        if (track) useSystemStore.getState().notify(nowPlayingNotification(track));
    }, [isPlaying, currentTrackId]);

    // Hardware media keys and the OS media controls drive the same store.
    useEffect(() => {
        const session = globalThis.navigator?.mediaSession;
        if (!session) return undefined;

        const handlers = {
            play: () => useSystemStore.getState().setPlaying(true),
            pause: () => useSystemStore.getState().setPlaying(false),
            nexttrack: () => useSystemStore.getState().nextTrack(),
            previoustrack: () => useSystemStore.getState().previousTrack(),
        };

        Object.entries(handlers).forEach(([action, handler]) => {
            try {
                session.setActionHandler(action, handler);
            } catch {
                // Unsupported action: ignore.
            }
        });

        return () => Object.keys(handlers).forEach((action) => {
            try {
                session.setActionHandler(action, null);
            } catch {
                // Ignore.
            }
        });
    }, []);

    useEffect(() => {
        const session = globalThis.navigator?.mediaSession;
        const track = trackById(tracks, currentTrackId);
        if (!session || !track || typeof globalThis.MediaMetadata !== 'function') return;

        session.metadata = new globalThis.MediaMetadata({ title: track.title, artist: track.artist, album: track.album });
    }, [currentTrackId]);

    return (
        <audio
            ref={audioRef}
            preload="metadata"
            onTimeUpdate={(event) => useSystemStore.getState().setAudioPosition(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => useSystemStore.getState().setAudioDuration(event.currentTarget.duration)}
            onEnded={() => useSystemStore.getState().nextTrack()}
        />
    );
};

export default AudioController;
