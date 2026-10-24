// Minimal ID3v2 reader: finds the embedded album cover (APIC / PIC frame).
// Pure and defensive: any malformed input yields null, never an exception.

const latin1 = (bytes, start, end) => {
    let s = '';
    for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
    return s;
};

const syncsafe = (b, i) => ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f);
const isSyncsafe = (b, i) => ((b[i] | b[i + 1] | b[i + 2] | b[i + 3]) & 0x80) === 0;
const uint32 = (b, i) => ((b[i] * 0x1000000) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]));

const isId3 = (b) => b && b.length >= 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33;

// Total tag length (header included) from the first 10 bytes, or null.
export const id3TagLength = (header) => {
    if (!isId3(header)) return null;
    const version = header[3];
    if (version < 2 || version > 4 || header[4] === 0xff) return null;
    if (!isSyncsafe(header, 6)) return null;
    const footer = version === 4 && (header[5] & 0x10) ? 10 : 0;
    return 10 + syncsafe(header, 6) + footer;
};

const unsynchronise = (bytes) => {
    const out = [];
    for (let i = 0; i < bytes.length; i++) {
        out.push(bytes[i]);
        if (bytes[i] === 0xff && bytes[i + 1] === 0) i++;
    }
    return Uint8Array.from(out);
};

const KNOWN_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

const sniff = (d) => {
    if (d.length >= 8 && d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47) return 'image/png';
    if (d.length >= 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff) return 'image/jpeg';
    if (d.length >= 12 && latin1(d, 0, 4) === 'RIFF' && latin1(d, 8, 12) === 'WEBP') return 'image/webp';
    return null;
};

const resolveMime = (declared, data) => {
    let mime = declared.trim().toLowerCase();
    if (mime === 'image/jpg' || mime === 'jpg' || mime === 'jpeg') mime = 'image/jpeg';
    if (mime === 'png') mime = 'image/png';
    if (KNOWN_MIMES.includes(mime)) return mime;
    return sniff(data);
};

// Index just past the description's terminator, or -1.
const skipDescription = (b, start, end, encoding) => {
    if (encoding === 1 || encoding === 2) {
        for (let i = start; i + 1 < end; i += 2) {
            if (b[i] === 0 && b[i + 1] === 0) return i + 2;
        }
        return -1;
    }
    for (let i = start; i < end; i++) if (b[i] === 0) return i + 1;
    return -1;
};

// Parses an APIC (v2.3/2.4) or PIC (v2.2) body into { type, mime, data }.
const parsePicture = (b, start, end, legacy) => {
    if (end - start < 4) return null;
    const encoding = b[start];
    let i = start + 1;
    let declared;
    if (legacy) {
        declared = latin1(b, i, i + 3);
        i += 3;
    } else {
        let z = i;
        while (z < end && b[z] !== 0) z++;
        if (z >= end) return null;
        declared = latin1(b, i, z);
        i = z + 1;
    }
    if (i >= end) return null;
    const type = b[i];
    i = skipDescription(b, i + 1, end, encoding);
    if (i < 0 || i >= end) return null;
    const data = b.slice(i, end);
    const mime = resolveMime(declared, data);
    return mime ? { type, mime, data } : null;
};

export const extractId3Cover = (bytes) => {
    try {
        if (!(bytes instanceof Uint8Array) || !isId3(bytes)) return null;
        const total = id3TagLength(bytes);
        if (total === null) return null;
        const version = bytes[3];
        const flags = bytes[5];
        const footer = version === 4 && (flags & 0x10) ? 10 : 0;
        const tagEnd = Math.min(total - footer, bytes.length);
        let b = bytes.subarray(0, tagEnd);
        if (flags & 0x80) b = Uint8Array.from([...b.subarray(0, 10), ...unsynchronise(b.subarray(10))]);

        let pos = 10;
        if (version >= 3 && (flags & 0x40)) {
            if (pos + 4 > b.length) return null;
            pos += version === 4 ? syncsafe(b, pos) : 4 + uint32(b, pos);
        }

        const legacy = version === 2;
        const headerSize = legacy ? 6 : 10;
        const wanted = legacy ? 'PIC' : 'APIC';
        let first = null;

        while (pos + headerSize <= b.length && b[pos] !== 0) {
            const id = latin1(b, pos, pos + (legacy ? 3 : 4));
            const size = legacy
                ? (b[pos + 3] << 16) | (b[pos + 4] << 8) | b[pos + 5]
                : version === 4 ? syncsafe(b, pos + 4) : uint32(b, pos + 4);
            const fl2 = legacy ? 0 : b[pos + 9];
            let start = pos + headerSize;
            const end = start + size;
            if (end > b.length) break;

            if (id === wanted) {
                let usable = true;
                if (version === 3) {
                    if (fl2 & 0xc0) usable = false; // compressed / encrypted
                    else if (fl2 & 0x20) start += 1; // grouping id
                } else if (version === 4) {
                    if (fl2 & 0x0c) usable = false; // compressed / encrypted
                    if (fl2 & 0x40) start += 1; // grouping id
                    if (fl2 & 0x01) start += 4; // data length indicator
                }
                if (usable && start < end) {
                    const pic = parsePicture(b, start, end, legacy);
                    if (pic) {
                        if (pic.type === 3) return { mime: pic.mime, data: pic.data };
                        if (!first) first = pic;
                    }
                }
            }
            pos = end;
        }
        return first ? { mime: first.mime, data: first.data } : null;
    } catch {
        return null;
    }
};
