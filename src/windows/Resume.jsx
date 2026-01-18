import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const Resume = () => {
    const [resumeUrl, setResumeUrl] = useState('/files/resume.pdf');

    useEffect(() => {
        const fetchResumeUrl = async () => {
            try {
                const storageRef = ref(storage, 'resume/resume.pdf');
                const url = await getDownloadURL(storageRef);
                setResumeUrl(url);
            } catch (error) {
                // Fallback to local file if Firebase Storage not configured or file not found
                console.log('Using local resume file');
            }
        };
        fetchResumeUrl();
    }, []);

    return (
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl w-[min(700px,90vw)] h-[min(600px,70vh)]">
            {/* Dark macOS-style header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#1a1a1a] relative">
                <WindowControls target="resume" />
                <span className="text-[13px] font-medium text-gray-300 absolute left-1/2 -translate-x-1/2">Resume.pdf</span>
                <a
                    href={resumeUrl}
                    download="Resume.pdf"
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <Download size={16} />
                </a>
            </div>

            {/* PDF Preview - white background */}
            <div className="flex-1 w-full bg-white overflow-hidden">
                <iframe
                    src={`${resumeUrl}#toolbar=0&navpanes=0&view=FitH`}
                    title="Resume Preview"
                    className="w-full h-full border-none block"
                />
            </div>
        </div>
    );
};

export default WindowWrapper(Resume, 'resume');
