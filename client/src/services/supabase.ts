import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dev-only escape hatch: Playwright e2e auth fixture calls
// `window.__supabase.auth.signInWithPassword(...)` from inside the page so
// the SDK persists the session in whatever localStorage format this
// `@supabase/supabase-js` version expects. Stripped from production
// builds via Vite's `import.meta.env.DEV` dead-code elimination.
if (import.meta.env.DEV) {
    (window as unknown as { __supabase: typeof supabase }).__supabase = supabase;
}
