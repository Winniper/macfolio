import { useEffect, useState } from 'react';

import { msUntilNextMinute } from '../lib/time';

// Current time, refreshed on every minute boundary. The delay is recomputed
// from the real clock each tick, so it self-corrects after the tab sleeps.
const useClock = () => {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let timeoutId;

        const schedule = () => {
            timeoutId = setTimeout(() => {
                setNow(new Date());
                schedule();
            }, msUntilNextMinute(new Date()));
        };

        schedule();

        return () => clearTimeout(timeoutId);
    }, []);

    return now;
};

export default useClock;
