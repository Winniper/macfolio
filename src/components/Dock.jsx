import gsap from 'gsap';
import { Tooltip } from 'react-tooltip';

import { dockApps, getApp } from '../constants';
import { getDockAction } from '../lib/dock';
import { toRect } from '../lib/bounds';
import useWindowStore from '../store/window';
import useSystemStore from '../store/system';

const magnify = (event) => {
    gsap.to(event.currentTarget, { scale: 1.2, y: -8, duration: 0.2, ease: 'power1.out' });
};

const settle = (event) => {
    gsap.to(event.currentTarget, { scale: 1, y: 0, duration: 0.3, ease: 'power1.out' });
};

const Dock = () => {
    const windows = useWindowStore((state) => state.windows);
    const minimizedStack = useWindowStore((state) => state.minimizedStack);
    const openWindow = useWindowStore((state) => state.openWindow);
    const focusWindow = useWindowStore((state) => state.focusWindow);
    const restoreWindow = useWindowStore((state) => state.restoreWindow);
    const toggleMissionControl = useSystemStore((state) => state.toggleMissionControl);

    const apps = dockApps.filter((app) => app.id !== 'trash');
    const trash = dockApps.find((app) => app.id === 'trash');

    const handleAppClick = (app, event) => {
        if (app.action === 'missionControl') {
            toggleMissionControl();
            return;
        }

        const action = getDockAction(app.canOpen ? windows[app.id] : undefined);
        const rect = toRect(event.currentTarget.getBoundingClientRect());

        if (action === 'open') openWindow(app.id, null, rect);
        if (action === 'restore') restoreWindow(app.id, rect);
        if (action === 'focus') focusWindow(app.id);
    };

    const renderApp = (app) => (
        <div key={app.id} className="relative flex justify-center">
            <button
                type="button"
                className="dock-icon"
                aria-label={app.name}
                data-tooltip-id="dock-tooltip"
                data-tooltip-content={app.name}
                disabled={!app.canOpen && !app.action}
                onClick={(event) => handleAppClick(app, event)}
                onMouseEnter={magnify}
                onMouseLeave={settle}
            >
                <img
                    src={app.icon}
                    alt={app.name}
                    loading="lazy"
                    className={!app.canOpen && !app.action ? 'opacity-60' : ''}
                />
            </button>
            {windows[app.id]?.isOpen && <span className="dock-running" />}
        </div>
    );

    return (
        <section id="dock">
            <div className="dock-container">
                {apps.map(renderApp)}

                <div className="dock-divider" />

                {minimizedStack.map((id) => {
                    const app = getApp(id);

                    return (
                        <button
                            key={id}
                            type="button"
                            className="dock-icon dock-minimized"
                            aria-label={`Restore ${app.title}`}
                            data-dock-minimized={id}
                            data-tooltip-id="dock-tooltip"
                            data-tooltip-content={app.title}
                            onClick={(event) => restoreWindow(id, toRect(event.currentTarget.getBoundingClientRect()))}
                            onMouseEnter={magnify}
                            onMouseLeave={settle}
                        >
                            <img src={app.icon} alt={app.title} />
                        </button>
                    );
                })}

                {trash && renderApp(trash)}
            </div>

            <Tooltip
                id="dock-tooltip"
                place="top"
                className="tooltip"
                delayShow={150}
            />
        </section>
    );
};

export default Dock;
