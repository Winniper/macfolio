import { extractId3Cover, id3TagLength } from './id3';

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
        const image = await decode(new Blob([picture.data], { type: picture.mime }));
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
        image.close?.();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        return blob ? new File([blob], 'cover.jpg', { type: 'image/jpeg' }) : null;
    } catch {
        return null;
    }
};

// Reads only the ID3 tag of an MP3 (not the whole song) and returns its cover as a JPEG File.
export const readEmbeddedCover = async (file) => {
    try {
        const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
        const length = id3TagLength(header);
        if (!length) return null;
        const bytes = new Uint8Array(await file.slice(0, Math.min(length, MAX_TAG_BYTES)).arrayBuffer());
        const picture = extractId3Cover(bytes);
        return picture ? await coverFileFromBytes(picture) : null;
    } catch {
        return null;
    }
};
