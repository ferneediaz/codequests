import { Skeleton } from '@/components/ui/skeleton';

export function RouteFallback() {
    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8">
            <Skeleton className="mb-4 h-8 w-1/3" />
            <Skeleton className="mb-2 h-4 w-2/3" />
            <Skeleton className="mb-2 h-4 w-1/2" />
            <Skeleton className="mb-6 h-4 w-3/4" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
