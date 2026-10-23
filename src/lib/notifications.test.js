import { describe, it, expect, vi, afterEach } from 'vitest';
import { MAX_NOTIFICATIONS, addNotification, createNotification, scheduleWelcome } from './notifications';
import { welcomeNotifications } from '../constants';

afterEach(() => {
    vi.useRealTimers();
});

describe('createNotification', () => {
    it('keeps the fields a banner needs, with defaults', () => {
        expect(createNotification({ appId: 'safari', title: '  Safari ' }, { id: 7 })).toEqual({
            id: 7,
            appId: 'safari',
            title: 'Safari',
            body: '',
            action: null,
        });
        expect(createNotification(
            { appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' }, extra: 1 },
            { id: 1 },
        )).toEqual({ id: 1, appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' } });
    });
});

describe('addNotification', () => {
    it('appends and keeps only the newest few', () => {
        const make = (id) => ({ id, appId: 'safari', title: `n${id}`, body: '', action: null });
        let list = [];
        [1, 2, 3, 4, 5].forEach((id) => { list = addNotification(list, make(id)); });
        expect(MAX_NOTIFICATIONS).toBe(3);
        expect(list.map((n) => n.id)).toEqual([3, 4, 5]);
        expect(addNotification([make(1)], make(2), 1).map((n) => n.id)).toEqual([2]);
    });
});

describe('scheduleWelcome', () => {
    const entries = [
        { delay: 4000, appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' } },
        { delay: 45000, unlessOpened: 'safari', appId: 'safari', title: 'Safari', body: 'Look', action: { type: 'openApp', id: 'safari' } },
    ];

    it('sends each banner after its delay, without scheduling fields', () => {
        vi.useFakeTimers();
        const notify = vi.fn();
        const handles = scheduleWelcome(entries, { setTimer: setTimeout, wasOpened: () => false, notify });

        expect(handles).toHaveLength(2);
        vi.advanceTimersByTime(3999);
        expect(notify).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(notify).toHaveBeenLastCalledWith({ appId: 'contact', title: 'Messages', body: 'Hi', action: { type: 'openApp', id: 'contact' } });
        vi.advanceTimersByTime(41000);
        expect(notify).toHaveBeenCalledTimes(2);
        expect(notify).toHaveBeenLastCalledWith({ appId: 'safari', title: 'Safari', body: 'Look', action: { type: 'openApp', id: 'safari' } });
    });

    it('skips a nudge for an app the visitor already opened', () => {
        vi.useFakeTimers();
        const notify = vi.fn();
        const opened = new Set();
        scheduleWelcome(entries, { setTimer: setTimeout, wasOpened: (id) => opened.has(id), notify });

        vi.advanceTimersByTime(4000);
        opened.add('safari');
        vi.advanceTimersByTime(41000);
        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify.mock.calls[0][0].title).toBe('Messages');
    });
});

describe('welcomeNotifications', () => {
    it('greets after about 4s and nudges toward Safari after about 45s', () => {
        expect(welcomeNotifications).toEqual([
            {
                delay: 4000,
                appId: 'contact',
                title: 'Messages',
                body: "Hey, I'm Debaditya 👋 Have a look around",
                action: { type: 'openApp', id: 'contact' },
            },
            {
                delay: 45000,
                unlessOpened: 'safari',
                appId: 'safari',
                title: 'Safari',
                body: 'Want to see my projects running live?',
                action: { type: 'openApp', id: 'safari' },
            },
        ]);
    });
});
