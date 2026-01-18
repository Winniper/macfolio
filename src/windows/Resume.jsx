import React from 'react';
import { Download } from 'lucide-react';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const Resume = () => {
    return (
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl w-[700px] h-[600px]">
            {/* Dark macOS-style header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#1a1a1a] relative">
                <WindowControls target="resume" />
                <span className="text-[13px] font-medium text-gray-300 absolute left-1/2 -translate-x-1/2">Resume.pdf</span>
                <a
                    href="/files/resume.pdf"
                    download="Resume.pdf"
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <Download size={16} />
                </a>
            </div>

            {/* PDF Preview - white background */}
            <div className="flex-1 w-full bg-white overflow-hidden">
                <iframe
                    src="/files/resume.pdf#toolbar=0&navpanes=0&view=FitH"
                    title="Resume Preview"
                    className="w-full h-full border-none block"
                />
            </div>
        </div>
    );
};

export default WindowWrapper(Resume, 'resume');
