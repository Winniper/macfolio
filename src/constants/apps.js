// Single source of truth for every app on the desktop.
// Pure data only — no component imports, so the store and tests can load it
// without initializing Firebase. Each windowed app's id must match the key
// passed to WindowWrapper in its component file.

export const INITIAL_Z_INDEX = 1000;

export const APPS = [
    {
        id: 'finder',
        title: 'Projects',
        icon: '/images/finder.png',
        desktopIcon: '/images/folder.png',
        placement: ['dock', 'desktop'],
        desktopPosition: { top: 60, left: 20 },
    },
    {
        id: 'contact',
        title: 'Contact',
        icon: '/images/contact.png',
        placement: ['dock'],
    },
    {
        id: 'terminal',
        title: 'Skills',
        icon: '/images/terminal.png',
        placement: ['dock'],
    },
    {
        id: 'resume',
        title: 'Resume',
        label: 'Resume.pdf',
        icon: '/images/pdf.png',
        placement: ['desktop'],
        desktopPosition: { top: 160, left: 20 },
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
            .map((app) => [app.id, { isOpen: false, zIndex: INITIAL_Z_INDEX, data: null }])
    );
