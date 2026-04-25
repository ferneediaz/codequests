import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks';
import { setUser, setToken } from '@/store/slices/authSlice';
import { supabase } from '@/services/supabase';
import { connectSocket } from '@/services/socket';
import api from '@/services/api';
import type { User } from '@/types/api';
import { consumePendingInvite } from '@/lib/pendingInvite';

export default function AuthCallback() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function handleCallback() {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    throw new Error(sessionError?.message || 'No session found');
                }

                dispatch(setToken(session.access_token));

                // Sync ensures the user row exists; `/auth/me` is the canonical
                // source for `needsOnboarding` and the full profile shape.
                // Forward the OAuth provider picture so first-time users land
                // in the app with a real avatar already set.
                const providerAvatar =
                    (session.user.user_metadata?.avatar_url as string | undefined) ??
                    (session.user.user_metadata?.picture as string | undefined);
                await api.post('/auth/sync', {
                    ...(providerAvatar ? { avatarUrl: providerAvatar } : {}),
                });
                const { data: user } = await api.get<User>('/auth/me');

                if (mounted) {
                    dispatch(setUser(user));
                    connectSocket(session.access_token);
                    const pendingInvite = consumePendingInvite();
                    const destination = pendingInvite
                        ? `/invite/${pendingInvite}`
                        : user.needsOnboarding
                            ? '/onboarding'
                            : '/dashboard';
                    navigate(destination, { replace: true });
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Authentication failed');
                    setTimeout(() => navigate('/login', { replace: true }), 3000);
                }
            }
        }

        handleCallback();

        return () => {
            mounted = false;
        };
    }, [dispatch, navigate]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <p className="text-destructive mb-2">Authentication failed</p>
                    <p className="text-muted-foreground text-sm">{error}</p>
                    <p className="text-muted-foreground mt-2 text-xs">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center">
            <div className="text-muted-foreground">Completing sign in...</div>
        </div>
    );
}
