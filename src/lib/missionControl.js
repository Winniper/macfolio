import { DOCK_RESERVE, MENU_BAR_HEIGHT } from './bounds';

export const MC_PADDING = 48;
export const MC_GAP = 24;
export const MC_LABEL = 28;

// Grid slots for Mission Control: the area between the menu bar and the dock
// is split into cols x rows cells (cols = ceil(sqrt(n))), each window is scaled
// to fit its cell (never enlarged) and centered above its label. x/y are GSAP
// translate offsets from the window's own bounds (transformOrigin '0 0').
export const missionControlLayout = (entries, viewport) => {
    if (entries.length === 0) return {};

    const area = {
        x: MC_PADDING,
        y: MENU_BAR_HEIGHT + MC_PADDING,
        w: viewport.width - 2 * MC_PADDING,
        h: viewport.height - MENU_BAR_HEIGHT - DOCK_RESERVE - 2 * MC_PADDING,
    };
    const cols = Math.ceil(Math.sqrt(entries.length));
    const rows = Math.ceil(entries.length / cols);
    const cellW = area.w / cols;
    const cellH = area.h / rows;
    const availW = cellW - 2 * MC_GAP;
    const availH = cellH - 2 * MC_GAP - MC_LABEL;

    return Object.fromEntries(entries.map(({ key, bounds }, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const scale = Math.min(1, availW / bounds.w, availH / bounds.h);
        const width = bounds.w * scale;
        const height = bounds.h * scale;
        const left = area.x + col * cellW + (cellW - width) / 2;
        const top = area.y + row * cellH + MC_GAP + (availH - height) / 2;

        return [key, {
            x: left - bounds.x,
            y: top - bounds.y,
            scale,
            label: { left, top: top + height + 8, width },
        }];
    }));
};
