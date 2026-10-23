import { describe, it, expect } from 'vitest';
import { MAX_RESUME_BYTES, latestResume, resumeFileName, staleResumes, validateResume } from './resume';

describe('resume files', () => {
    it('names each upload by time, so every version gets a fresh URL', () => {
        expect(resumeFileName(1700000000000)).toBe('resume-1700000000000.pdf');
    });

    it('picks the newest resume and ignores anything else in the bucket', () => {
        const files = [
            { name: 'resume-1700000000000.pdf' },
            { name: '.emptyFolderPlaceholder' },
            { name: 'resume-1800000000000.pdf' },
            { name: 'notes.txt' },
        ];
        expect(latestResume(files)).toEqual({ name: 'resume-1800000000000.pdf' });
        expect(latestResume([])).toBeNull();
        expect(latestResume(null)).toBeNull();
    });

    it('marks every other file for deletion once a new resume is in', () => {
        expect(staleResumes(
            [{ name: 'resume-1.pdf' }, { name: 'resume-2.pdf' }, { name: '.emptyFolderPlaceholder' }],
            'resume-2.pdf',
        )).toEqual(['resume-1.pdf', '.emptyFolderPlaceholder']);
        expect(staleResumes(null, 'resume-2.pdf')).toEqual([]);
    });

    it('keeps a resume newer than the one just uploaded', () => {
        expect(staleResumes(
            [{ name: 'resume-1.pdf' }, { name: 'resume-2.pdf' }, { name: 'resume-3.pdf' }],
            'resume-2.pdf',
        )).toEqual(['resume-1.pdf']);
    });

    it('deletes no resume when keepName is not a resume name', () => {
        expect(staleResumes(
            [{ name: 'resume-1.pdf' }, { name: 'notes.txt' }],
            'weird.pdf',
        )).toEqual(['notes.txt']);
    });

    it('accepts PDFs up to 10 MB only', () => {
        expect(MAX_RESUME_BYTES).toBe(10 * 1024 * 1024);
        expect(validateResume({ type: 'application/pdf', size: 1000 })).toBeNull();
        expect(validateResume({ type: 'image/png', size: 10 })).toBe('Please choose a PDF file.');
        expect(validateResume({ type: 'application/pdf', size: MAX_RESUME_BYTES + 1 })).toBe('The PDF must be 10 MB or smaller.');
        expect(validateResume(null)).toBe('Please choose a PDF file.');
    });
});
