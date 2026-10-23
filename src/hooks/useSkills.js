import { useEffect } from 'react';

import useSkillsStore from '../store/skills';

// Skill list shared by Terminal and Spotlight; the first caller triggers the fetch.
const useSkills = () => {
    const status = useSkillsStore((state) => state.status);
    const skills = useSkillsStore((state) => state.items);
    const error = useSkillsStore((state) => state.error);
    const load = useSkillsStore((state) => state.load);

    useEffect(() => {
        load();
    }, [load]);

    return {
        skills,
        loading: status === 'idle' || status === 'loading',
        error,
        retry: load,
    };
};

export default useSkills;
