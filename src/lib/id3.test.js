import { describe, it, expect } from 'vitest';
import { extractId3Cover, id3TagLength } from './id3';

const enc = (s) => Array.from(s, (c) => c.charCodeAt(0));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 9, 8, 7];
const WEBP = [...enc('RIFF'), 0, 0, 0, 0, ...enc('WEBP'), 5];

const syncsafe = (n) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

const utf16 = (s) => [0xff, 0xfe, ...Array.from(s).flatMap((c) => [c.charCodeAt(0), 0])];

// body of an APIC frame
const apicBody = ({ encoding = 0, mime = 'image/png', type = 3, desc = [], image }) => {
    const term = encoding === 1 || encoding === 2 ? [0, 0] : [0];
    return [encoding, ...enc(mime), 0, type, ...desc, ...term, ...image];
};

const frame = (version, id, body, flags = [0, 0]) => {
    const size = version === 4 ? syncsafe(body.length) : be32(body.length);
    return [...enc(id), ...size, ...flags, ...body];
};

const tag = ({ version = 3, frames = [], flags = 0, ext = [], padding = 0 }) => {
    const body = [...ext, ...frames.flat(), ...new Array(padding).fill(0)];
    return new Uint8Array([...enc('ID3'), version, 0, flags, ...syncsafe(body.length), ...body]);
};

const text = (version, id, s) => frame(version, id, [0, ...enc(s)]);

describe('id3TagLength', () => {
    it('returns header plus syncsafe size', () => {
        const t = tag({ frames: [text(3, 'TIT2', 'Red')] });
        expect(id3TagLength(t.slice(0, 10))).toBe(t.length);
    });
    it('adds 10 for a v2.4 footer', () => {
        const h = new Uint8Array([...enc('ID3'), 4, 0, 0x10, ...syncsafe(100)]);
        expect(id3TagLength(h)).toBe(120);
    });
    it('returns null for non-ID3, short or invalid-size input', () => {
        expect(id3TagLength(new Uint8Array(10))).toBeNull();
        expect(id3TagLength(new Uint8Array(4))).toBeNull();
        expect(id3TagLength(null)).toBeNull();
        expect(id3TagLength(new Uint8Array([...enc('ID3'), 3, 0, 0, 0x80, 0, 0, 0]))).toBeNull();
    });
});

describe('extractId3Cover', () => {
    it.each([3, 4])('reads a PNG cover in v2.%i', (version) => {
        const t = tag({ version, frames: [text(version, 'TIT2', 'Red'), frame(version, 'APIC', apicBody({ image: PNG }))] });
        const cover = extractId3Cover(t);
        expect(cover.mime).toBe('image/png');
        expect(Array.from(cover.data)).toEqual(PNG);
    });

    it.each([3, 4])('reads a JPEG cover in v2.%i', (version) => {
        const t = tag({ version, frames: [frame(version, 'APIC', apicBody({ mime: 'image/jpeg', image: JPEG }))] });
        const cover = extractId3Cover(t);
        expect(cover.mime).toBe('image/jpeg');
        expect(Array.from(cover.data)).toEqual(JPEG);
    });

    it('uses syncsafe frame sizes in v2.4 (size over 127)', () => {
        const big = [0xff, 0xd8, 0xff, ...new Array(1000).fill(7)];
        const t = tag({ version: 4, frames: [frame(4, 'APIC', apicBody({ mime: 'image/jpeg', image: big }))] });
        expect(extractId3Cover(t).data.length).toBe(big.length);
    });

    it('prefers the front cover over an earlier other picture', () => {
        const t = tag({
            frames: [
                frame(3, 'APIC', apicBody({ type: 0, mime: 'image/jpeg', image: JPEG })),
                frame(3, 'APIC', apicBody({ type: 3, image: PNG })),
            ],
        });
        expect(extractId3Cover(t).mime).toBe('image/png');
    });

    it('falls back to the first APIC when there is no front cover', () => {
        const t = tag({
            frames: [
                frame(3, 'APIC', apicBody({ type: 0, image: PNG })),
                frame(3, 'APIC', apicBody({ type: 4, mime: 'image/jpeg', image: JPEG })),
            ],
        });
        expect(extractId3Cover(t).mime).toBe('image/png');
    });

    it('skips a UTF-16 description (encoding 1)', () => {
        const t = tag({ frames: [frame(3, 'APIC', apicBody({ encoding: 1, desc: utf16('Cover'), image: PNG }))] });
        expect(Array.from(extractId3Cover(t).data)).toEqual(PNG);
    });

    it('handles UTF-16 descriptions with an aligned 0x00 byte pair inside', () => {
        // "A" = 41 00, then "Ā"-like char 00 01 would not matter; use 'Ā' (0x0100) LE = 00 01
        const desc = [0xff, 0xfe, 0x41, 0x00, 0x00, 0x01];
        const t = tag({ frames: [frame(3, 'APIC', apicBody({ encoding: 1, desc, image: PNG }))] });
        expect(Array.from(extractId3Cover(t).data)).toEqual(PNG);
    });

    it('handles UTF-8 (3) and UTF-16BE (2) descriptions', () => {
        const t8 = tag({ version: 4, frames: [frame(4, 'APIC', apicBody({ encoding: 3, desc: enc('front'), image: PNG }))] });
        expect(Array.from(extractId3Cover(t8).data)).toEqual(PNG);
        const t16 = tag({ version: 4, frames: [frame(4, 'APIC', apicBody({ encoding: 2, desc: [0, 0x41], image: PNG }))] });
        expect(Array.from(extractId3Cover(t16).data)).toEqual(PNG);
    });

    it('normalises image/jpg to image/jpeg', () => {
        const t = tag({ frames: [frame(3, 'APIC', apicBody({ mime: 'image/jpg', image: JPEG }))] });
        expect(extractId3Cover(t).mime).toBe('image/jpeg');
    });

    it('sniffs the type when the MIME is missing or odd', () => {
        for (const mime of ['', '-->', 'application/octet-stream', 'image/x-weird']) {
            const t = tag({ frames: [frame(3, 'APIC', apicBody({ mime, image: JPEG }))] });
            expect(extractId3Cover(t).mime).toBe('image/jpeg');
        }
        const png = tag({ frames: [frame(3, 'APIC', apicBody({ mime: '', image: PNG }))] });
        expect(extractId3Cover(png).mime).toBe('image/png');
        const webp = tag({ frames: [frame(3, 'APIC', apicBody({ mime: '', image: WEBP }))] });
        expect(extractId3Cover(webp).mime).toBe('image/webp');
    });

    it('skips a picture whose MIME is odd and bytes are unrecognisable', () => {
        const t = tag({ frames: [frame(3, 'APIC', apicBody({ mime: '', image: [1, 2, 3, 4] }))] });
        expect(extractId3Cover(t)).toBeNull();
    });

    it('skips the extended header in v2.3 and v2.4', () => {
        const ext3 = [...be32(6), 0, 0, 0, 0, 0, 0];
        const t3 = tag({ version: 3, flags: 0x40, ext: ext3, frames: [frame(3, 'APIC', apicBody({ image: PNG }))] });
        expect(Array.from(extractId3Cover(t3).data)).toEqual(PNG);
        const ext4 = [...syncsafe(6), 1, 0];
        const t4 = tag({ version: 4, flags: 0x40, ext: ext4, frames: [frame(4, 'APIC', apicBody({ image: PNG }))] });
        expect(Array.from(extractId3Cover(t4).data)).toEqual(PNG);
    });

    it('accounts for frame flag bytes (v2.4 data length indicator, grouping)', () => {
        const body = apicBody({ image: PNG });
        const withDli = [...syncsafe(body.length), ...body];
        const t = tag({ version: 4, frames: [frame(4, 'APIC', withDli, [0, 0x01])] });
        expect(Array.from(extractId3Cover(t).data)).toEqual(PNG);
        const grouped = tag({ version: 3, frames: [frame(3, 'APIC', [7, ...body], [0, 0x20])] });
        expect(Array.from(extractId3Cover(grouped).data)).toEqual(PNG);
    });

    it('ignores compressed or encrypted frames', () => {
        const t = tag({ frames: [frame(3, 'APIC', apicBody({ image: PNG }), [0, 0x80])] });
        expect(extractId3Cover(t)).toBeNull();
    });

    it('stops at padding without reading garbage after it', () => {
        const t = tag({ frames: [text(3, 'TIT2', 'Red')], padding: 40 });
        expect(extractId3Cover(t)).toBeNull();
        const withApicAfterPadding = new Uint8Array([
            ...tag({ frames: [text(3, 'TIT2', 'Red')], padding: 20 }),
            ...frame(3, 'APIC', apicBody({ image: PNG })),
        ]);
        expect(extractId3Cover(withApicAfterPadding)).toBeNull();
    });

    it('does not read past the declared tag end into audio data', () => {
        const t = tag({ frames: [text(3, 'TIT2', 'Red')] });
        const withAudio = new Uint8Array([...t, ...frame(3, 'APIC', apicBody({ image: PNG }))]);
        expect(extractId3Cover(withAudio)).toBeNull();
    });

    it('reverses unsynchronisation when the header flag is set', () => {
        const image = [0xff, 0xd8, 0xff, 0x00, 0xe0, 1];
        const real = (() => {
            const raw = [0, ...enc('image/jpeg'), 0, 3, 0, ...image];
            const f = [...enc('APIC'), ...be32(raw.length), 0, 0, ...raw];
            const synced = [];
            f.forEach((b, i) => { synced.push(b); if (b === 0xff && (i === f.length - 1 || f[i + 1] === 0 || f[i + 1] >= 0xe0)) synced.push(0); });
            return new Uint8Array([...enc('ID3'), 3, 0, 0x80, ...syncsafe(synced.length), ...synced]);
        })();
        expect(Array.from(extractId3Cover(real).data)).toEqual(image);
    });

    it('reads ID3v2.2 PIC frames', () => {
        const pic = (fmt) => [0, ...enc(fmt), 3, 0, ...(fmt === 'PNG' ? PNG : JPEG)];
        const f = (body) => [...enc('PIC'), (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255, ...body];
        const mk = (frames) => new Uint8Array([...enc('ID3'), 2, 0, 0, ...syncsafe(frames.flat().length), ...frames.flat()]);
        expect(extractId3Cover(mk([f(pic('PNG'))])).mime).toBe('image/png');
        const jpg = extractId3Cover(mk([f(pic('JPG'))]));
        expect(jpg.mime).toBe('image/jpeg');
        expect(Array.from(jpg.data)).toEqual(JPEG);
    });

    it('returns null when there is no APIC', () => {
        expect(extractId3Cover(tag({ frames: [text(3, 'TIT2', 'Red'), text(3, 'TPE1', 'Me')] }))).toBeNull();
    });

    it('returns null (never throws) for garbage, empty and wrong input', () => {
        expect(extractId3Cover(new Uint8Array(0))).toBeNull();
        expect(extractId3Cover(null)).toBeNull();
        expect(extractId3Cover(undefined)).toBeNull();
        expect(extractId3Cover(new Uint8Array(500))).toBeNull();
        let seed = 7;
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed & 255; };
        for (let i = 0; i < 50; i++) {
            const junk = new Uint8Array(300).map(rnd);
            expect(() => extractId3Cover(junk)).not.toThrow();
            junk.set([...enc('ID3'), 3, 0, 0, 0, 0, 1, 0]);
            expect(() => extractId3Cover(junk)).not.toThrow();
        }
    });

    it('returns null for every truncation of a valid tag, never throws', () => {
        const full = tag({ frames: [text(3, 'TIT2', 'Red'), frame(3, 'APIC', apicBody({ image: PNG }))] });
        for (let n = 0; n < full.length; n++) {
            expect(() => extractId3Cover(full.slice(0, n))).not.toThrow();
        }
        expect(extractId3Cover(full.slice(0, full.length - 3))).toBeNull();
    });

    it('returns null for an APIC with an unterminated MIME or description', () => {
        const t = tag({ frames: [frame(3, 'APIC', [0, ...enc('image/png')])] });
        expect(extractId3Cover(t)).toBeNull();
        const t2 = tag({ frames: [frame(3, 'APIC', [0, ...enc('image/png'), 0, 3, ...enc('desc')])] });
        expect(extractId3Cover(t2)).toBeNull();
    });
});
