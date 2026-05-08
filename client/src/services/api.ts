import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Don't sign out unauthenticated visitors — public routes
            // (e.g. /profile/:username) call endpoints that may 401 for
            // anonymous viewers. Just let the query reject so the page
            // can render its empty state.
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return Promise.reject(error);
            }
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
                await supabase.auth.signOut();
                const { pathname, search } = window.location;
                const next = pathname === '/login' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
                window.location.href = `/login${next}`;
            }
        }
        return Promise.reject(error);
    },
);

export default api;
