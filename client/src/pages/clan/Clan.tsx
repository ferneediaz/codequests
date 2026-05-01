import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Plus, LogIn, Shield, Crown, DoorOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { useAppSelector } from '@/store/hooks';
import {
    createClan,
    findClanByTag,
    joinClan,
    leaveClan,
    listClans,
} from '@/services/clans';
import type { Clan } from '@/types/clans';

export default function ClanPage() {
    const navigate = useNavigate();
    const user = useAppSelector((s) => s.auth.user);
    const [clans, setClans] = useState<Clan[]>([]);
    const [loading, setLoading] = useState(true);
    const [createName, setCreateName] = useState('');
    const [createTag, setCreateTag] = useState('');
    const [joinTag, setJoinTag] = useState('');
    const [busy, setBusy] = useState(false);

    // Manual reload triggered by user actions (create/join/leave). State
    // is only written after the async boundary, which the lint rule allows.
    const loadClans = useCallback(async () => {
        try {
            const data = await listClans();
            setClans(data);
        } catch {
            toast.error('Failed to load clans.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await listClans();
                if (cancelled) return;
                setClans(data);
            } catch {
                if (cancelled) return;
                toast.error('Failed to load clans.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const myClan = useMemo(
        () => clans.find((clan) => clan.members.some((m) => m.id === user?.id)) ?? null,
        [clans, user?.id],
    );
    const isOwner = myClan?.ownerId === user?.id;

    const onCreate = async () => {
        if (!createName.trim() || !createTag.trim()) return;
        setBusy(true);
        try {
            await createClan({
                name: createName.trim(),
                tag: createTag.trim().toUpperCase(),
            });
            toast.success('Clan created.');
            setCreateName('');
            setCreateTag('');
            await loadClans();
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to create clan.';
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const onJoinByTag = async () => {
        if (!joinTag.trim()) return;
        setBusy(true);
        try {
            const clan = await findClanByTag(joinTag.trim().toUpperCase());
            await joinClan(clan.id);
            toast.success(`Joined ${clan.name}.`);
            setJoinTag('');
            await loadClans();
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to join clan.';
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const onJoin = async (clanId: string) => {
        setBusy(true);
        try {
            await joinClan(clanId);
            toast.success('Joined clan.');
            await loadClans();
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to join clan.';
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const onLeave = async () => {
        setBusy(true);
        try {
            await leaveClan();
            toast.success('Left clan.');
            await loadClans();
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to leave clan.';
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-7xl px-4 py-8">
                <AnimateIn direction="up">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                                Clan
                            </h1>
                            <p className="mt-2 max-w-xl text-muted-foreground">
                                Manage your clan and prepare for Clan Wars.
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => navigate('/play')}>
                            Back to Play
                        </Button>
                    </div>
                </AnimateIn>

                {myClan ? (
                    <div className="grid gap-6 lg:grid-cols-12">
                        <Card className="lg:col-span-5">
                            <CardContent className="space-y-5 p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Your Clan
                                        </p>
                                        <h2 className="mt-1 text-2xl font-bold">{myClan.name}</h2>
                                    </div>
                                    <Badge variant="secondary">[{myClan.tag}]</Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <Stat label="MMR" value={String(myClan.mmr)} />
                                    <Stat label="Members" value={String(myClan.members.length)} />
                                    <Stat label="Owner" value={isOwner ? 'You' : 'Member'} />
                                </div>
                                <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                                    Clan wars are coordinated from the Play page under Clan Wars
                                    mode.
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={onLeave}
                                    disabled={busy}
                                >
                                    <DoorOpen className="mr-2 h-4 w-4" />
                                    Leave Clan
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-7">
                            <CardContent className="p-6">
                                <div className="mb-4 flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    <h3 className="text-base font-semibold">Members</h3>
                                </div>
                                <div className="space-y-2">
                                    {myClan.members.map((member) => (
                                        <div
                                            key={member.id}
                                            className="flex items-center justify-between rounded-lg border p-3"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Shield className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{member.username}</span>
                                                {member.id === myClan.ownerId && (
                                                    <Badge variant="outline">
                                                        <Crown className="mr-1 h-3 w-3" />
                                                        Leader
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                                                {member.mmr} MMR
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-12">
                        <Card className="lg:col-span-6">
                            <CardContent className="space-y-4 p-6">
                                <div className="flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-primary" />
                                    <h3 className="text-base font-semibold">Create Clan</h3>
                                </div>
                                <input
                                    placeholder="Clan name"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <input
                                    placeholder="TAG (2-5 uppercase letters)"
                                    value={createTag}
                                    onChange={(e) => setCreateTag(e.target.value.toUpperCase())}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <Button className="w-full" onClick={onCreate} disabled={busy}>
                                    Create Clan
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-6">
                            <CardContent className="space-y-4 p-6">
                                <div className="flex items-center gap-2">
                                    <LogIn className="h-4 w-4 text-primary" />
                                    <h3 className="text-base font-semibold">Join Clan</h3>
                                </div>
                                <input
                                    placeholder="Clan tag (e.g. CW)"
                                    value={joinTag}
                                    onChange={(e) => setJoinTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && void onJoinByTag()}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={onJoinByTag}
                                    disabled={busy}
                                >
                                    Join by Tag
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-12">
                            <CardContent className="p-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-base font-semibold">Top Clans</h3>
                                    <Badge variant="secondary">{clans.length} total</Badge>
                                </div>
                                {loading ? (
                                    <p className="text-sm text-muted-foreground">Loading clans...</p>
                                ) : (
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {clans.map((clan) => (
                                            <div
                                                key={clan.id}
                                                className="flex items-center justify-between rounded-lg border p-3"
                                            >
                                                <div>
                                                    <p className="font-medium">
                                                        {clan.name}{' '}
                                                        <span className="text-muted-foreground">
                                                            [{clan.tag}]
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {clan.members.length} members - {clan.mmr} MMR
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => void onJoin(clan.id)}
                                                    disabled={busy}
                                                >
                                                    Join
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold">{value}</p>
        </div>
    );
}
