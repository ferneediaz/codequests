import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setUser, setToken, setLoading, logout as logoutAction } from '@/store/slices/authSlice';
import { supabase } from '@/services/supabase';
import { connectSocket, disconnectSocket } from '@/services/socket';
import api from '@/services/api';

export function useAuth() {
    const dispatch = useAppDispatch();
    const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

    useEffect(() => {
        let mounted = true;

        async function initAuth() {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.access_token && mounted) {
                dispatch(setToken(session.access_token));
                try {
                    const { data } = await api.get('/auth/me');
                    dispatch(setUser(data));
                    connectSocket(session.access_token);
                } catch {
                    dispatch(setLoading(false));
                }
            } else if (mounted) {
                dispatch(setLoading(false));
            }
        }

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session?.access_token && mounted) {
                    dispatch(setToken(session.access_token));
                } else if (mounted) {
                    dispatch(logoutAction());
                    disconnectSocket();
                }
            },
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [dispatch]);

    const loginWithGithub = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    };

    const loginWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    };

    const logout = async () => {
        await supabase.auth.signOut();
        disconnectSocket();
        dispatch(logoutAction());
    };

    return {
        user,
        isAuthenticated,
        isLoading,
        loginWithGithub,
        loginWithGoogle,
        logout,
    };
}
