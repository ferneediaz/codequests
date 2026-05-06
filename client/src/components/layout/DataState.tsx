import type { ReactNode } from 'react';

interface DataStateProps {
    isLoading?: boolean;
    isEmpty?: boolean;
    error?: ReactNode;
    loading: ReactNode;
    empty: ReactNode;
    children: ReactNode;
}

export function DataState({
    isLoading,
    isEmpty,
    error,
    loading,
    empty,
    children,
}: DataStateProps) {
    if (isLoading) return <>{loading}</>;
    if (error) return <>{error}</>;
    if (isEmpty) return <>{empty}</>;
    return <>{children}</>;
}
