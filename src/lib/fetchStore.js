import { create } from 'zustand';

// A Firestore list shared by every window that shows it (projects: Finder,
// Safari, About, Spotlight; skills: Terminal, Spotlight). The first caller
// fetches; later callers reuse it. The fetcher is injected so this stays
// testable without Firebase.
export const createFetchStore = (fetchItems, { what }) =>
    create((set, get) => ({
        status: 'idle',
        items: [],
        error: null,

        load: async ({ force = false } = {}) => {
            const { status } = get();

            if (status === 'loading') return;
            if (status === 'success' && !force) return;

            set({ status: 'loading', error: null });

            try {
                const items = await fetchItems();
                set({ status: 'success', items });
            } catch (err) {
                console.error(`Error fetching ${what}:`, err);
                set({ status: 'error', error: `Unable to load ${what}` });
            }
        },
    }));
