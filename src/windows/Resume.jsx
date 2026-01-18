import React from 'react';
import { Download } from 'lucide-react';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const Resume = () => {
    return (
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl">
            {/* Dark macOS-style header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#1a1a1a]">
                <WindowControls target="resume" />
                <span className="text-[13px] font-medium text-gray-300">Resume.pdf</span>
                <a
                    href="/files/resume.pdf"
                    download="Resume.pdf"
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <Download size={16} />
                </a>
            </div>

            {/* PDF Preview - white background */}
            <div className="w-[420px] h-[550px] bg-white overflow-auto">
                <iframe
                    src="/files/resume.pdf#toolbar=0&navpanes=0"
                    title="Resume Preview"
                    className="w-full h-full border-none"
                />
            </div>
        </div>
    );
};

export default WindowWrapper(Resume, 'resume');
