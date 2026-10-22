import { describe, it, expect, vi, afterEach } from 'vitest';
import { createProjectsStore } from './projectsStore';

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createProjectsStore', () => {
    it('starts idle and empty', () => {
        const store = createProjectsStore(vi.fn());
        expect(store.getState()).toMatchObject({ status: 'idle', projects: [], error: null });
    });

    it('loads projects', async () => {
        const projects = [{ id: 'a', title: 'A' }];
        const store = createProjectsStore(vi.fn().mockResolvedValue(projects));
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', projects, error: null });
    });

    it('fetches once when several windows ask at the same time', async () => {
        const pending = deferred();
        const fetchProjects = vi.fn(() => pending.promise);
        const store = createProjectsStore(fetchProjects);
        const first = store.getState().load();
        store.getState().load();
        expect(store.getState().status).toBe('loading');
        pending.resolve([]);
        await first;
        expect(fetchProjects).toHaveBeenCalledTimes(1);
    });

    it('does not refetch once loaded unless forced', async () => {
        const fetchProjects = vi.fn().mockResolvedValue([]);
        const store = createProjectsStore(fetchProjects);
        await store.getState().load();
        await store.getState().load();
        expect(fetchProjects).toHaveBeenCalledTimes(1);
        await store.getState().load({ force: true });
        expect(fetchProjects).toHaveBeenCalledTimes(2);
    });

    it('reports a friendly error and can retry', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchProjects = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce([{ id: 'a' }]);
        const store = createProjectsStore(fetchProjects);
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'error', error: 'Unable to load projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', projects: [{ id: 'a' }], error: null });
    });
});
