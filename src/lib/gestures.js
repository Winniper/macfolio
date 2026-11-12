export const TAP_SLOP = 10;
export const SWIPE_DISTANCE = 48;
export const FLICK_DISTANCE = 16;
export const FLICK_VELOCITY = 0.5;
export const LONG_PRESS_MS = 500;
export const HOLD_MS = 250;
export const SWITCHER_FRACTION = 1 / 3;
export const STATUS_BAR_ZONE = 48;

// The dominant axis of a drag, if it went far enough, or a little way but fast.
export function swipeDirection({ dx, dy, dt }) {
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const distance = horizontal ? Math.abs(dx) : Math.abs(dy);
    const fast = distance >= FLICK_DISTANCE && (dt <= 0 || distance / dt >= FLICK_VELOCITY);
    if (distance < SWIPE_DISTANCE && !fast) return null;
    if (horizontal) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
}

// What a touch that began on the Home bar means.
export function homeBarGesture({ dx, dy, dt, restMs }, viewportHeight) {
    if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) {
        return dt >= LONG_PRESS_MS ? 'switcher' : 'home';
    }
    if (dy < -TAP_SLOP && -dy > Math.abs(dx)) {
        return -dy >= viewportHeight * SWITCHER_FRACTION || restMs >= HOLD_MS ? 'switcher' : 'home';
    }
    return null;
}

// Which panel a swipe down from the top opens.
export function pullDownTarget({ startX, startY }, viewportWidth) {
    return startY <= STATUS_BAR_ZONE && startX >= (viewportWidth * 2) / 3 ? 'controlCenter' : 'spotlight';
}
