import { createFetchStore } from '../lib/fetchStore';
import { fetchProjects } from '../lib/projectsApi';

const useProjectsStore = createFetchStore(fetchProjects, { what: 'projects' });

export default useProjectsStore;
