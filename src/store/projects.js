import { createProjectsStore } from '../lib/projectsStore';
import { fetchProjects } from '../lib/projectsApi';

const useProjectsStore = createProjectsStore(fetchProjects);

export default useProjectsStore;
