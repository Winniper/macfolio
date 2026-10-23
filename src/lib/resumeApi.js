import { RESUME_BUCKET, latestResume, resumeFileName, staleResumes } from './resume';
import { supabase } from './supabase';

const bucket = () => supabase.storage.from(RESUME_BUCKET);

const listResumes = async () => {
    const { data, error } = await bucket().list('', { limit: 100 });
    if (error) throw error;
    return data ?? [];
};

// The current resume, or null if none has been uploaded yet.
export const fetchCurrentResume = async () => {
    const file = latestResume(await listResumes());
    if (!file) return null;

    return {
        name: file.name,
        url: bucket().getPublicUrl(file.name).data.publicUrl,
        downloadUrl: bucket().getPublicUrl(file.name, { download: 'Resume.pdf' }).data.publicUrl,
    };
};

// Upload first, then delete older files: a failed upload keeps the old
// resume and throws. Once the upload succeeded nothing below may throw (the
// new file is already live); a failure there returns the known uploaded file
// with cleanupFailed: true instead.
export const replaceResume = async (file) => {
    const name = resumeFileName();
    const { error } = await bucket().upload(name, file, { contentType: 'application/pdf', upsert: false });
    if (error) throw error;

    try {
        const stale = staleResumes(await listResumes(), name);
        if (stale.length > 0) {
            const { error: removeError } = await bucket().remove(stale);
            if (removeError) throw removeError;
        }
        const resume = await fetchCurrentResume();
        if (resume) return resume;
    } catch (err) {
        console.error('Could not finish resume cleanup:', err);
    }

    return {
        name,
        url: bucket().getPublicUrl(name).data.publicUrl,
        downloadUrl: bucket().getPublicUrl(name, { download: 'Resume.pdf' }).data.publicUrl,
        cleanupFailed: true,
    };
};
