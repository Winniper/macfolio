import React from 'react';
import { Check, MessageSquare } from 'lucide-react';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';
import { techStack } from '../constants';

const Terminal = () => {
    return (
        <div className="flex flex-col rounded-2xl overflow-hidden backdrop-blur-xl bg-[#1a2f38]/90 border border-white/10 shadow-2xl min-w-[420px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <WindowControls target="terminal" />
                <span className="text-[14px] font-medium text-white/90">Tech Stack</span>
                <div className="w-[68px]"></div>
            </div>

            {/* Terminal body */}
            <div className="px-6 pb-6 pt-2 font-mono text-sm">
                {/* Command prompt */}
                <div className="flex items-center gap-2 mb-6 text-gray-300">
                    <span className="text-purple-400">@adrian</span>
                    <span className="text-white/60">%</span>
                    <span className="text-white/80">show tech stack</span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[140px_1fr] gap-4 mb-4 text-white/60 text-xs uppercase tracking-wider">
                    <span>Category</span>
                    <span>Technologies</span>
                </div>

                {/* Tech stack rows */}
                <div className="space-y-2">
                    {techStack.map(({ category, items }) => (
                        <div key={category} className="grid grid-cols-[140px_1fr] gap-4 items-start">
                            <div className="flex items-center gap-2">
                                <Check size={16} className="text-emerald-400" />
                                <span className="text-cyan-400 font-medium">{category}</span>
                            </div>
                            <span className="text-gray-300">{items.join(', ')}</span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs">
                        <Check size={14} />
                        <span>{techStack.length} of {techStack.length} stacks loaded successfully (100%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <MessageSquare size={14} />
                        <span>Render time: 6ms</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TerminalWindow = WindowWrapper(Terminal, 'terminal');
export default TerminalWindow;