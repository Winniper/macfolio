import { normalizeAddress } from './browser';
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';

// Lock/Restart cover the desktop; drop focus first so the key that dismisses
// the lock screen can't type into a hidden input.
const blurActiveElement = () => globalThis.document?.activeElement?.blur?.();

const LEAVES_MISSION_CONTROL = new Set(['openApp', 'close', 'minimize', 'zoom', 'safariNewTab', 'openUrl']);

export const runMenuAction = (action) => {
    const windows = useWindowStore.getState();
    const system = useSystemStore.getState();

    // Acting on a window leaves Mission Control first: its layout is a snapshot.
    if (LEAVES_MISSION_CONTROL.has(action.type) && system.missionControl) system.closeMissionControl();

    switch (action.type) {
        case 'openApp':
            windows.openWindow(action.id, action.data ?? null);
            break;
        case 'focusApp':
            system.switchToApp(action.id);
            break;
        case 'close':
            windows.closeWindow(action.id);
            break;
        case 'minimize':
            windows.minimizeWindow(action.id);
            break;
        case 'zoom':
            windows.toggleMaximize(action.id);
            break;
        case 'missionControl':
            system.toggleMissionControl();
            break;
        case 'safariNewTab':
            windows.openWindow('safari', { newTab: true });
            break;
        case 'copySelection':
        {
            const text = globalThis.getSelection?.()?.toString() ?? '';
            if (text) globalThis.navigator?.clipboard?.writeText(text)?.catch?.(() => {});
            break;
        }
        case 'lock':
            blurActiveElement();
            system.lock();
            break;
        case 'restart':
            blurActiveElement();
            system.restart();
            break;
        case 'cleanUp':
            system.cleanUpDesktop();
            break;
        case 'openUrl':
        {
            // Firestore links are untyped: only ever open an http(s) address.
            const url = normalizeAddress(action.url);
            if (url) globalThis.open?.(url, '_blank', 'noopener,noreferrer');
            break;
        }
        case 'spotlight':
            system.openSpotlight();
            break;
        default:
            break;
    }
};
