import { collection, getDocs } from 'firebase/firestore';

import { db } from './firebase';

// Written by components/admin/SkillsManager.jsx; read here for Terminal and Spotlight.
export const fetchSkills = async () => {
    const snapshot = await getDocs(collection(db, 'skills'));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
