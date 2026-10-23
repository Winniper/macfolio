import { createFetchStore } from '../lib/fetchStore';
import { fetchSkills } from '../lib/skillsApi';

const useSkillsStore = createFetchStore(fetchSkills, { what: 'skills' });

export default useSkillsStore;
