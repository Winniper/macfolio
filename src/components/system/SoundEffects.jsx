import { useEffect } from 'react';

import { isPhoneScreen } from '../../lib/boot';
import { soundCues, soundSnapshot } from '../../lib/soundCues';
import { systemSounds } from '../../lib/sounds';
import useSystemStore from '../../store/system';
import useWindowStore from '../../store/window';

// Plays the system sounds. Every pointer/key press primes audio (the first one
// is the boot/lock-screen gesture, so the startup chime is allowed); store
// changes become cues.
const SoundEffects = () => {
    useEffect(() => {
        const prime = () => systemSounds.prime();
        const snapshot = () => soundSnapshot(useWindowStore.getState(), useSystemStore.getState());
        let previous = snapshot();

        const check = () => {
            const next = snapshot();
            const cues = soundCues(previous, next, { phone: isPhoneScreen() });

            previous = next;
            if (!useSystemStore.getState().soundEffects) return;
            cues.forEach((cue) => systemSounds.play(cue));
        };

        window.addEventListener('pointerdown', prime, true);
        window.addEventListener('pointerup', prime, true);
        window.addEventListener('click', prime, true);
        window.addEventListener('keydown', prime, true);
        const unsubscribeWindows = useWindowStore.subscribe(check);
        const unsubscribeSystem = useSystemStore.subscribe(check);

        return () => {
            window.removeEventListener('pointerdown', prime, true);
            window.removeEventListener('pointerup', prime, true);
            window.removeEventListener('click', prime, true);
            window.removeEventListener('keydown', prime, true);
            unsubscribeWindows();
            unsubscribeSystem();
        };
    }, []);

    return null;
};

export default SoundEffects;
