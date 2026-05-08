import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    error: Error | null;
}

// Class component is required by React's error-boundary contract
// (`getDerivedStateFromError` / `componentDidCatch` only work on classes).
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        if (import.meta.env.DEV) {
            console.error('[ErrorBoundary]', error, info.componentStack);
        }
    }

    private handleReload = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.error) return this.props.children;
        if (this.props.fallback) return this.props.fallback;

        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
                <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-card/60 to-orange-500/10 p-10 text-center backdrop-blur-sm">
                    <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-destructive/20 blur-3xl" />
                    <div className="relative flex flex-col items-center gap-6">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background/60 text-destructive shadow-lg">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-extrabold tracking-tight">
                                Something broke mid-battle
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                The page hit an unexpected error. Reload to try
                                again — your session is safe.
                            </p>
                            {import.meta.env.DEV && (
                                <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-border bg-background/40 p-3 text-left text-xs text-destructive">
                                    {this.state.error.message}
                                </pre>
                            )}
                        </div>
                        <Button onClick={this.handleReload}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reload page
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
