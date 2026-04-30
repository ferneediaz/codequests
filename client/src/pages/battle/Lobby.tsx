import { useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { useAppSelector } from '@/store/hooks';
import { useLobbyPresence } from '@/hooks/useLobbyPresence';
import { OnlineUsersPanel } from '@/components/lobby/OnlineUsersPanel';
import { LobbyChatPanel } from '@/components/lobby/LobbyChatPanel';
import { OnlineClansPanel } from '@/components/lobby/OnlineClansPanel';
import { DmDrawer } from '@/components/lobby/DmDrawer';
import type { LobbyUser } from '@/types/lobby';

interface OpenDmState {
    conversationId: string;
    user: LobbyUser;
}

/**
 * Global lobby — pre-battle social hub. Three-column layout on desktop:
 * online players (left), public chat (center), active clans (right). On
 * mobile/tablet the panels stack vertically so each still feels first-class.
 */
export default function Lobby() {
    const user = useAppSelector((s) => s.auth.user);
    const { snapshot, loading, error, refresh, patchUser } = useLobbyPresence();
    const [openDm, setOpenDm] = useState<OpenDmState | null>(null);

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-7xl px-4 py-6">
                <AnimateIn direction="up">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                                Lobby
                            </h1>
                            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                                See who's around, chat in the public channel,
                                add friends, and throw down a challenge.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant="secondary"
                                className="flex items-center gap-1.5"
                            >
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                <Users className="h-3 w-3" />
                                {snapshot?.onlineCount ?? 0} online
                            </Badge>
                        </div>
                    </div>
                </AnimateIn>

                {error && (
                    <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {loading && !snapshot ? (
                    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Loading lobby...
                    </div>
                ) : (
                    <div className="grid min-h-[calc(100vh-14rem)] gap-4 lg:grid-cols-12">
                        <div className="min-h-[360px] lg:col-span-3">
                            <OnlineUsersPanel
                                users={snapshot?.users ?? []}
                                onUserPatch={patchUser}
                                onRefresh={() => void refresh()}
                                onOpenDm={(conversationId, otherUser) =>
                                    setOpenDm({ conversationId, user: otherUser })
                                }
                            />
                        </div>
                        <div className="min-h-[420px] lg:col-span-6">
                            <LobbyChatPanel currentUserId={user?.id} />
                        </div>
                        <div className="min-h-[360px] lg:col-span-3">
                            <OnlineClansPanel clans={snapshot?.clans ?? []} />
                        </div>
                    </div>
                )}
            </div>

            {openDm && (
                <DmDrawer
                    conversationId={openDm.conversationId}
                    otherUser={openDm.user}
                    currentUserId={user?.id}
                    onClose={() => setOpenDm(null)}
                />
            )}
        </div>
    );
}
