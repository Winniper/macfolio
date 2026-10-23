import { getApp } from '../constants/apps';
import { profile } from '../constants';

// Menus are data: items carry plain action objects that runMenuAction
// (src/lib/menuActions.js) performs. A shortcut is shown only when pressing it
// actually works on the visitor's platform.

export const DESKTOP_TITLE = "DevBarman's Portfolio";

const SEPARATOR = { separator: true };

const firstName = profile.name.trim().split(/\s+/)[0];

const appleMenu = [
    { label: 'About This Mac', action: { type: 'openApp', id: 'about' } },
    SEPARATOR,
    { label: 'Restart…', action: { type: 'restart' } },
    { label: 'Lock Screen', action: { type: 'lock' } },
];

export const desktopMenuItems = [
    { label: 'Open Terminal', action: { type: 'openApp', id: 'terminal' } },
    { label: 'Clean Up', action: { type: 'cleanUp' } },
    SEPARATOR,
    { label: 'About This Mac', action: { type: 'openApp', id: 'about' } },
];

const windowCommand = (label, type, focusedId) => ({
    label,
    action: { type, id: focusedId },
    disabled: !focusedId,
});

export const buildMenuBar = ({ focusedId, openIds, isMac, hasSelection }) => {
    const appTitle = focusedId ? getApp(focusedId).title : DESKTOP_TITLE;

    return {
        apple: appleMenu,
        menus: [
            {
                id: 'app',
                title: appTitle,
                bold: true,
                items: focusedId
                    ? [{ label: `Close ${appTitle}`, action: { type: 'close', id: focusedId } }]
                    : [{ label: 'About This Mac', action: { type: 'openApp', id: 'about' } }],
            },
            {
                id: 'file',
                title: 'File',
                items: [
                    ...(focusedId === 'safari' ? [{ label: 'New Tab', action: { type: 'safariNewTab' } }] : []),
                    windowCommand('Close Window', 'close', focusedId),
                ],
            },
            {
                id: 'edit',
                title: 'Edit',
                items: [{ label: 'Copy', action: { type: 'copySelection' }, disabled: !hasSelection }],
            },
            {
                id: 'window',
                title: 'Window',
                items: [
                    windowCommand('Minimize', 'minimize', focusedId),
                    windowCommand('Zoom', 'zoom', focusedId),
                    windowCommand('Close', 'close', focusedId),
                    SEPARATOR,
                    {
                        label: 'Mission Control',
                        action: { type: 'missionControl' },
                        ...(isMac ? {} : { shortcut: '⌃↑' }),
                    },
                    ...(openIds.length ? [SEPARATOR] : []),
                    ...openIds.map((id) => ({
                        label: getApp(id).title,
                        action: { type: 'focusApp', id },
                        checked: id === focusedId,
                    })),
                ],
            },
            {
                id: 'go',
                title: 'Go',
                items: ['finder', 'safari', 'resume', 'contact'].map((id) => ({
                    label: getApp(id).title,
                    action: { type: 'openApp', id },
                })),
            },
            {
                id: 'help',
                title: 'Help',
                items: [
                    { label: `Contact ${firstName}`, action: { type: 'openApp', id: 'contact' } },
                    SEPARATOR,
                    { label: 'Switch apps', shortcut: isMac ? '⌥⇥  ⌃`' : '⌃`', disabled: true },
                    { label: 'Mission Control', shortcut: isMac ? 'Top-right corner' : '⌃↑', disabled: true },
                ],
            },
        ],
    };
};

// Keep a menu opened at (x, y) fully on screen, 4px from every edge.
export const clampMenuPosition = ({ x, y }, { w, h }, viewport) => ({
    x: Math.max(4, Math.min(x, viewport.width - w - 4)),
    y: Math.max(4, Math.min(y, viewport.height - h - 4)),
});
