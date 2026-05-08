import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RankBadge } from '@/components/ui/RankBadge';
import { Separator } from '@/components/ui/separator';
import {
    Copy,
    Check,
    UserPlus,
    Loader2,
    Shield,
    ShieldCheck,
} from 'lucide-react';
import type { BattleResponse } from '@/types/api';
import api from '@/services/api';
import { UserSearchInput } from '@/components/social/UserSearchInput';

interface BattleLobbyProps {
    battle: BattleResponse;
    currentUserId: string;
    onReady: () => void;
    onUnready: () => void;
}

export function BattleLobby({ battle, currentUserId, onReady, onUnready }: BattleLobbyProps) {
    const [copied, setCopied] = useState(false);
    const [inviteUsername, setInviteUsername] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState<string | null>(null);

    const currentParticipant = battle.participants.find((p) => p.userId === currentUserId);
    const isReady = currentParticipant?.isReady ?? false;
    // Battle Royale lobbies must be FULL before the server lets anyone ready
    // up (see BattlesService). For non-BR modes, the server only requires 2.
    const isRoyale = battle.mode === 'BATTLE_ROYALE';
    const requiredPlayers = isRoyale ? battle.maxPlayers : 2;
    const lobbyIsFull =
        requiredPlayers != null && battle.participants.length >= requiredPlayers;
    const allReady = lobbyIsFull && battle.participants.every((p) => p.isReady);
    const playersNeeded =
        requiredPlayers != null
            ? Math.max(0, requiredPlayers - battle.participants.length)
            : null;

    const handleCopyCode = async () => {
        if (!battle.inviteCode) return;
        await navigator.clipboard.writeText(battle.inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleInviteUser = async () => {
        if (!inviteUsername.trim()) return;
        setIsInviting(true);
        setInviteMessage(null);
        try {
            await api.post(`/battles/${battle.id}/invite-user`, {
                username: inviteUsername.trim(),
            });
            setInviteMessage(`Invite sent to ${inviteUsername.trim()}`);
            setInviteUsername('');
        } catch {
            setInviteMessage('Failed to send invite');
        } finally {
            setIsInviting(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
            <Card className="w-full max-w-lg">
                <CardContent className="space-y-6 pt-6 pb-6">
                    {/* Header */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-foreground">Battle Lobby</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {battle.mode === 'BATTLE_ROYALE'
                                ? 'Fill the lobby, then ready up for round one'
                                : 'Waiting for all players to ready up'}
                        </p>
                    </div>

                    {/* Game Settings Summary */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <Badge variant="secondary">
                            {battle.mode === 'ONE_V_ONE'
                                ? '1v1'
                                : battle.mode === 'BATTLE_ROYALE'
                                    ? 'Battle Royale'
                                    : battle.mode === 'GROUP'
                                        ? 'Group'
                                        : 'Clan vs Clan'}
                        </Badge>
                        <Badge variant="outline">{battle.timeLimitMinutes} min</Badge>
                        {battle.enabledSkills && battle.enabledSkills.length > 0 && (
                            <Badge variant="outline">
                                {battle.enabledSkills.length} skill{battle.enabledSkills.length > 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>

                    <Separator />

                    {/* Players */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Players ({battle.participants.length}
                            {isRoyale && requiredPlayers != null
                                ? `/${requiredPlayers}`
                                : ''}
                            )
                        </h3>
                        {battle.participants.map((p) => {
                            const username = p.username || p.user?.username || 'Unknown';
                            return (
                            <div
                                key={p.userId}
                                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    {p.user?.avatarUrl ? (
                                        <img
                                            src={p.user.avatarUrl}
                                            alt=""
                                            className="h-8 w-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                                            {username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span className="min-w-0 font-medium text-foreground">
                                        <span>
                                            {username}
                                            {p.userId === currentUserId && (
                                                <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                                            )}
                                        </span>
                                        {p.user?.mmr != null && (
                                            <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                {p.user.mmr} MMR
                                                <RankBadge mmr={p.user.mmr} className="text-[10px]" />
                                            </span>
                                        )}
                                    </span>
                                </div>
                                {p.isReady ? (
                                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                        <ShieldCheck className="mr-1 h-3 w-3" />
                                        Ready
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        <Shield className="mr-1 h-3 w-3" />
                                        Not Ready
                                    </Badge>
                                )}
                            </div>
                            );
                        })}
                    </div>

                    {/* Ready / Unready */}
                    <Button
                        className="w-full h-12 text-base"
                        variant={isReady ? 'outline' : 'default'}
                        onClick={isReady ? onUnready : onReady}
                        disabled={!lobbyIsFull && !isReady}
                    >
                        {isReady ? 'Cancel Ready' : 'Ready Up'}
                    </Button>

                    {!lobbyIsFull && (
                        <p className="text-center text-xs text-muted-foreground">
                            {isRoyale && playersNeeded != null
                                ? `Need ${playersNeeded} more player${playersNeeded === 1 ? '' : 's'} to fill this Battle Royale lobby`
                                : isRoyale
                                  ? 'Waiting for the lobby size to load…'
                                  : 'Need at least 2 players to start'}
                        </p>
                    )}

                    {allReady && (
                        <div className="flex items-center justify-center gap-2 text-sm text-green-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Starting battle...
                        </div>
                    )}

                    <Separator />

                    {/* Invite Code */}
                    {battle.inviteCode && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-muted-foreground">
                                Invite Code
                            </h3>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-md bg-muted px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest">
                                    {battle.inviteCode}
                                </code>
                                <Button variant="outline" size="icon" onClick={handleCopyCode}>
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Invite by Username */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Invite Player
                        </h3>
                        <UserSearchInput
                            value={inviteUsername}
                            onChange={setInviteUsername}
                            onSelect={(user) => setInviteUsername(user.username)}
                            placeholder="Search by username..."
                        />
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                onClick={handleInviteUser}
                                disabled={!inviteUsername.trim() || isInviting}
                            >
                                {isInviting ? (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                    <UserPlus className="mr-1 h-4 w-4" />
                                )}
                                Invite
                            </Button>
                        </div>
                        {inviteMessage && (
                            <p className={`text-xs ${inviteMessage.startsWith('Failed') ? 'text-red-500' : 'text-green-500'}`}>
                                {inviteMessage}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
