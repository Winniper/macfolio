import { useEffect } from 'react';

import { foregroundApp } from '../lib/phone';
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';
import HomeBar from './HomeBar';
import HomeScreen from './HomeScreen';
import RotateCard from './RotateCard';
import StatusBar from './StatusBar';

// The phone UI: status bar, home screen and Home bar over the wallpaper.
// Apps, sheets and banners mount in here too (later tasks).
const PhoneShell = () => {
    const foreground = useWindowStore(foregroundApp);
    const goHome = useSystemStore((state) => state.goHome);
    const openMissionControl = useSystemStore((state) => state.openMissionControl);

    // The page itself must never scroll or bounce under a gesture.
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add('phone-mode');
        return () => root.classList.remove('phone-mode');
    }, []);

    return (
        <div id="phone">
            <HomeScreen inert={foreground !== null} />
            <StatusBar />
            <HomeBar onHome={goHome} onSwitcher={openMissionControl} />
            <RotateCard />
        </div>
    );
};

export default PhoneShell;
