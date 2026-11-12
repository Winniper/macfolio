import { ChevronRight, Github, Linkedin, Mail } from 'lucide-react';

import { contactIntro, contactLinks, profile } from '../../constants';
import { initialsOf } from '../../lib/profile';
import AppScreen from '../AppScreen';

const LINK_ICONS = { github: Github, linkedin: Linkedin, gmail: Mail };

const ContactApp = () => (
    <AppScreen title="Contact">
        <div className="phone-hero">
            <div className="phone-avatar" aria-hidden="true">
                {profile.avatar ? <img src={profile.avatar} alt="" /> : initialsOf(profile.name)}
            </div>
            <h2>{contactIntro.heading}</h2>
            <p>{contactIntro.body}</p>
        </div>

        <ul className="phone-group">
            {contactLinks.map((item) => {
                const Icon = LINK_ICONS[item.id];

                return (
                    <li key={item.id}>
                        <a
                            className="phone-row"
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Icon size={22} aria-hidden="true" />
                            <span className="phone-row-label">{item.name}</span>
                            <ChevronRight size={18} className="phone-row-chevron" aria-hidden="true" />
                        </a>
                    </li>
                );
            })}
        </ul>
    </AppScreen>
);

export default ContactApp;
