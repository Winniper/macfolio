// Single source of truth for every app on the desktop.
// Pure data only — no component imports, so the store and tests can load it
// without initializing Firebase. Each windowed app's id must match the key
// passed to WindowWrapper in its component file.
// defaultBounds/minSize are px; the store clamps them to the screen.
// `action` marks dock launchers that run something instead of opening a window; `keywords` feed Spotlight.

export const INITIAL_Z_INDEX = 1000;

export const APPS = [
    {
        id: 'finder',
        title: 'Projects',
        keywords: ['finder', 'work', 'portfolio', 'folders', 'files'],
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
        keywords: ['email', 'message', 'hire', 'reach out', 'socials'],
        icon: '/images/contact.png',
        placement: ['dock'],
        defaultBounds: { x: 448, y: 160, w: 600, h: 350 },
        minSize: { w: 420, h: 300 },
    },
    {
        id: 'terminal',
        title: 'Skills',
        keywords: ['terminal', 'tech stack', 'technologies', 'tools'],
        icon: '/images/terminal.png',
        placement: ['dock'],
        defaultBounds: { x: 64, y: 96, w: 480, h: 400 },
        minSize: { w: 360, h: 240 },
    },
    {
        id: 'resume',
        title: 'Resume',
        label: 'Resume.pdf',
        keywords: ['cv', 'experience', 'pdf'],
        icon: '/images/pdf.png',
        placement: ['desktop'],
        desktopPosition: { top: 160, left: 20 },
        defaultBounds: { x: 700, y: 64, w: 700, h: 600 },
        minSize: { w: 400, h: 360 },
    },
    {
        id: 'safari',
        title: 'Safari',
        keywords: ['browser', 'web', 'internet', 'sites', 'live demos'],
        icon: '/images/safari.png',
        placement: ['desktop'],
        desktopPosition: { top: 260, left: 20 },
        defaultBounds: { x: 200, y: 70, w: 1000, h: 680 },
        minSize: { w: 480, h: 360 },
    },
    {
        id: 'music',
        title: 'Music',
        keywords: ['songs', 'audio', 'player', 'tunes', 'playlist'],
        icon: '/images/music.svg',
        placement: ['desktop'],
        desktopPosition: { top: 360, left: 20 },
        defaultBounds: { x: 240, y: 90, w: 900, h: 560 },
        minSize: { w: 640, h: 400 },
    },
    {
        id: 'missionControl',
        title: 'Mission Control',
        keywords: ['windows', 'overview', 'expose'],
        icon: '/images/mission-control.svg',
        placement: ['dock'],
        hasWindow: false,
        action: 'missionControl',
    },
    {
        id: 'about',
        title: 'About This Mac',
        keywords: ['system', 'profile', 'info', 'mac'],
        icon: '/images/about.svg',
        placement: [],
        defaultBounds: { x: 560, y: 140, w: 480, h: 340 },
        minSize: { w: 400, h: 300 },
    },
    {
        id: 'trash',
        title: 'Archive',
        keywords: [],
        icon: '/images/trash.png',
        placement: ['dock'],
        hasWindow: false,
    },
];

const hasWindow = (app) => app.hasWindow !== false;

export const getApp = (id) => APPS.find((app) => app.id === id);

export const dockApps = APPS
    .filter((app) => app.placement.includes('dock'))
    .map((app) => ({
        id: app.id,
        name: app.title,
        icon: app.icon,
        canOpen: hasWindow(app),
        action: app.action ?? null,
    }));

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
