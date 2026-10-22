import { useEffect } from 'react';

import { getApp } from '../../constants/apps';
import { shouldOpenFromHotCorner } from '../../lib/hotCorner';
import { getPlatform, isMacPlatform, isMissionControlKey } from '../../lib/shortcuts';
import useSystemStore from '../../store/system';

const isMac = isMacPlatform(getPlatform());

// Backdrop + window labels while Mission Control is open (the windows
// themselves are moved by WindowWrapper), the Ctrl+↑ / Esc shortcuts, and the
// top-right hot corner.
const MissionControl = () => {
    const missionControl = useSystemStore((state) => state.missionControl);
    const openMissionControl = useSystemStore((state) => state.openMissionControl);
    const closeMissionControl = useSystemStore((state) => state.closeMissionControl);
    const toggleMissionControl = useSystemStore((state) => state.toggleMissionControl);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (isMissionControlKey(event, isMac)) {
                event.preventDefault();
                toggleMissionControl();
            } else if (event.key === 'Escape' && useSystemStore.getState().missionControl) {
                closeMissionControl();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleMissionControl, closeMissionControl]);

    // Keep window content unclickable until the windows have slid back (~0.3s),
    // so the second click of a double-click can't land inside a window.
    useEffect(() => {
        if (missionControl) {
            document.body.classList.add('mission-control-open');
            return undefined;
        }

        const timeoutId = setTimeout(() => document.body.classList.remove('mission-control-open'), 350);
        return () => clearTimeout(timeoutId);
    }, [missionControl]);

    const handleHotCorner = (event) => {
        if (!shouldOpenFromHotCorner(event)) return;
        if (!useSystemStore.getState().missionControl) openMissionControl();
    };

    return (
        <>
            <div className="hot-corner hot-corner-top-right" onPointerEnter={handleHotCorner} />

            {missionControl && (
                <div className="mission-control" onClick={closeMissionControl}>
                    {Object.entries(missionControl.layout).map(([key, { label }]) => (
                        <span
                            key={key}
                            className="mission-control-label"
                            style={{ left: label.left, top: label.top, width: label.width }}
                        >
                            {getApp(key).title}
                        </span>
                    ))}
                </div>
            )}
        </>
    );
};

export default MissionControl;
