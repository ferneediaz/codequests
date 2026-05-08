import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/store/hooks';

export default function NotFound() {
    const isAuthenticated = useAppSelector(
        (state) => state.auth.isAuthenticated,
    );
    const homeHref = isAuthenticated ? '/dashboard' : '/';

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-16">
            <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-blue-500/10 p-10 text-center backdrop-blur-sm">
                <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/30 blur-3xl opacity-40" />
                <div className="relative flex flex-col items-center gap-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background/60 text-primary shadow-lg">
                        <Compass className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm uppercase tracking-widest text-muted-foreground">
                            Error 404
                        </p>
                        <h1 className="text-3xl font-extrabold tracking-tight">
                            This page wandered off the leaderboard
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            The link you followed is broken, expired, or never
                            existed. Head back and pick another fight.
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild>
                            <Link to={homeHref}>
                                {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link to="/practice">Go to practice</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
