import { Eye } from 'lucide-react';

export function SpectatorBanner() {
    return (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
                <Eye className="h-4 w-4" />
                <span>
                    Spectator mode &mdash; you&rsquo;re out, but you can keep watching
                    the standings until a champion is crowned.
                </span>
            </div>
        </div>
    );
}
