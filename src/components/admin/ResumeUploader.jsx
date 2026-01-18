import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Check } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../lib/firebase';

const ResumeUploader = () => {
    const [uploading, setUploading] = useState(false);
    const [currentResume, setCurrentResume] = useState(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef(null);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file');
            return;
        }

        setUploading(true);
        setSuccess(false);

        try {
            // Delete old resume if exists
            const oldRef = ref(storage, 'resume/resume.pdf');
            try {
                await deleteObject(oldRef);
            } catch (e) {
                // File doesn't exist, continue
            }

            // Upload new resume
            const storageRef = ref(storage, 'resume/resume.pdf');
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            setCurrentResume({
                name: file.name,
                url: url,
                uploadedAt: new Date().toISOString()
            });
            setSuccess(true);

            // Reset success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error uploading resume:', error);
            alert('Failed to upload resume. Please try again.');
        } finally {
            setUploading(false);
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
                            <span>Resume uploaded successfully!</span>
                        </div>
                    )}

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

                    {currentResume && (
                        <div className="mt-4 flex items-center justify-center gap-3 text-gray-400">
                            <FileText size={20} />
                            <span>{currentResume.name}</span>
                            <a
                                href={currentResume.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline text-sm"
                            >
                                View
                            </a>
                        </div>
                    )}
                </div>

                <div className="mt-6 p-4 bg-[#1e1e1e] rounded-lg">
                    <p className="text-gray-400 text-sm">
                        <strong className="text-gray-300">Note:</strong> Uploading a new resume will replace the existing one.
                        The resume will be available at <code className="text-blue-400">/files/resume.pdf</code> after deployment.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResumeUploader;
