import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppSelector } from '@/store/hooks';

/**
 * Gate for `/admin/*` routes. Mirrors `ProtectedRoute` but additionally
 * checks `user.role === 'admin'`. Non-admin users get a soft redirect to
 * the dashboard with an explanatory toast — no harsh error page since
 * routes can leak via stale notification clicks.
 */
export function AdminRoute() {
    const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (!isLoading && isAuthenticated && !isAdmin) {
            toast.error("This page is for admins only.");
        }
    }, [isAdmin, isAuthenticated, isLoading]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-muted-foreground">Loading…</div>
            </div>
        );
    }
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }
    return <Outlet />;
}
