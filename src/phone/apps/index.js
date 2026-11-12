import AboutApp from './AboutApp';
import ContactApp from './ContactApp';
import MusicApp from './MusicApp';
import ProjectsApp from './ProjectsApp';
import ResumeApp from './ResumeApp';
import SkillsApp from './SkillsApp';

// Phone app screens by registry id. Ids missing here show "Coming soon".
export const PHONE_APPS = {
    contact: ContactApp,
    about: AboutApp,
    finder: ProjectsApp,
    terminal: SkillsApp,
    resume: ResumeApp,
    music: MusicApp,
};
