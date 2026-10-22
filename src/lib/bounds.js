// Window geometry. Bounds are { x, y, w, h } in viewport px; x/y are the
// window's left/top.

export const MENU_BAR_HEIGHT = 40;
export const DOCK_RESERVE = 96;
export const TITLE_BAR_HEIGHT = 44;
export const MIN_VISIBLE = 80;

export const getViewport = () => ({
    width: globalThis.innerWidth || 1440,
    height: globalThis.innerHeight || 900,
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Respect the app's minimum size, never exceed the screen, keep the title bar
// below the menu bar and above the bottom edge, and keep MIN_VISIBLE px of the
// window on screen horizontally so it can always be grabbed again.
export const clampBounds = ({ x, y, w, h }, minSize, viewport) => {
    const width = Math.min(Math.max(w, minSize.w), viewport.width);
    const height = Math.min(Math.max(h, minSize.h), viewport.height - MENU_BAR_HEIGHT);

    return {
        x: clamp(x, MIN_VISIBLE - width, viewport.width - MIN_VISIBLE),
        y: clamp(y, MENU_BAR_HEIGHT, viewport.height - TITLE_BAR_HEIGHT),
        w: width,
        h: height,
    };
};

export const maximizedBounds = (viewport) => ({
    x: 0,
    y: MENU_BAR_HEIGHT,
    w: viewport.width,
    h: Math.max(viewport.height - MENU_BAR_HEIGHT - DOCK_RESERVE, TITLE_BAR_HEIGHT),
});

// Bounds after dragging `edge` by (dx, dy) from `start`. Edges that move the
// left/top side keep the opposite side fixed when the minimum size kicks in.
export const resizeBounds = (start, edge, dx, dy, minSize) => {
    let { x, y, w, h } = start;

    if (edge.includes('e')) w = Math.max(start.w + dx, minSize.w);
    if (edge.includes('s')) h = Math.max(start.h + dy, minSize.h);

    if (edge.includes('w')) {
        w = Math.max(start.w - dx, minSize.w);
        x = start.x + start.w - w;
    }

    if (edge.includes('n')) {
        h = Math.max(start.h - dy, minSize.h);
        y = start.y + start.h - h;

        if (y < MENU_BAR_HEIGHT) {
            h -= MENU_BAR_HEIGHT - y;
            y = MENU_BAR_HEIGHT;
        }
    }

    return { x, y, w, h };
};

export const toRect = ({ left, top, width, height }) => ({ x: left, y: top, w: width, h: height });

// GSAP transform that makes a window at `from` cover the rect `to`
// (use with transformOrigin '0 0').
export const transformToRect = (from, to) => ({
    x: to.x - from.x,
    y: to.y - from.y,
    scaleX: to.w / from.w,
    scaleY: to.h / from.h,
});
