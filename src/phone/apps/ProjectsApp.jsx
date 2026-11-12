import { useState } from 'react';
import { AlertTriangle, ChevronRight, FileText, Folder, Github, Globe, Loader2, RefreshCw } from 'lucide-react';

import useProjects from '../../hooks/useProjects';
import { normalizeAddress } from '../../lib/browser';
import useWindowStore from '../../store/window';
import AppScreen from '../AppScreen';

// Files-style Projects: a list of projects, then one project's links.
const ProjectsApp = () => {
    const openWindow = useWindowStore((state) => state.openWindow);
    const { projects, loading, error, retry } = useProjects();
    const [openId, setOpenId] = useState(null);

    // If the open project disappears from the list, this falls back to level 1.
    const project = projects.find((item) => item.id === openId);

    if (project) {
        const github = normalizeAddress(project.github);

        return (
            <AppScreen title={project.title} back="Projects" onBack={() => setOpenId(null)}>
                <ul className="phone-group">
                    {project.website && (
                        <li>
                            <button
                                type="button"
                                className="phone-row"
                                onClick={() => openWindow('safari', { url: project.website, title: project.title })}
                            >
                                <Globe size={20} className="phone-row-icon" aria-hidden="true" />
                                <span className="phone-row-label">Website</span>
                                <ChevronRight size={18} className="phone-row-chevron" aria-hidden="true" />
                            </button>
                        </li>
                    )}
                    {github && (
                        <li>
                            <button
                                type="button"
                                className="phone-row"
                                onClick={() => window.open(github, '_blank', 'noopener,noreferrer')}
                            >
                                <Github size={20} className="phone-row-icon" aria-hidden="true" />
                                <span className="phone-row-label">GitHub</span>
                                <ChevronRight size={18} className="phone-row-chevron" aria-hidden="true" />
                            </button>
                        </li>
                    )}
                </ul>
            </AppScreen>
        );
    }

    return (
        <AppScreen title="Projects">
            {loading ? (
                <div className="phone-terminal-state">
                    <Loader2 size={30} className="phone-spin" aria-hidden="true" />
                    <span>Loading projects...</span>
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
            ) : (
                <>
                    {projects.length === 0 ? (
                        <p className="phone-empty">No projects yet.</p>
                    ) : (
                        <ul className="phone-group">
                            {projects.map((item) => (
                                <li key={item.id}>
                                    <button type="button" className="phone-row" onClick={() => setOpenId(item.id)}>
                                        <Folder size={22} className="phone-row-icon" aria-hidden="true" />
                                        <span className="phone-row-label">{item.title}</span>
                                        <ChevronRight size={18} className="phone-row-chevron" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <ul className="phone-group">
                        <li>
                            <button type="button" className="phone-row" onClick={() => openWindow('resume')}>
                                <FileText size={22} className="phone-row-icon" aria-hidden="true" />
                                <span className="phone-row-label">Resume.pdf</span>
                                <ChevronRight size={18} className="phone-row-chevron" aria-hidden="true" />
                            </button>
                        </li>
                    </ul>
                </>
            )}
        </AppScreen>
    );
};

export default ProjectsApp;
