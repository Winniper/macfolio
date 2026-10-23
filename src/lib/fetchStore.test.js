import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFetchStore } from './fetchStore';

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createFetchStore', () => {
    it('starts idle and empty', () => {
        const store = createFetchStore(vi.fn(), { what: 'projects' });
        expect(store.getState()).toMatchObject({ status: 'idle', items: [], error: null });
    });

    it('loads items', async () => {
        const items = [{ id: 'a', title: 'A' }];
        const store = createFetchStore(vi.fn().mockResolvedValue(items), { what: 'projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', items, error: null });
    });

    it('fetches once when several windows ask at the same time', async () => {
        const pending = deferred();
        const fetchItems = vi.fn(() => pending.promise);
        const store = createFetchStore(fetchItems, { what: 'projects' });
        const first = store.getState().load();
        store.getState().load();
        expect(store.getState().status).toBe('loading');
        pending.resolve([]);
        await first;
        expect(fetchItems).toHaveBeenCalledTimes(1);
    });

    it('does not refetch once loaded unless forced', async () => {
        const fetchItems = vi.fn().mockResolvedValue([]);
        const store = createFetchStore(fetchItems, { what: 'projects' });
        await store.getState().load();
        await store.getState().load();
        expect(fetchItems).toHaveBeenCalledTimes(1);
        await store.getState().load({ force: true });
        expect(fetchItems).toHaveBeenCalledTimes(2);
    });

    it('reports a friendly error and can retry', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const fetchItems = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce([{ id: 'a' }]);
        const store = createFetchStore(fetchItems, { what: 'projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'error', error: 'Unable to load projects' });
        await store.getState().load();
        expect(store.getState()).toMatchObject({ status: 'success', items: [{ id: 'a' }], error: null });
    });

    it('names what failed to load', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const store = createFetchStore(vi.fn().mockRejectedValue(new Error('denied')), { what: 'skills' });
        await store.getState().load();
        expect(store.getState().error).toBe('Unable to load skills');
        expect(consoleError).toHaveBeenCalledWith('Error fetching skills:', expect.any(Error));
    });
});
