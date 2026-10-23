import { createContext, useContext, useEffect, useState } from 'react';
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
const isAdmin = async () => {
    const { data, error } = await supabase.rpc('is_admin');
    return !error && data === true;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const apply = async (session) => {
            const admin = session?.user && (await isAdmin());
            if (!active) return;
            setUser(admin ? session.user : null);
            setLoading(false);
        };

        supabase.auth.getSession().then(({ data }) => apply(data.session));

        // Deferred: supabase-js warns against awaiting its API inside this callback.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setTimeout(() => apply(session), 0);
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
        if (!(await isAdmin())) {
            await supabase.auth.signOut();
            throw new Error('This account is not an admin.');
        }
        return data;
    };

    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = { user, loading, login, logout, isAuthenticated: !!user };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
