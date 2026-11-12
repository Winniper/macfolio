import { AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';

import useSkills from '../../hooks/useSkills';
import AppScreen from '../AppScreen';

// The desktop Terminal's look, reflowed: category above its technologies.
const SkillsApp = () => {
    const { skills, loading, error, retry } = useSkills();

    return (
        <AppScreen title="Skills">
            <div className="phone-terminal">
                <div className="phone-terminal-prompt">
                    <span>@Debaditya</span> <span>%</span> <span>show tech stack</span>
                </div>

                {loading ? (
                    <div className="phone-terminal-state">
                        <Loader2 size={30} className="phone-spin" aria-hidden="true" />
                        <span>Fetching skills...</span>
                    </div>
                ) : error ? (
                    <div className="phone-terminal-state is-error">
                        <div className="phone-terminal-error">
                            <AlertTriangle size={18} aria-hidden="true" />
                            <span>Error: {error}</span>
                        </div>
                        <button type="button" onClick={retry}>
                            <RefreshCw size={14} aria-hidden="true" />
                            <span>Retry</span>
                        </button>
                    </div>
                ) : skills.length === 0 ? (
                    <div className="phone-terminal-state">
                        <span>No skills configured yet.</span>
                    </div>
                ) : (
                    <>
                        <ul className="phone-terminal-skills">
                            {skills.map((skill) => (
                                <li key={skill.id || skill.category}>
                                    <div className="phone-terminal-category">
                                        <Check size={16} aria-hidden="true" />
                                        <span>{skill.category}</span>
                                    </div>
                                    <p>{Array.isArray(skill.items) ? skill.items.join(', ') : skill.items}</p>
                                </li>
                            ))}
                        </ul>
                        <div className="phone-terminal-footer">
                            <Check size={14} aria-hidden="true" />
                            <span>{skills.length} of {skills.length} stacks loaded successfully (100%)</span>
                        </div>
                    </>
                )}
            </div>
        </AppScreen>
    );
};

export default SkillsApp;
