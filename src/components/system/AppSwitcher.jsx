import { useEffect, useRef, useState } from 'react';

import { getApp } from '../../constants/apps';
import { getPlatform, isMacPlatform } from '../../lib/shortcuts';
import { switcherOrder, switcherReducer } from '../../lib/switcher';
import useSystemStore, { isDesktopPhase } from '../../store/system';
import useWindowStore from '../../store/window';

const isMac = isMacPlatform(getPlatform());

// Hold Option+Tab (macOS) or Ctrl+` and press Tab/` to cycle; release to switch.
const AppSwitcher = () => {
    const [switcher, setSwitcher] = useState(null);
    const switcherRef = useRef(null);

    useEffect(() => {
        const dispatch = (action, event) => {
            const { windows } = useWindowStore.getState();
            const { state, commit, handled } = switcherReducer(
                switcherRef.current,
                action,
                { isMac, order: switcherOrder(windows) }
            );

            if (handled) event?.preventDefault();

            if (state !== switcherRef.current) {
                switcherRef.current = state;
                setSwitcher(state);
            }

            if (commit) useSystemStore.getState().switchToApp(commit);
        };

        const handleKeyDown = (event) => {
            if (!isDesktopPhase(useSystemStore.getState())) return;

            dispatch({
                type: 'keydown',
                key: event.key,
                code: event.code,
                altKey: event.altKey,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
            }, event);
        };
        const handleKeyUp = (event) => {
            if (!isDesktopPhase(useSystemStore.getState())) return;

            dispatch({ type: 'keyup', key: event.key }, event);
        };
        const handleBlur = () => dispatch({ type: 'blur' });

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    if (!switcher) return null;

    const selected = getApp(switcher.order[switcher.index]);

    return (
        <div className="app-switcher" role="listbox" aria-label="Switch apps">
            <div className="app-switcher-row">
                {switcher.order.map((id, index) => (
                    <div
                        key={id}
                        className={`app-switcher-item${index === switcher.index ? ' is-selected' : ''}`}
                        role="option"
                        aria-selected={index === switcher.index}
                    >
                        <img src={getApp(id).icon} alt={getApp(id).title} />
                    </div>
                ))}
            </div>
            <p className="app-switcher-title">{selected.title}</p>
        </div>
    );
};

export default AppSwitcher;
