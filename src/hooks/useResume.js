import { useCallback, useEffect, useState } from 'react';

import { fetchCurrentResume } from '../lib/resumeApi';

// The current resume ({ url, downloadUrl }, or null when none is uploaded),
// shared by the desktop Resume window and the phone Resume app.
const useResume = () => {
    const [resume, setResume] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const retry = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            setResume(await fetchCurrentResume());
        } catch (err) {
            console.error('Error fetching resume:', err);
            setError('Unable to load resume');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        retry();
    }, [retry]);

    return { resume, loading, error, retry };
};

export default useResume;
