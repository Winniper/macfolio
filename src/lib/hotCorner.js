// A hot corner fires only for a free-moving mouse: not while a button is held
// (e.g. dragging a window into the corner) and not for touch or pen taps.
export const shouldOpenFromHotCorner = (event) =>
    event.pointerType === 'mouse' && event.buttons === 0;
