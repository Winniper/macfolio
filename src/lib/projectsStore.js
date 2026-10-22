import { create } from 'zustand';

// Shared project list for every window that shows projects (Finder, Safari).
// The fetcher is injected so this stays testable without Firebase.
export const createProjectsStore = (fetchProjects) =>
    create((set, get) => ({
        status: 'idle',
        projects: [],
        error: null,

        load: async ({ force = false } = {}) => {
            const { status } = get();

            if (status === 'loading') return;
            if (status === 'success' && !force) return;

            set({ status: 'loading', error: null });

            try {
                const projects = await fetchProjects();
                set({ status: 'success', projects });
            } catch (err) {
                console.error('Error fetching projects:', err);
                set({ status: 'error', error: 'Unable to load projects' });
            }
        },
    }));
