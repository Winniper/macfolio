import { useEffect, useRef, useState } from 'react';
import { BellRing, Bluetooth, Moon, Pause, Play, Radio, SkipBack, SkipForward, Sun, Volume2, Wifi } from 'lucide-react';

import { tracks } from '../../constants';
import { getApp } from '../../constants/apps';
import { runMenuAction } from '../../lib/menuActions';
import { coverGradient, trackById } from '../../lib/music';
import useSystemStore from '../../store/system';

const Toggle = ({ icon, label, detail, active, onClick }) => {
    const Icon = icon;
    return (
    <button type="button" className={`cc-toggle${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onClick}>
        <span className="cc-toggle-icon"><Icon aria-hidden="true" /></span>
        <span className="cc-toggle-text">
            <span className="cc-toggle-label">{label}</span>
            {detail && <span className="cc-toggle-detail">{detail}</span>}
        </span>
    </button>
    );
};

const Slider = ({ icon, label, min, max, value, onChange }) => {
    const Icon = icon;
    return (
    <div className="cc-module">
        <p className="cc-module-title">{label}</p>
        <label className="cc-slider">
            <Icon aria-hidden="true" />
            <input type="range" min={min} max={max} step={0.01} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
        </label>
    </div>
    );
};

const ControlCenterPanel = () => {
    const panelRef = useRef(null);
    const closeControlCenter = useSystemStore((state) => state.closeControlCenter);
    const brightness = useSystemStore((state) => state.brightness);
    const setBrightness = useSystemStore((state) => state.setBrightness);
    const focusMode = useSystemStore((state) => state.focusMode);
    const setFocusMode = useSystemStore((state) => state.setFocusMode);
    const soundEffects = useSystemStore((state) => state.soundEffects);
    const setSoundEffects = useSystemStore((state) => state.setSoundEffects);
    const audio = useSystemStore((state) => state.audio);
    const setVolume = useSystemStore((state) => state.setVolume);
    const togglePlay = useSystemStore((state) => state.togglePlay);
    const nextTrack = useSystemStore((state) => state.nextTrack);
    const previousTrack = useSystemStore((state) => state.previousTrack);
    const history = useSystemStore((state) => state.notificationHistory);
    const clearNotificationHistory = useSystemStore((state) => state.clearNotificationHistory);
    // Decorative, like the spec says: they only flip their look.
    const [radios, setRadios] = useState({ wifi: true, bluetooth: true, airdrop: false });
    const track = trackById(tracks, audio.currentTrackId);

    // Close on a press outside (the menu-bar icon toggles on its own), Esc, or leaving the page.
    useEffect(() => {
        const handlePointerDown = (event) => {
            if (panelRef.current?.contains(event.target)) return;
            if (event.target.closest?.('[data-control-center-toggle]')) return;
            closeControlCenter();
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') closeControlCenter();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', closeControlCenter);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', closeControlCenter);
        };
    }, [closeControlCenter]);

    const flip = (key) => setRadios((current) => ({ ...current, [key]: !current[key] }));

    const openNotification = (notification) => {
        closeControlCenter();
        if (notification.action) runMenuAction(notification.action);
    };

    return (
        <div ref={panelRef} className="control-center" role="dialog" aria-label="Control Center">
            <div className="cc-row">
                <div className="cc-module cc-radios">
                    <Toggle icon={Wifi} label="Wi-Fi" detail={radios.wifi ? 'Home' : 'Off'} active={radios.wifi} onClick={() => flip('wifi')} />
                    <Toggle icon={Bluetooth} label="Bluetooth" detail={radios.bluetooth ? 'On' : 'Off'} active={radios.bluetooth} onClick={() => flip('bluetooth')} />
                    <Toggle icon={Radio} label="AirDrop" detail={radios.airdrop ? 'Contacts Only' : 'Off'} active={radios.airdrop} onClick={() => flip('airdrop')} />
                </div>
                <div className="cc-column">
                    <div className="cc-module">
                        <Toggle icon={Moon} label="Focus" detail={focusMode ? 'On' : 'Off'} active={focusMode} onClick={() => setFocusMode(!focusMode)} />
                    </div>
                    <div className="cc-module">
                        <Toggle icon={BellRing} label="Sound Effects" detail={soundEffects ? 'On' : 'Off'} active={soundEffects} onClick={() => setSoundEffects(!soundEffects)} />
                    </div>
                </div>
            </div>

            <Slider icon={Sun} label="Display" min={0.3} max={1} value={brightness} onChange={setBrightness} />
            <Slider icon={Volume2} label="Sound" min={0} max={1} value={audio.volume} onChange={setVolume} />

            <div className="cc-module cc-now-playing">
                <span className="cc-cover" style={track && !track.cover ? { background: coverGradient(track.album) } : undefined}>
                    {track?.cover && <img src={track.cover} alt="" />}
                </span>
                <span className="cc-now-playing-text">
                    <span className="cc-toggle-label">{track ? track.title : 'Not Playing'}</span>
                    {track && <span className="cc-toggle-detail">{track.artist}</span>}
                </span>
                <span className="cc-transport">
                    <button type="button" aria-label="Previous" disabled={!track} onClick={previousTrack}><SkipBack /></button>
                    <button type="button" aria-label={audio.isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                        {audio.isPlaying ? <Pause /> : <Play />}
                    </button>
                    <button type="button" aria-label="Next" disabled={!track} onClick={nextTrack}><SkipForward /></button>
                </span>
            </div>

            <div className="cc-module cc-history">
                <div className="cc-history-head">
                    <p className="cc-module-title">Notifications</p>
                    {history.length > 0 && (
                        <button type="button" className="cc-clear" onClick={clearNotificationHistory}>Clear</button>
                    )}
                </div>
                {history.length === 0 ? (
                    <p className="cc-empty">No Notifications</p>
                ) : (
                    [...history].reverse().slice(0, 5).map((notification) => (
                        <button key={notification.id} type="button" className="cc-history-item" onClick={() => openNotification(notification)}>
                            <img src={getApp(notification.appId)?.icon ?? '/images/about.svg'} alt="" />
                            <span className="cc-now-playing-text">
                                <span className="cc-toggle-label">{notification.title}</span>
                                {notification.body && <span className="cc-toggle-detail">{notification.body}</span>}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

// Mounts only while open, so the decorative toggles reset each time — like a
// panel that re-reads system state.
const ControlCenter = () => {
    const open = useSystemStore((state) => state.controlCenterOpen);
    return open ? <ControlCenterPanel /> : null;
};

export default ControlCenter;
