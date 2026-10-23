import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Check } from 'lucide-react';
import { fetchCurrentResume, replaceResume } from '../../lib/resumeApi';
import { validateResume } from '../../lib/resume';

const uploadedOn = (name) => {
    const stamp = name.match(/\d+/)?.[0];
    return stamp ? new Date(Number(stamp)).toLocaleString() : null;
};

const ResumeUploader = () => {
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentResume, setCurrentResume] = useState(null);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const successTimer = useRef(null);

    useEffect(() => {
        let cancelled = false;
        fetchCurrentResume()
            .then((resume) => { if (!cancelled) setCurrentResume(resume); })
            .catch((err) => {
                console.error('Error loading resume:', err);
                if (!cancelled) setError('Could not load the current resume.');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => () => clearTimeout(successTimer.current), []);

    const handleUpload = async (e) => {
        const input = e.target;
        const file = input.files[0];
        if (!file) return;

        clearTimeout(successTimer.current);
        setSuccess(null);
        setError(null);

        const problem = validateResume(file);
        if (problem) {
            setError(problem);
            input.value = '';
            return;
        }

        setUploading(true);

        try {
            const resume = await replaceResume(file);
            setCurrentResume(resume);
            if (resume.cleanupFailed) {
                // The warning stays until the next action.
                setSuccess("Uploaded — but an older copy couldn't be removed. Try uploading again.");
            } else {
                setSuccess('Resume uploaded successfully!');
                successTimer.current = setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            console.error('Error uploading resume:', err);
            setError('Upload failed — your previous resume is unchanged.');
        } finally {
            setUploading(false);
            input.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Resume</h2>

            <div className="bg-[#252525] rounded-lg p-6">
                <div className="text-center">
                    <input
                        type="file"
                        accept=".pdf"
                        ref={fileInputRef}
                        onChange={handleUpload}
                        className="hidden"
                    />

                    {success && (
                        <div className="mb-4 flex items-center justify-center gap-2 text-green-400">
                            <Check size={20} />
                            <span>{success}</span>
                        </div>
                    )}

                    {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}

                    <div
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`border-2 border-dashed border-[#3d3d3d] rounded-lg p-8 cursor-pointer hover:border-blue-500 transition-colors ${uploading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        <div className="flex flex-col items-center gap-4">
                            {uploading ? (
                                <>
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                                    <span className="text-gray-400">Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={48} className="text-gray-500" />
                                    <div>
                                        <p className="text-white font-medium">Click to upload resume</p>
                                        <p className="text-gray-500 text-sm">PDF files only</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <p className="mt-4 text-gray-500 text-sm">Loading...</p>
                    ) : currentResume ? (
                        <div className="mt-4 flex items-center justify-center gap-3 text-gray-400">
                            <FileText size={20} />
                            <span>
                                Current resume
                                {uploadedOn(currentResume.name) && ` — uploaded ${uploadedOn(currentResume.name)}`}
                            </span>
                            <a
                                href={currentResume.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline text-sm"
                            >
                                View
                            </a>
                        </div>
                    ) : (
                        <p className="mt-4 text-gray-500 text-sm">No resume uploaded yet.</p>
                    )}
                </div>

                <div className="mt-6 p-4 bg-[#1e1e1e] rounded-lg">
                    <p className="text-gray-400 text-sm">
                        <strong className="text-gray-300">Note:</strong> Uploading a PDF replaces the current resume — the old file is deleted, so only one is ever kept. PDF only, up to 10 MB.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResumeUploader;
