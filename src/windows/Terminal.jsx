import React from 'react';
import { Check } from 'lucide-react';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';
import { techStack } from '../constants';

const Terminal = () => {
    return (
        <>
            <div id="window-header">
                <WindowControls target="terminal" />
                <p>User — -zsh — 80x24</p>
                <div></div>
            </div>

            <div className="terminal-body">
                <div className="prompt-line">
                    <span className="text-[#32cd32]">➜</span>
                    <span className="text-[#6bb3f8]">~</span>
                    <span className="text-[#e0e0e0]">show-tech-stack</span>
                </div>

                <div className="space-y-4">
                    {techStack.map(({ category, items }) => (
                        <div key={category}>
                            <div className="category-label">{category}:</div>
                            <div className="grid grid-cols-2 gap-2 pl-4">
                                {items.map((item) => (
                                    <div key={item} className="tech-item">
                                        <Check size={14} className="check-icon" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="footer-text">
                    ✓ {techStack.length} of {techStack.length} stacks loaded successfully...
                </div>
            </div>
        </>
    );
};

const TerminalWindow = WindowWrapper(Terminal, 'terminal');
export default TerminalWindow;