import AboutApp from './AboutApp';
import ContactApp from './ContactApp';
import ProjectsApp from './ProjectsApp';
import SkillsApp from './SkillsApp';

// Phone app screens by registry id. Ids missing here show "Coming soon".
export const PHONE_APPS = {
    contact: ContactApp,
    about: AboutApp,
    finder: ProjectsApp,
    terminal: SkillsApp,
};
