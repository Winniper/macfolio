import { profile } from '../constants';
import WindowControls from '../components/WindowControl';
import WindowWrapper from '../hoc/WindowWrapper';
import useProjects from '../hooks/useProjects';
import { favoritesFromProjects } from '../lib/browser';
import { initialsOf } from '../lib/profile';
import useWindowStore from '../store/window';

// macOS-style "About This Mac", where the specs are the portfolio's owner.
// Only real data is shown: role/location lines appear once set in constants.
const AboutThisMac = () => {
    const openWindow = useWindowStore((state) => state.openWindow);
    const { projects, loading, error } = useProjects();
    const live = favoritesFromProjects(projects).length;

    return (
        <div className="about">
            <div className="about-titlebar" data-titlebar>
                <WindowControls target="about" />
            </div>

            <div className="about-body">
                <div className="about-avatar">
                    {profile.avatar ? <img src={profile.avatar} alt="" /> : initialsOf(profile.name)}
                </div>

                <div className="about-details">
                    <h2 className="about-name">{profile.name}</h2>
                    {profile.role && <p className="about-role">{profile.role}</p>}

                    <dl className="about-specs">
                        {profile.location && (
                            <>
                                <dt>Location</dt>
                                <dd>{profile.location}</dd>
                            </>
                        )}
                        <dt>Projects</dt>
                        <dd>{loading || error ? '—' : `${projects.length} (${live} live)`}</dd>
                    </dl>

                    <div className="about-actions">
                        <button type="button" onClick={() => openWindow('resume')}>Resume</button>
                        <button type="button" onClick={() => openWindow('contact')}>Contact</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AboutWindow = WindowWrapper(AboutThisMac, 'about');
export default AboutWindow;
