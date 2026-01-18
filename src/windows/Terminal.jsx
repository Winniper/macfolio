import React, { useState, useEffect } from 'react';
import { Check, MessageSquare, Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';
import { techStack as fallbackTechStack } from '../constants';

const Terminal = () => {
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'skills'));
                const skillsList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // If no skills in Firestore, use fallback
                setSkills(skillsList.length > 0 ? skillsList : fallbackTechStack);
            } catch (error) {
                console.error('Error fetching skills:', error);
                // Use fallback if Firebase not configured
                setSkills(fallbackTechStack);
            } finally {
                setLoading(false);
            }
        };
        fetchSkills();
    }, []);

    return (
        <div className="flex flex-col rounded-xl overflow-hidden shadow-2xl w-[min(480px,90vw)]">
            {/* macOS Terminal header - solid dark gray */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#3d3d3d] border-b border-[#2a2a2a]">
                <WindowControls target="terminal" />
                <span className="text-[13px] font-medium text-gray-300">Tech Stack</span>
                <div className="w-[68px]"></div>
            </div>

            {/* Terminal body - solid black */}
            <div className="bg-[#1e1e1e] px-6 py-5 font-mono text-sm">
                {/* Command prompt */}
                <div className="flex items-center gap-2 mb-6 text-gray-300">
                    <span className="text-purple-400">@Debaditya</span>
                    <span className="text-white/60">%</span>
                    <span className="text-white/80">show tech stack</span>
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Loading skills...</span>
                    </div>
                ) : (
                    <>
                        {/* Table header */}
                        <div className="grid grid-cols-[140px_1fr] gap-4 mb-4 text-white/50 text-xs uppercase tracking-wider">
                            <span>Category</span>
                            <span>Technologies</span>
                        </div>

                        {/* Tech stack rows */}
                        <div className="space-y-2">
                            {skills.map((skill) => (
                                <div key={skill.id || skill.category} className="grid grid-cols-[140px_1fr] gap-4 items-start">
                                    <div className="flex items-center gap-2">
                                        <Check size={16} className="text-emerald-400" />
                                        <span className="text-cyan-400 font-medium">{skill.category}</span>
                                    </div>
                                    <span className="text-gray-300">
                                        {Array.isArray(skill.items) ? skill.items.join(', ') : skill.items}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="mt-6 pt-4 border-t border-[#333] space-y-2">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs">
                                <Check size={14} />
                                <span>{skills.length} of {skills.length} stacks loaded successfully (100%)</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-xs">
                                <MessageSquare size={14} />
                                <span>Render time: 6ms</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const TerminalWindow = WindowWrapper(Terminal, 'terminal');
export default TerminalWindow;