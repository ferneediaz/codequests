import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';

/**
 * Forces authenticated users through `/onboarding` until the backend
 * clears `needsOnboarding`. Must be nested inside `ProtectedRoute` so
 * unauthenticated visitors never reach this gate.
 */
export function OnboardingGate() {
    const { user } = useAppSelector((state) => state.auth);
    const location = useLocation();

    const onOnboardingPage = location.pathname === '/onboarding';

    if (user?.needsOnboarding && !onOnboardingPage) {
        return <Navigate to="/onboarding" replace />;
    }
    if (user && !user.needsOnboarding && onOnboardingPage) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
