import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Shield, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { queryKeys } from '@/lib/queryKeys';
import { listClans } from '@/services/clans';

const PAGE_SIZE = 20;

export default function ClansDirectory() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [page, setPage] = useState(0);
    const offset = page * PAGE_SIZE;

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedQuery(query.trim());
            setPage(0);
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [query]);

    const clansQuery = useQuery({
        queryKey: queryKeys.clans.list(PAGE_SIZE, offset, debouncedQuery),
        queryFn: () => listClans({ limit: PAGE_SIZE, offset, q: debouncedQuery }),
    });

    const clans = useMemo(() => clansQuery.data ?? [], [clansQuery.data]);

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-7xl px-4 py-8">
                <AnimateIn direction="up">
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                                Clans
                            </h1>
                            <p className="mt-2 max-w-xl text-muted-foreground">
                                Browse top clans, search by name or tag, and join the crew
                                you want to fight with.
                            </p>
                        </div>
                        <Link to="/clans/create">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Clan
                            </Button>
                        </Link>
                    </div>
                </AnimateIn>

                <Card>
                    <CardContent className="space-y-5 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search clans by name or tag..."
                                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                                />
                            </div>
                            <Badge variant="secondary">Sorted by MMR</Badge>
                        </div>

                        {clansQuery.isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading clans...</p>
                        ) : clans.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-8 text-center">
                                <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                <p className="mb-4 text-sm text-muted-foreground">
                                    {query
                                        ? `No clans match "${query}".`
                                        : "No clans yet. Be the first to start one."}
                                </p>
                                <Button onClick={() => navigate('/clans/create')}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create a clan
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {clans.map((clan) => (
                                    <button
                                        key={clan.id}
                                        type="button"
                                        onClick={() => navigate(`/clans/${clan.id}`)}
                                        className="rounded-xl border border-border p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="truncate text-lg font-semibold">
                                                        {clan.name}
                                                    </h2>
                                                    <Badge variant="outline">[{clan.tag}]</Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {clan.members.length} members
                                                </p>
                                            </div>
                                            <Shield className="h-5 w-5 shrink-0 text-primary" />
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                            <Stat label="MMR" value={String(clan.mmr)} />
                                            <Stat
                                                label="Tier"
                                                value={clan.tier?.name ?? 'Unranked'}
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-between border-t border-border pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setPage((value) => Math.max(0, value - 1))}
                                disabled={page === 0}
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Prev
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {page + 1}
                            </span>
                            <Button
                                variant="outline"
                                onClick={() => setPage((value) => value + 1)}
                                disabled={clans.length < PAGE_SIZE}
                            >
                                Next
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
        </div>
    );
}
