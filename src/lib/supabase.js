import { createClient } from '@supabase/supabase-js';

// The anon key is public by design: Row Level Security in
// supabase/migrations/ decides what it may do. Never import this from tests.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.');
}

export const supabase = createClient(url, anonKey);
