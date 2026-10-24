import { extractId3Cover, id3TagLength, imageDimensions } from './id3';

const MAX_TAG_BYTES = 8 * 1024 * 1024;

// Scales down to fit a max x max box, never up, keeping the aspect ratio.
export const fitWithin = (width, height, max) => {
    if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
    const scale = Math.min(1, max / Math.max(width, height));
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
};

const MAX_SIDE = 8000;
const MAX_PIXELS = 40_000_000;

// False for pictures too big to decode safely; unknown dimensions pass.
export const withinDecodeLimits = (dims) =>
    !dims || (dims.width <= MAX_SIDE && dims.height <= MAX_SIDE && dims.width * dims.height <= MAX_PIXELS);

const decode = async (blob) => {
    if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
};

// Browser only: decodes the picture, downsizes it and re-encodes as JPEG.
export const coverFileFromBytes = async (picture, max = 600) => {
    try {
        if (!picture?.data?.length) return null;
        if (!withinDecodeLimits(imageDimensions(picture.data))) return null;
        const image = await decode(new Blob([picture.data], { type: picture.mime }));
        try {
            const w = image.width ?? image.naturalWidth;
            const h = image.height ?? image.naturalHeight;
            const size = fitWithin(w, h, max);
            const canvas = document.createElement('canvas');
            canvas.width = size.width;
            canvas.height = size.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; // JPEG has no alpha; flatten transparent PNGs onto white
            ctx.fillRect(0, 0, size.width, size.height);
            ctx.drawImage(image, 0, 0, size.width, size.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            return blob ? new File([blob], 'cover.jpg', { type: 'image/jpeg' }) : null;
        } finally {
            image.close?.();
        }
    } catch {
        return null;
    }
};

// `readRange(end)` resolves the song's first `end` bytes. Reads the 10-byte header,
// then only the tag (capped), and returns its cover as a JPEG File.
export const readEmbeddedCoverFrom = async (readRange) => {
    try {
        const length = id3TagLength(await readRange(10));
        if (!length) return null;
        const picture = extractId3Cover(await readRange(Math.min(length, MAX_TAG_BYTES)));
        return picture ? await coverFileFromBytes(picture) : null;
    } catch {
        return null;
    }
};

export const readEmbeddedCover = (file) =>
    readEmbeddedCoverFrom(async (end) => new Uint8Array(await file.slice(0, end).arrayBuffer()));

// Same, for a song at a URL: two small Range requests instead of the whole file.
export const readEmbeddedCoverFromUrl = (url) =>
    readEmbeddedCoverFrom(async (end) => {
        const res = await fetch(url, { headers: { Range: `bytes=0-${end - 1}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // A server that ignores Range sends the whole file; keep just the start.
        return new Uint8Array(await res.arrayBuffer()).subarray(0, end);
    });
