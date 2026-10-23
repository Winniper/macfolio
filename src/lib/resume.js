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

export const staleResumes = (files, keepName) =>
    (Array.isArray(files) ? files : [])
        .map((file) => file?.name)
        .filter((name) => name && name !== keepName);

export const validateResume = (file) => {
    if (file?.type !== 'application/pdf') return 'Please choose a PDF file.';
    if (file.size > MAX_RESUME_BYTES) return 'The PDF must be 10 MB or smaller.';
    return null;
};
