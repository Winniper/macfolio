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

// Upload first, then delete everything else: a failed upload keeps the old
// resume. A failed cleanup does not throw (the new file is already live); the
// result carries cleanupFailed: true instead.
export const replaceResume = async (file) => {
    const name = resumeFileName();
    const { error } = await bucket().upload(name, file, { contentType: 'application/pdf', upsert: false });
    if (error) throw error;

    const stale = staleResumes(await listResumes(), name);
    let cleanupFailed = false;
    if (stale.length > 0) {
        const { error: removeError } = await bucket().remove(stale);
        if (removeError) {
            console.error('Could not remove old resumes:', removeError);
            cleanupFailed = true;
        }
    }

    const resume = await fetchCurrentResume();
    return cleanupFailed ? { ...resume, cleanupFailed } : resume;
};
