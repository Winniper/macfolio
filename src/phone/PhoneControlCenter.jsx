import { useRef, useState } from 'react';
import {
    BellRing, Bluetooth, Lock, Moon, Pause, Play, Power, Radio, SkipBack, SkipForward, Sun, Volume2, Wifi,
} from 'lucide-react';

import { getApp } from '../constants/apps';
import { swipeDirection } from '../lib/gestures';
import { runMenuAction } from '../lib/menuActions';
import { albumTitleOf, coverGradient, trackById } from '../lib/music';
import { volumeIsSettable } from '../lib/volumeSupport';
import useSystemStore from '../store/system';
import { useGesture } from './useGesture';
import { useSheetMotion, useSheetMount } from './useSheet';

const Toggle = ({ icon, label, detail, active, onClick }) => {
    const Icon = icon;
    return (
        <button type="button" className={`phone-cc-toggle${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onClick}>
            <span className="phone-cc-toggle-icon"><Icon size={18} aria-hidden="true" /></span>
            <span className="phone-cc-text">
                <span className="phone-cc-label">{label}</span>
                <span className="phone-cc-detail">{detail}</span>
            </span>
        </button>
    );
};

const Slider = ({ icon, label, min, max, value, onChange }) => {
    const Icon = icon;
    const fill = ((value - min) / (max - min)) * 100;
    return (
        <div className="phone-cc-module">
            <p className="phone-cc-title">{label}</p>
            <label className="phone-cc-slider">
                <Icon size={18} aria-hidden="true" />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.01}
                    value={value}
                    aria-label={label}
                    style={{ '--fill': `${fill}%` }}
                    onChange={(event) => onChange(Number(event.target.value))}
                />
            </label>
        </div>
    );
};

// The panel mounts only while shown, so the decorative toggles reset each open.
const ControlCenterSheet = ({ onClosed, returnFocus }) => {
    const open = useSystemStore((state) => state.controlCenterOpen);
    const closeControlCenter = useSystemStore((state) => state.closeControlCenter);
    const brightness = useSystemStore((state) => state.brightness);
    const setBrightness = useSystemStore((state) => state.setBrightness);
    const focusMode = useSystemStore((state) => state.focusMode);
    const setFocusMode = useSystemStore((state) => state.setFocusMode);
    const soundEffects = useSystemStore((state) => state.soundEffects);
    const setSoundEffects = useSystemStore((state) => state.setSoundEffects);
    const audio = useSystemStore((state) => state.audio);
    const library = useSystemStore((state) => state.library);
    const setVolume = useSystemStore((state) => state.setVolume);
    const togglePlay = useSystemStore((state) => state.togglePlay);
    const nextTrack = useSystemStore((state) => state.nextTrack);
    const previousTrack = useSystemStore((state) => state.previousTrack);
    const history = useSystemStore((state) => state.notificationHistory);
    const clearNotificationHistory = useSystemStore((state) => state.clearNotificationHistory);
    // Decorative, like the desktop: they only flip their look.
    const [radios, setRadios] = useState({ wifi: true, bluetooth: true, airdrop: false });
    const track = trackById(library, audio.currentTrackId);
    const sheetRef = useRef(null);
    const backdropRef = useRef(null);
    const headerRef = useRef(null);
    const grabberRef = useRef(null);

    useSheetMotion({ open, close: closeControlCenter, sheetRef, backdropRef, focusRef: sheetRef, onClosed, returnFocus });

    // A swipe up on the title row or the grabber closes the panel; the content
    // scrolls on its own and the sliders keep their drags.
    const gesture = {
        onEnd: (sample) => {
            if (swipeDirection(sample) === 'up') closeControlCenter();
        },
    };
    useGesture(headerRef, gesture);
    useGesture(grabberRef, gesture);

    const flip = (key) => setRadios((current) => ({ ...current, [key]: !current[key] }));

    const openNotification = (notification) => {
        closeControlCenter();
        if (notification.action) runMenuAction(notification.action);
    };

    const openMusic = () => {
        closeControlCenter();
        runMenuAction({ type: 'openApp', id: 'music' });
    };

    return (
        <div className="phone-cc" data-closing={!open}>
            <button
                ref={backdropRef}
                type="button"
                className="phone-cc-backdrop"
                aria-label="Close Control Center"
                tabIndex={-1}
                onClick={closeControlCenter}
            />
            <div ref={sheetRef} className="phone-cc-sheet" role="dialog" aria-label="Control Center" tabIndex={-1}>
                <div ref={headerRef} className="phone-cc-header">
                    <h2>Control Center</h2>
                    <button type="button" className="phone-cc-done" onClick={closeControlCenter}>Done</button>
                </div>
                <div className="phone-cc-content phone-scroll">
                    <div className="phone-cc-row">
                        <div className="phone-cc-module phone-cc-radios">
                            <Toggle icon={Wifi} label="Wi-Fi" detail={radios.wifi ? 'Home' : 'Off'} active={radios.wifi} onClick={() => flip('wifi')} />
                            <Toggle icon={Bluetooth} label="Bluetooth" detail={radios.bluetooth ? 'On' : 'Off'} active={radios.bluetooth} onClick={() => flip('bluetooth')} />
                            <Toggle icon={Radio} label="AirDrop" detail={radios.airdrop ? 'Contacts Only' : 'Off'} active={radios.airdrop} onClick={() => flip('airdrop')} />
                        </div>
                        <div className="phone-cc-column">
                            <div className="phone-cc-module">
                                <Toggle icon={Moon} label="Focus" detail={focusMode ? 'On' : 'Off'} active={focusMode} onClick={() => setFocusMode(!focusMode)} />
                            </div>
                            <div className="phone-cc-module">
                                <Toggle icon={BellRing} label="Sound Effects" detail={soundEffects ? 'On' : 'Off'} active={soundEffects} onClick={() => setSoundEffects(!soundEffects)} />
                            </div>
                        </div>
                    </div>

                    <Slider icon={Sun} label="Display" min={0.3} max={1} value={brightness} onChange={setBrightness} />
                    {volumeIsSettable() && (
                        <Slider icon={Volume2} label="Sound" min={0} max={1} value={audio.volume} onChange={setVolume} />
                    )}

                    <div className="phone-cc-module phone-cc-now-playing">
                        <span
                            className="phone-music-cover phone-music-cover-sm"
                            style={track && !track.cover ? { background: coverGradient(albumTitleOf(track)) } : undefined}
                        >
                            {track?.cover && <img src={track.cover} alt="" />}
                        </span>
                        <button type="button" className="phone-cc-text phone-cc-song" onClick={openMusic}>
                            <span className="phone-cc-label">{track ? track.title : 'Not Playing'}</span>
                            {track && <span className="phone-cc-detail">{track.artist}</span>}
                        </button>
                        <span className="phone-cc-transport">
                            <button type="button" aria-label="Previous" disabled={!track} onClick={previousTrack}><SkipBack size={20} /></button>
                            <button type="button" aria-label={audio.isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
                                {audio.isPlaying ? <Pause size={22} /> : <Play size={22} />}
                            </button>
                            <button type="button" aria-label="Next" disabled={!track} onClick={nextTrack}><SkipForward size={20} /></button>
                        </span>
                    </div>

                    <div className="phone-cc-module phone-cc-history">
                        <div className="phone-cc-history-head">
                            <p className="phone-cc-title">Notifications</p>
                            {history.length > 0 && (
                                <button type="button" className="phone-cc-clear" onClick={clearNotificationHistory}>Clear</button>
                            )}
                        </div>
                        {history.length === 0 ? (
                            <p className="phone-cc-empty">No Notifications</p>
                        ) : (
                            [...history].reverse().slice(0, 5).map((notification) => (
                                <button key={notification.id} type="button" className="phone-cc-history-item" onClick={() => openNotification(notification)}>
                                    <img src={getApp(notification.appId)?.icon ?? '/images/about.svg'} alt="" draggable="false" />
                                    <span className="phone-cc-text">
                                        <span className="phone-cc-label">{notification.title}</span>
                                        {notification.body && <span className="phone-cc-detail">{notification.body}</span>}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="phone-cc-power">
                        <button type="button" onClick={() => runMenuAction({ type: 'lock' })}>
                            <Lock size={18} aria-hidden="true" />Lock
                        </button>
                        <button type="button" onClick={() => runMenuAction({ type: 'restart' })}>
                            <Power size={18} aria-hidden="true" />Restart
                        </button>
                    </div>
                </div>
                <div ref={grabberRef} className="phone-cc-grabber">
                    <span aria-hidden="true" />
                </div>
            </div>
        </div>
    );
};

const PhoneControlCenter = () => {
    const { render, onClosed, returnFocus } = useSheetMount('controlCenterOpen');

    return render ? <ControlCenterSheet onClosed={onClosed} returnFocus={returnFocus} /> : null;
};

export default PhoneControlCenter;
