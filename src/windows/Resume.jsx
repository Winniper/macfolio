import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchCurrentResume } from '../lib/resumeApi';
import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';

const Resume = () => {
    const [resume, setResume] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchResumeUrl = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            setResume(await fetchCurrentResume());
        } catch (err) {
            console.error('Error fetching resume:', err);
            setError('Unable to load resume');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResumeUrl();
    }, [fetchResumeUrl]);

    return (
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl flex-1 min-h-0 w-full">
            {/* Dark macOS-style header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-[#1a1a1a] relative" data-titlebar>
                <WindowControls target="resume" />
                <span className="text-[13px] font-medium text-gray-300 absolute left-1/2 -translate-x-1/2">Resume.pdf</span>
                {resume && !loading && !error && (
                    <a
                        href={resume.downloadUrl}
                        download="Resume.pdf"
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <Download size={16} />
                    </a>
                )}
                {(!resume || loading || error) && <div className="w-4"></div>}
            </div>

            {/* PDF Preview area */}
            <div className="flex-1 min-h-0 w-full bg-white overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 bg-gray-100">
                        <Loader2 size={40} className="animate-spin text-blue-500" />
                        <span className="text-gray-600">Loading resume...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 bg-gray-100">
                        <div className="flex items-center gap-2 text-red-500">
                            <AlertTriangle size={24} />
                            <span className="text-lg">{error}</span>
                        </div>
                        <p className="text-gray-500 text-sm">Please check your connection and try again.</p>
                        <button
                            onClick={fetchResumeUrl}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                        >
                            <RefreshCw size={16} />
                            <span>Retry</span>
                        </button>
                    </div>
                ) : !resume ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 bg-gray-100">
                        <span className="text-lg text-gray-600">No resume yet.</span>
                        <p className="text-gray-500 text-sm">Check back soon.</p>
                    </div>
                ) : (
                    <iframe
                        src={`${resume.url}#toolbar=0&navpanes=0&view=FitH`}
                        title="Resume Preview"
                        className="w-full h-full border-none block"
                    />
                )}
            </div>
        </div>
    );
};

const ResumeWindow = WindowWrapper(Resume, 'resume');

export default ResumeWindow;

