// One resume at a time: each upload is resume-<timestamp>.pdf, then every
// other file in the bucket is removed. The newest name always wins.
export const RESUME_BUCKET = 'resume';
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const RESUME_NAME = /^resume-(\d+)\.pdf$/;
const stamp = (name) => Number(RESUME_NAME.exec(name)[1]);

export const resumeFileName = (now = Date.now()) => `resume-${now}.pdf`;

export const latestResume = (files) =>
    (Array.isArray(files) ? files : [])
        .filter((file) => RESUME_NAME.test(file?.name ?? ''))
        .sort((a, b) => stamp(b.name) - stamp(a.name))[0] ?? null;

// Never returns a resume newer than keepName, so overlapping uploads can't
// delete each other and the newest one always survives. If keepName isn't a
// resume name, no resume is removed.
export const staleResumes = (files, keepName) => {
    const keep = RESUME_NAME.exec(keepName ?? '');
    return (Array.isArray(files) ? files : [])
        .map((file) => file?.name)
        .filter((name) => {
            if (!name || name === keepName) return false;
            if (!RESUME_NAME.test(name)) return true;
            return keep !== null && stamp(name) < Number(keep[1]);
        });
};

export const validateResume = (file) => {
    if (file?.type !== 'application/pdf') return 'Please choose a PDF file.';
    if (file.size > MAX_RESUME_BYTES) return 'The PDF must be 10 MB or smaller.';
    return null;
};
