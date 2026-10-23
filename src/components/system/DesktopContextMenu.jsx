import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import Menu from '../menubar/Menu';
import { getViewport } from '../../lib/bounds';
import { clampMenuPosition, desktopMenuItems } from '../../lib/menus';
import { runMenuAction } from '../../lib/menuActions';
import useSystemStore, { isDesktopPhase } from '../../store/system';

// Everything that keeps the browser's own right-click menu.
const NATIVE_MENU_AREAS = '[data-window], nav, #dock, .menu, .mission-control, .app-switcher, .hot-corner, input, textarea, [contenteditable], .spotlight, .notifications';

// Right-click on the wallpaper or a desktop icon.
const DesktopContextMenu = () => {
    const [menu, setMenu] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleContextMenu = (event) => {
            const system = useSystemStore.getState();

            if (!isDesktopPhase(system) || system.missionControl) return;
            // A right-click on the open menu is swallowed, not handed to the browser.
            if (menuRef.current?.contains(event.target)) {
                event.preventDefault();
                return;
            }
            if (event.target.closest(NATIVE_MENU_AREAS)) return;

            event.preventDefault();

            const icon = event.target.closest('[data-desktop-item]');
            const items = icon
                ? [{ label: 'Open', action: { type: 'openApp', id: icon.dataset.desktopItem } }]
                : desktopMenuItems;

            setMenu({ x: event.clientX, y: event.clientY, items });
        };

        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    // Close on an outside press, Esc, resize, leaving the page, or when the
    // desktop stops being interactive (lock, restart, Mission Control).
    useEffect(() => {
        if (!menu) return undefined;

        const close = () => setMenu(null);
        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) close();
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };
        const unsubscribe = useSystemStore.subscribe((system) => {
            if (!isDesktopPhase(system) || system.missionControl || system.spotlightOpen) close();
        });

        document.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', close);
        window.addEventListener('blur', close);

        return () => {
            unsubscribe();
            document.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', close);
            window.removeEventListener('blur', close);
        };
    }, [menu]);

    // Keep it on screen once its size is known.
    useLayoutEffect(() => {
        const element = menuRef.current;

        if (!menu || !element) return;

        const { x, y } = clampMenuPosition(
            { x: menu.x, y: menu.y },
            { w: element.offsetWidth, h: element.offsetHeight },
            getViewport()
        );

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    }, [menu]);

    if (!menu) return null;

    return (
        <Menu
            menuRef={menuRef}
            className="context-menu"
            style={{ left: menu.x, top: menu.y }}
            items={menu.items}
            onSelect={(item) => {
                setMenu(null);
                if (item.action) runMenuAction(item.action);
            }}
        />
    );
};

export default DesktopContextMenu;
