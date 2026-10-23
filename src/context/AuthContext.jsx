import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Only accounts listed in public.admins count as signed in to the admin
// panel. There is no sign-up in the app, and sign-ups are off in Supabase;
// this check is the last line, and RLS still guards every write.
// Resolves true, false, or null when the check itself failed (network, RPC).
const isAdmin = async () => {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) return null;
    return data === true;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const userRef = useRef(null);
    const requestRef = useRef(0);

    const commit = (next) => {
        userRef.current = next;
        setUser(next);
        setLoading(false);
    };

    useEffect(() => {
        let active = true;

        // Only the latest call may set state, so a slow check can never
        // resurrect a user after a later sign-out.
        const apply = async (session, event) => {
            const sessionUser = session?.user ?? null;
            if (
                sessionUser &&
                (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
                userRef.current?.id === sessionUser.id
            ) {
                return;
            }

            const request = ++requestRef.current;
            if (!sessionUser) {
                commit(null);
                return;
            }

            const admin = await isAdmin();
            if (!active || request !== requestRef.current) return;

            if (admin === true) commit(sessionUser);
            else if (admin === false) commit(null);
            // A failed check keeps whoever is signed in; on first load that is nobody.
            else commit(userRef.current);
        };

        supabase.auth.getSession().then(({ data }) => apply(data.session, 'INITIAL_SESSION'));

        // Deferred: supabase-js warns against awaiting its API inside this callback.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setTimeout(() => apply(session, event), 0);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    // Supabase returns errors instead of throwing; Login.jsx expects a throw.
    // A valid login that isn't an admin is signed straight back out.
    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if ((await isAdmin()) !== true) {
            await supabase.auth.signOut();
            throw new Error('This account is not an admin.');
        }
        // The SIGNED_IN listener only runs later (setTimeout), so set the user
        // now; otherwise the caller navigates to /admin while user is still null.
        requestRef.current++;
        commit(data.user);
        return data;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = { user, loading, login, logout, isAuthenticated: !!user };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
