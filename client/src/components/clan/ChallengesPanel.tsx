import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    acceptClanChallenge,
    counterClanChallenge,
    declineClanChallenge,
    getClanChallenges,
} from '@/services/clans';
import { queryKeys } from '@/lib/queryKeys';
import type { ClanChallenge } from '@/types/clans';

export function ChallengesPanel({
    clanId,
    isOwner,
}: {
    clanId: string;
    isOwner: boolean;
}) {
    const [pendingOnly, setPendingOnly] = useState(true);
    const [counteringId, setCounteringId] = useState<string | null>(null);
    const [counterMessage, setCounterMessage] = useState('');
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: queryKeys.clans.challenges(clanId, pendingOnly),
        queryFn: () => getClanChallenges(clanId, { pending: pendingOnly }),
    });
    const challenges = query.data ?? [];

    const refresh = async () => {
        await queryClient.invalidateQueries({
            queryKey: queryKeys.clans.challenges(clanId, pendingOnly),
        });
    };

    const accept = async (challenge: ClanChallenge) => {
        try {
            const accepted = await acceptClanChallenge(challenge.id);
            toast.success('Clan challenge accepted.');
            await refresh();
            if (accepted.battleId) {
                window.location.assign(`/battle/${accepted.battleId}`);
            }
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Could not accept challenge.'));
        }
    };

    const decline = async (challenge: ClanChallenge) => {
        try {
            await declineClanChallenge(challenge.id);
            toast.message('Clan challenge declined.');
            await refresh();
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Could not decline challenge.'));
        }
    };

    const counter = async (challenge: ClanChallenge) => {
        try {
            await counterClanChallenge(challenge.id, {
                counterMessage: counterMessage.trim() || undefined,
                teamSize: challenge.teamSize,
                timeLimitMinutes: challenge.timeLimitMinutes,
                enabledSkills: challenge.enabledSkills,
                preferredTopic: challenge.preferredTopic,
            });
            toast.success('Counter-proposal sent.');
            setCounteringId(null);
            setCounterMessage('');
            await refresh();
        } catch (error: unknown) {
            toast.error(getApiError(error, 'Could not counter challenge.'));
        }
    };

    return (
        <div className="rounded-xl border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-primary" />
                    <h2 className="text-lg font-semibold">Clan Challenges</h2>
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={pendingOnly ? 'secondary' : 'ghost'}
                        onClick={() => setPendingOnly(true)}
                    >
                        Pending
                    </Button>
                    <Button
                        size="sm"
                        variant={!pendingOnly ? 'secondary' : 'ghost'}
                        onClick={() => setPendingOnly(false)}
                    >
                        History
                    </Button>
                </div>
            </div>
            <div className="space-y-3 p-4">
                {query.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading challenges...</p>
                ) : challenges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No challenges to show.</p>
                ) : (
                    challenges.map((challenge) => (
                        <div key={challenge.id} className="rounded-lg border border-border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold">
                                        [{challenge.challengerClan.tag}] vs [
                                        {challenge.challengedClan.tag}]
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {challenge.teamSize}v{challenge.teamSize} ·{' '}
                                        {challenge.timeLimitMinutes} min
                                        {challenge.preferredTopic
                                            ? ` · ${challenge.preferredTopic}`
                                            : ''}
                                    </p>
                                </div>
                                <Badge variant="outline">{challenge.status}</Badge>
                            </div>
                            {challenge.message && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {challenge.message}
                                </p>
                            )}
                            {isOwner &&
                                (challenge.status === 'PENDING' ||
                                    challenge.status === 'COUNTERED') && (
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" onClick={() => void accept(challenge)}>
                                            Accept
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void decline(challenge)}
                                        >
                                            Decline
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setCounteringId(challenge.id)}
                                        >
                                            Counter
                                        </Button>
                                    </div>
                                )}
                            {counteringId === challenge.id && (
                                <div className="mt-3 space-y-2">
                                    <textarea
                                        value={counterMessage}
                                        onChange={(e) => setCounterMessage(e.target.value)}
                                        placeholder="Add a counter-proposal note..."
                                        maxLength={500}
                                        rows={2}
                                        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setCounteringId(null)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button size="sm" onClick={() => void counter(challenge)}>
                                            Send Counter
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function getApiError(error: unknown, fallback: string) {
    return (
        (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? fallback
    );
}
