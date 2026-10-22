import { useEffect } from 'react';

import useProjectsStore from '../store/projects';

// Project list shared by every window; the first caller triggers the fetch.
const useProjects = () => {
    const status = useProjectsStore((state) => state.status);
    const projects = useProjectsStore((state) => state.projects);
    const error = useProjectsStore((state) => state.error);
    const load = useProjectsStore((state) => state.load);

    useEffect(() => {
        load();
    }, [load]);

    return {
        projects,
        loading: status === 'idle' || status === 'loading',
        error,
        retry: load,
    };
};

export default useProjects;
