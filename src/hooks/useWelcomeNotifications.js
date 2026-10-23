import { useEffect } from 'react';

import { welcomeNotifications } from '../constants';
import { scheduleWelcome } from '../lib/notifications';
import useSystemStore from '../store/system';
import useWindowStore from '../store/window';

// Once per page load, when the visitor unlocks (locked → desktop). A same-tab
// refresh lands straight on the desktop, so they are not shown again.
const useWelcomeNotifications = () => {
    useEffect(() => {
        let scheduled = false;
        let timers = [];
        const opened = new Set();

        const unsubscribeWindows = useWindowStore.subscribe((state) => {
            Object.entries(state.windows).forEach(([id, entry]) => {
                if (entry.isOpen) opened.add(id);
            });
        });

        const unsubscribeSystem = useSystemStore.subscribe((state, previous) => {
            if (scheduled || previous.bootPhase !== 'locked' || state.bootPhase !== 'desktop') return;

            scheduled = true;
            timers = scheduleWelcome(welcomeNotifications, {
                setTimer: (callback, delay) => window.setTimeout(callback, delay),
                wasOpened: (id) => opened.has(id),
                notify: (notification) => useSystemStore.getState().notify(notification),
            });
        });

        return () => {
            unsubscribeWindows();
            unsubscribeSystem();
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, []);
};

export default useWelcomeNotifications;
