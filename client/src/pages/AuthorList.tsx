import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthorProblem {
    filename: string;
    id: string;
    title: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    tags: string[];
    testCount: number;
    languages: string[];
}

/**
 * Dev-only index of every YAML problem currently under `server/problems/`.
 * Returns 404 if `ENABLE_AUTHOR_TOOLS` is not set on the server.
 */
export default function AuthorList() {
    const [problems, setProblems] = useState<AuthorProblem[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<AuthorProblem[]>('/author/problems')
            .then(({ data }) => setProblems(data))
            .catch((err) => {
                const status = err?.response?.status;
                setError(
                    status === 404
                        ? 'Author tools are disabled. Start the server with ENABLE_AUTHOR_TOOLS=true.'
                        : err?.message ?? 'Failed to load drafts',
                );
            });
    }, []);

    if (error) {
        return (
            <div className="mx-auto max-w-xl p-6 text-center text-sm text-muted-foreground">
                {error}
            </div>
        );
    }
    if (!problems) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h1 className="mb-1 text-xl font-semibold">Problem drafts</h1>
                    <p className="text-xs text-muted-foreground">
                        YAML files under <code>server/problems/</code>. Click one to dry-run it against ad-hoc test cases before committing.
                    </p>
                </div>
                <Link to="/author/new">
                    <Button size="sm">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> New problem
                    </Button>
                </Link>
            </div>
            <div className="divide-y divide-border rounded border border-border">
                {problems.map((p) => (
                    <Link
                        key={p.id}
                        to={`/author/problems/${p.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
                    >
                        <div>
                            <div className="text-sm font-medium">{p.title}</div>
                            <div className="text-[11px] text-muted-foreground">
                                {p.filename} · {p.id}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{p.difficulty}</span>
                            <span>{p.languages.join(',')}</span>
                            <span>{p.testCount} tests</span>
                        </div>
                    </Link>
                ))}
                {problems.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No YAML files yet. Create one under <code>server/problems/</code>.
                    </div>
                )}
            </div>
        </div>
    );
}
