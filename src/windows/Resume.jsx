import React from 'react';
import { Download } from 'lucide-react';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const Resume = () => {
    return (
        <>
            <div id="window-header">
                <WindowControls target="resume" />
                <p>Resume.pdf</p>
                <a
                    href="/files/resume.pdf"
                    download="Resume.pdf"
                    className="flex items-center gap-1 rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600"
                >
                    <Download size={14} />
                    <span>Download</span>
                </a>
            </div>

            <div className="relative h-[70vh] w-full overflow-hidden bg-gray-200">
                <iframe
                    src="/files/resume.pdf"
                    title="Resume Preview"
                    className="h-full w-full border-none"
                />
            </div>
        </>
    );
};

export default WindowWrapper(Resume, 'resume');
