import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { db } from './firebase';

// Written by components/admin/ProjectsManager.jsx; read here for Finder and Safari.
export const fetchProjects = async () => {
    const snapshot = await getDocs(query(collection(db, 'projects'), orderBy('order', 'asc')));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
