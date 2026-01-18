import React from 'react';
import { Github, Linkedin, Mail } from 'lucide-react';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const Contact = () => {
    const links = [
        {
            name: 'Github',
            icon: Github,
            color: 'bg-[#ef5350]', // Red
            hover: 'hover:bg-[#d32f2f]',
            link: 'https://github.com/DebadityaBarman' // Assuming this based on previous context or placeholder
        },
        {
            name: 'LinkedIn',
            icon: Linkedin,
            color: 'bg-[#0077b5]', // LinkedIn Blue
            hover: 'hover:bg-[#006097]',
            link: 'https://linkedin.com/in/debadityabarman' // Placeholder
        },
        {
            name: 'Gmail',
            icon: Mail,
            color: 'bg-[#43a047]', // Green (like the Platform card in reference) or Gmail Red
            hover: 'hover:bg-[#2e7d32]',
            link: 'mailto:your.email@gmail.com'
        }
    ];

    return (
        <div className="flex flex-col rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] w-[min(600px,90vw)] h-[min(350px,60vh)]">
            {/* Window Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#1a1a1a]">
                <WindowControls target="contact" />
                <span className="text-[13px] font-medium text-gray-400">Contact Me</span>
                <div className="w-[52px]"></div> {/* Spacer for alignment */}
            </div>

            {/* Content Body */}
            <div className="flex flex-col p-8 text-white h-full relative">

                {/* Profile Section */}
                <div className="mb-6">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 mb-4 shadow-lg">
                        <img
                            src="https://github.com/shadcn.png"
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </div>

                    <h1 className="text-2xl font-bold mb-2">Let's Connect</h1>
                    <p className="text-gray-400 text-sm max-w-md">
                        Got an idea? A bug to squash? Or just wanna talk tech? I'm in.
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-3 gap-4 mt-auto">
                    {links.map((item) => (
                        <a
                            key={item.name}
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${item.color} ${item.hover} h-24 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-lg`}
                        >
                            <item.icon size={24} className="text-white" />
                            <span className="font-semibold text-sm">{item.name}</span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WindowWrapper(Contact, 'contact');
