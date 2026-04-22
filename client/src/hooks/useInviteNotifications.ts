import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/services/socket';
import { toast } from 'sonner';
import api from '@/services/api';
import type { BattleResponse } from '@/types/api';
import type { InviteReceivedPayload } from '@/types/socket';

// Global listener for `battle.invite_received`. Renders an actionable toast
// with Accept (joins via invite code, then routes to the lobby) and Decline
// (dismiss). Mounted once in RootLayout.
export function useInviteNotifications() {
    const navigate = useNavigate();

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleInvite = (data: InviteReceivedPayload) => {
            const modeLabel =
                data.battleMode === 'ONE_V_ONE'
                    ? '1v1'
                    : data.battleMode === 'BATTLE_ROYALE'
                      ? 'Battle Royale'
                      : 'Group Battle';

            const toastId = toast(
                `${data.inviterUsername} invited you to a ${modeLabel}!`,
                {
                    duration: 20000,
                    action: {
                        label: 'Accept',
                        onClick: async () => {
                            try {
                                const { data: battle } = await api.post<BattleResponse>(
                                    `/battles/invite/${data.inviteCode}/join`,
                                );
                                toast.dismiss(toastId);
                                navigate(`/battle/${battle.id}`);
                            } catch (err: unknown) {
                                const message =
                                    (err as {
                                        response?: { data?: { message?: string } };
                                    })?.response?.data?.message ??
                                    'Failed to join battle.';
                                toast.error(message);
                            }
                        },
                    },
                    cancel: {
                        label: 'Decline',
                        onClick: () => {
                            toast.dismiss(toastId);
                        },
                    },
                },
            );
        };

        socket.on('battle.invite_received', handleInvite);

        return () => {
            socket.off('battle.invite_received', handleInvite);
        };
    }, [navigate]);
}
