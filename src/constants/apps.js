// Single source of truth for every app on the desktop.
// Pure data only — no component imports, so the store and tests can load it
// without initializing Firebase. Each windowed app's id must match the key
// passed to WindowWrapper in its component file.
// defaultBounds/minSize are px; the store clamps them to the screen.

export const INITIAL_Z_INDEX = 1000;

export const APPS = [
    {
        id: 'finder',
        title: 'Projects',
        icon: '/images/finder.png',
        desktopIcon: '/images/folder.png',
        placement: ['dock', 'desktop'],
        desktopPosition: { top: 60, left: 20 },
        defaultBounds: { x: 128, y: 80, w: 760, h: 444 },
        minSize: { w: 520, h: 320 },
    },
    {
        id: 'contact',
        title: 'Contact',
        icon: '/images/contact.png',
        placement: ['dock'],
        defaultBounds: { x: 448, y: 160, w: 600, h: 350 },
        minSize: { w: 420, h: 300 },
    },
    {
        id: 'terminal',
        title: 'Skills',
        icon: '/images/terminal.png',
        placement: ['dock'],
        defaultBounds: { x: 64, y: 96, w: 480, h: 400 },
        minSize: { w: 360, h: 240 },
    },
    {
        id: 'resume',
        title: 'Resume',
        label: 'Resume.pdf',
        icon: '/images/pdf.png',
        placement: ['desktop'],
        desktopPosition: { top: 160, left: 20 },
        defaultBounds: { x: 700, y: 64, w: 700, h: 600 },
        minSize: { w: 400, h: 360 },
    },
    {
        id: 'trash',
        title: 'Archive',
        icon: '/images/trash.png',
        placement: ['dock'],
        hasWindow: false,
    },
];

const hasWindow = (app) => app.hasWindow !== false;

export const getApp = (id) => APPS.find((app) => app.id === id);

export const dockApps = APPS
    .filter((app) => app.placement.includes('dock'))
    .map((app) => ({ id: app.id, name: app.title, icon: app.icon, canOpen: hasWindow(app) }));

export const desktopItems = APPS
    .filter((app) => app.placement.includes('desktop'))
    .map((app) => ({
        id: app.id,
        title: app.label ?? app.title,
        icon: app.desktopIcon ?? app.icon,
        position: app.desktopPosition,
    }));

export const buildWindowConfig = (apps = APPS) =>
    Object.fromEntries(
        apps
            .filter(hasWindow)
            .map((app) => [app.id, {
                isOpen: false,
                zIndex: INITIAL_Z_INDEX,
                data: null,
                isMinimized: false,
                isMaximized: false,
                bounds: null,
                prevBounds: null,
                originRect: null,
            }])
    );
