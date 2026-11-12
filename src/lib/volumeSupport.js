// iOS Safari ignores writes to HTMLMediaElement.volume (always reads 1), so a
// volume slider there would do nothing. Probe the element instead of sniffing.

export const canSetVolume = (element) => {
    try {
        const previous = element.volume;
        const probe = previous === 0.5 ? 0.4 : 0.5;
        element.volume = probe;
        const works = element.volume === probe;
        element.volume = previous;
        return works;
    } catch {
        return false;
    }
};

let cached = null;

export const volumeIsSettable = () => {
    if (cached === null) {
        cached = typeof Audio === 'undefined' ? false : canSetVolume(new Audio());
    }
    return cached;
};
