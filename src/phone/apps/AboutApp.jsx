import { ChevronRight } from 'lucide-react';

import { profile } from '../../constants';
import useProjects from '../../hooks/useProjects';
import { favoritesFromProjects } from '../../lib/browser';
import { initialsOf } from '../../lib/profile';
import useWindowStore from '../../store/window';
import AppScreen from '../AppScreen';

// Settings-style "About": the same data as the desktop's About This Mac.
const AboutApp = () => {
    const openWindow = useWindowStore((state) => state.openWindow);
    const { projects, loading, error } = useProjects();
    const live = favoritesFromProjects(projects).length;

    return (
        <AppScreen title="About">
            <div className="phone-hero">
                <div className="phone-avatar" aria-hidden="true">
                    {profile.avatar ? <img src={profile.avatar} alt="" /> : initialsOf(profile.name)}
                </div>
                <h2>{profile.name}</h2>
                {profile.role && <p>{profile.role}</p>}
            </div>

            <ul className="phone-group">
                {profile.location && (
                    <li className="phone-row">
                        <span className="phone-row-label">Location</span>
                        <span className="phone-row-value">{profile.location}</span>
                    </li>
                )}
                <li className="phone-row">
                    <span className="phone-row-label">Projects</span>
                    <span className="phone-row-value">
                        {loading || error ? '—' : `${projects.length} (${live} live)`}
                    </span>
                </li>
            </ul>

            <ul className="phone-group">
                {[['resume', 'Resume'], ['contact', 'Contact']].map(([id, label]) => (
                    <li key={id}>
                        <button type="button" className="phone-row" onClick={() => openWindow(id)}>
                            <span className="phone-row-label">{label}</span>
                            <ChevronRight size={18} className="phone-row-chevron" aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>
        </AppScreen>
    );
};

export default AboutApp;
