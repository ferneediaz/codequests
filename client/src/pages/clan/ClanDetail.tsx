import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Crown,
    DoorOpen,
    Settings,
    Shield,
    Swords,
    UserMinus,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { useAppSelector } from '@/store/hooks';
import { queryKeys } from '@/lib/queryKeys';
import {
    getClan,
    joinClan,
    kickMember,
    leaveClan,
    listJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    requestJoin,
    searchClans,
    sendClanChallenge,
    updateClan,
} from '@/services/clans';
import type { SkillType } from '@/types/battle';
import type { Clan, ClanJoinRequest } from '@/types/clans';
import { ClanChatPanel } from '@/components/clan/ClanChatPanel';
import { ClanBattleHistory } from '@/components/clan/ClanBattleHistory';
import { ChallengesPanel } from '@/components/clan/ChallengesPanel';

const SKILLS: SkillType[] = ['FREEZE', 'SCRAMBLE', 'BLIND', 'TIME_STEAL', 'FOG_OF_WAR'];

export default function ClanDetail() {
    const { id } = useParams<{ id: string }>();
    const user = useAppSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [challengeOpen, setChallengeOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

    const clanQuery = useQuery({
        queryKey: queryKeys.clans.detail(id ?? ''),
        queryFn: () => getClan(id ?? ''),
        enabled: Boolean(id),
    });

    const clan = clanQuery.data;
    const isMember = Boolean(clan?.members.some((member) => member.id === user?.id));
    const isOwner = clan?.ownerId === user?.id;
    const inDifferentClan = Boolean(user?.clanId && user.clanId !== clan?.id && !isMember);

    const members = useMemo(() => {
        if (!clan) return [];
        return clan.members.map((member) => ({
            ...member,
            role: member.id === clan.ownerId ? 'OWNER' : 'MEMBER',
        }));
    }, [clan]);

    const joinRequestsQuery = useQuery({
        queryKey: ['clans', 'join-requests', id],
        queryFn: () => listJoinRequests(id ?? ''),
        enabled: Boolean(id && isOwner),
    });

    const refreshClan = async () => {
        if (!id) return;
        await queryClient.invalidateQueries({ queryKey: queryKeys.clans.detail(id) });
    };

    const onJoin = async () => {
        if (!clan) return;
        setBusy(true);
        try {
            if (clan.inviteOnly) {
                await requestJoin(clan.id);
                toast.success(`Request sent to ${clan.name}.`);
            } else {
                await joinClan(clan.id);
                toast.success(`Joined ${clan.name}.`);
            }
            await refreshClan();
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Failed to join clan.'));
        } finally {
            setBusy(false);
        }
    };

    const onResolveJoinRequest = async (requestId: string, approve: boolean) => {
        setBusy(true);
        try {
            if (approve) {
                await approveJoinRequest(requestId);
                toast.success('Join request approved.');
            } else {
                await rejectJoinRequest(requestId);
                toast.message('Join request rejected.');
            }
            await Promise.all([
                refreshClan(),
                queryClient.invalidateQueries({ queryKey: ['clans', 'join-requests', id] }),
            ]);
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Failed to update join request.'));
        } finally {
            setBusy(false);
        }
    };

    const onLeave = async () => {
        setBusy(true);
        try {
            await leaveClan();
            toast.success('Left clan.');
            navigate('/clans');
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Failed to leave clan.'));
        } finally {
            setBusy(false);
        }
    };

    const onKick = async (memberId: string) => {
        if (!clan) return;
        setBusy(true);
        try {
            await kickMember(clan.id, memberId);
            toast.success('Member kicked.');
            await refreshClan();
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Failed to kick member.'));
        } finally {
            setBusy(false);
        }
    };

    if (clanQuery.isLoading) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
                Loading clan...
            </div>
        );
    }

    if (!clan) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Card>
                    <CardContent className="space-y-4 p-6 text-center">
                        <p className="font-semibold">Clan not found</p>
                        <Link to="/clans">
                            <Button variant="outline">Back to clans</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-7xl px-4 py-8">
                <AnimateIn direction="up">
                    <div className="mb-6 rounded-2xl border border-border bg-card/90 p-6 shadow-lg">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                                {clan.logoUrl ? (
                                    <img
                                        src={clan.logoUrl}
                                        alt={clan.name}
                                        className="h-16 w-16 rounded-2xl object-cover"
                                    />
                                ) : (
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                        <Shield className="h-8 w-8 text-primary" />
                                    </div>
                                )}
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h1 className="text-4xl font-extrabold tracking-tight">
                                            {clan.name}
                                        </h1>
                                        <Badge variant="secondary">[{clan.tag}]</Badge>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {members.length} members · created{' '}
                                        {formatDate(clan.createdAt)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {!isMember && (
                                    <Button
                                        onClick={onJoin}
                                        disabled={busy || inDifferentClan}
                                        title={
                                            inDifferentClan
                                                ? 'Leave your current clan before joining another.'
                                                : undefined
                                        }
                                    >
                                        <Users className="mr-2 h-4 w-4" />
                                        {clan.inviteOnly ? 'Request to Join' : 'Join Clan'}
                                    </Button>
                                )}
                                {isMember && (
                                    <Button variant="outline" onClick={onLeave} disabled={busy}>
                                        <DoorOpen className="mr-2 h-4 w-4" />
                                        Leave Clan
                                    </Button>
                                )}
                                {isOwner && (
                                    <Button onClick={() => setChallengeOpen(true)}>
                                        <Swords className="mr-2 h-4 w-4" />
                                        Challenge Another Clan
                                    </Button>
                                )}
                                {isOwner && (
                                    <Button variant="outline" onClick={() => setEditOpen(true)}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Edit Clan
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <Stat label="MMR" value={String(clan.mmr)} />
                            <Stat label="Tier" value={clan.tier?.name ?? 'Unranked'} />
                            <Stat label="Role" value={isOwner ? 'Owner' : isMember ? 'Member' : 'Visitor'} />
                        </div>
                    </div>
                </AnimateIn>

                <div className="grid gap-6 lg:grid-cols-12">
                    <Card className="lg:col-span-7">
                        <CardContent className="p-6">
                            <div className="mb-4 flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                <h2 className="text-lg font-semibold">Members</h2>
                            </div>
                            <div className="space-y-2">
                                {members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            {member.avatarUrl ? (
                                                <img
                                                    src={member.avatarUrl}
                                                    alt={member.username}
                                                    className="h-9 w-9 rounded-full"
                                                />
                                            ) : (
                                                <div className="h-9 w-9 rounded-full bg-muted" />
                                            )}
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium">
                                                        {member.username}
                                                    </span>
                                                    <Badge variant="outline">
                                                        {member.role === 'OWNER' ? (
                                                            <>
                                                                <Crown className="mr-1 h-3 w-3" />
                                                                Owner
                                                            </>
                                                        ) : (
                                                            'Member'
                                                        )}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {member.mmr} MMR
                                                    {member.wins != null &&
                                                        member.losses != null &&
                                                        ` · ${member.wins}W / ${member.losses}L`}
                                                </p>
                                            </div>
                                        </div>
                                        {isOwner && member.id !== user?.id && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void onKick(member.id)}
                                                disabled={busy}
                                            >
                                                <UserMinus className="mr-2 h-4 w-4" />
                                                Kick
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6 lg:col-span-5">
                        {isMember ? (
                            <ClanChatPanel clanId={clan.id} currentUserId={user?.id} />
                        ) : (
                            <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
                                Join this clan to access clan chat.
                            </div>
                        )}
                        <ClanBattleHistory clanId={clan.id} />
                        {isMember && (
                            <ChallengesPanel clanId={clan.id} isOwner={Boolean(isOwner)} />
                        )}
                        {isOwner && (
                            <JoinRequestsPanel
                                requests={joinRequestsQuery.data ?? []}
                                loading={joinRequestsQuery.isLoading}
                                busy={busy}
                                onResolve={onResolveJoinRequest}
                            />
                        )}
                    </div>
                </div>
            </div>

            {editOpen && (
                <EditClanModal
                    clan={clan}
                    onClose={() => setEditOpen(false)}
                    onSaved={async () => {
                        setEditOpen(false);
                        await refreshClan();
                    }}
                />
            )}

            {challengeOpen && (
                <ChallengeModal
                    onClose={() => setChallengeOpen(false)}
                    onSent={() => {
                        setChallengeOpen(false);
                        toast.success('Challenge sent.');
                    }}
                />
            )}
        </div>
    );
}

function ChallengeModal({
    onClose,
    onSent,
}: {
    onClose: () => void;
    onSent: () => void;
}) {
    const [targetTag, setTargetTag] = useState('');
    const [teamSize, setTeamSize] = useState(2);
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
    const [preferredTopic, setPreferredTopic] = useState('');
    const [message, setMessage] = useState('');
    const [enabledSkills, setEnabledSkills] = useState<SkillType[]>([]);
    const [busy, setBusy] = useState(false);

    const toggleSkill = (skill: SkillType) => {
        setEnabledSkills((current) =>
            current.includes(skill)
                ? current.filter((value) => value !== skill)
                : [...current, skill],
        );
    };

    const submit = async () => {
        if (!targetTag.trim()) {
            toast.error('Enter a target clan tag.');
            return;
        }
        setBusy(true);
        try {
            const normalizedTag = targetTag.trim().toUpperCase();
            const clans = await searchClans(normalizedTag, 10);
            const target = clans.find((clan) => clan.tag.toUpperCase() === normalizedTag);
            if (!target) {
                toast.error('No clan found with that tag.');
                return;
            }
            await sendClanChallenge({
                targetClanId: target.id,
                teamSize,
                timeLimitMinutes,
                enabledSkills,
                preferredTopic: preferredTopic.trim() || undefined,
                message: message.trim() || undefined,
            });
            onSent();
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Failed to send challenge.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Challenge Another Clan</h2>
                    <p className="text-sm text-muted-foreground">
                        Look up the target clan by tag, then propose battle settings.
                    </p>
                </div>
                <div className="space-y-3">
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                            Target clan tag
                        </span>
                        <input
                            value={targetTag}
                            onChange={(e) => setTargetTag(e.target.value.toUpperCase())}
                            placeholder="CW"
                            maxLength={5}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                                Team size
                            </span>
                            <select
                                value={teamSize}
                                onChange={(e) => setTeamSize(Number(e.target.value))}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value={2}>2v2</option>
                                <option value={3}>3v3</option>
                                <option value={5}>5v5</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                                Time limit
                            </span>
                            <input
                                type="number"
                                min={1}
                                max={120}
                                value={timeLimitMinutes}
                                onChange={(e) =>
                                    setTimeLimitMinutes(Number(e.target.value) || 30)
                                }
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                            Preferred topic
                        </span>
                        <input
                            value={preferredTopic}
                            onChange={(e) => setPreferredTopic(e.target.value)}
                            placeholder="arrays, dynamic programming, graphs..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                    </label>
                    <div>
                        <span className="mb-2 block text-xs font-medium uppercase text-muted-foreground">
                            Enabled skills
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {SKILLS.map((skill) => (
                                <button
                                    key={skill}
                                    type="button"
                                    onClick={() => toggleSkill(skill)}
                                    className={`rounded-full border px-3 py-1 text-xs ${
                                        enabledSkills.includes(skill)
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border text-muted-foreground'
                                    }`}
                                >
                                    {skill.replaceAll('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="block">
                        <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                            Message
                        </span>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={500}
                            rows={3}
                            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                    </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={busy}>
                        Send Challenge
                    </Button>
                </div>
            </div>
        </div>
    );
}

function EditClanModal({
    clan,
    onClose,
    onSaved,
}: {
    clan: Clan;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}) {
    const [bannerUrl, setBannerUrl] = useState(clan.bannerUrl ?? '');
    const [logoUrl, setLogoUrl] = useState(clan.logoUrl ?? '');
    const [inviteOnly, setInviteOnly] = useState(Boolean(clan.inviteOnly));
    const [busy, setBusy] = useState(false);

    const save = async () => {
        setBusy(true);
        try {
            await updateClan(clan.id, {
                bannerUrl: bannerUrl.trim(),
                logoUrl: logoUrl.trim(),
                inviteOnly,
            });
            toast.success('Clan updated.');
            await onSaved();
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Failed to update clan.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl">
                <h2 className="text-lg font-semibold">Edit Clan</h2>
                <div className="mt-4 space-y-3">
                    <input
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                        placeholder="Banner image URL"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="Logo image URL"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                        <input
                            type="checkbox"
                            checked={inviteOnly}
                            onChange={(e) => setInviteOnly(e.target.checked)}
                        />
                        Invite-only clan
                    </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={() => void save()} disabled={busy}>
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}

function JoinRequestsPanel({
    requests,
    loading,
    busy,
    onResolve,
}: {
    requests: ClanJoinRequest[];
    loading: boolean;
    busy: boolean;
    onResolve: (requestId: string, approve: boolean) => void;
}) {
    return (
        <div className="rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
                <h2 className="text-lg font-semibold">Join Requests</h2>
            </div>
            <div className="space-y-3 p-4">
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading requests...</p>
                ) : requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending requests.</p>
                ) : (
                    requests.map((request) => (
                        <div
                            key={request.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                        >
                            <div>
                                <p className="text-sm font-medium">{request.user.username}</p>
                                <p className="text-xs text-muted-foreground">
                                    {request.user.mmr} MMR
                                    {request.message ? ` · ${request.message}` : ''}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => onResolve(request.id, true)}
                                >
                                    Approve
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => onResolve(request.id, false)}
                                >
                                    Reject
                                </Button>
                            </div>
                        </div>
                    ))
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

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'recently';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function getApiError(error: unknown, fallback: string) {
    return (
        (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? fallback
    );
}
