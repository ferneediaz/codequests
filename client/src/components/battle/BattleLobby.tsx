import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    const allReady = battle.participants.length >= 2 && battle.participants.every((p) => p.isReady);

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
                            Waiting for all players to ready up
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
                            Players ({battle.participants.length})
                        </h3>
                        {battle.participants.map((p) => {
                            const username = p.username || (p as any).user?.username || 'Unknown';
                            return (
                            <div
                                key={p.userId}
                                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                                        {username.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-foreground">
                                        {username}
                                        {p.userId === currentUserId && (
                                            <span className="ml-1 text-xs text-muted-foreground">(you)</span>
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
                        disabled={battle.participants.length < 2 && !isReady}
                    >
                        {isReady ? 'Cancel Ready' : 'Ready Up'}
                    </Button>

                    {battle.participants.length < 2 && (
                        <p className="text-center text-xs text-muted-foreground">
                            Need at least 2 players to start
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
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter username"
                                value={inviteUsername}
                                onChange={(e) => setInviteUsername(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleInviteUser()}
                                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
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
