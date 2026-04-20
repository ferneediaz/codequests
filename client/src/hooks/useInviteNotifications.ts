import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/services/socket';
import { toast } from 'sonner';
import type { InviteReceivedPayload } from '@/types/socket';

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

            toast(`${data.inviterUsername} invited you to a ${modeLabel}!`, {
                duration: 15000,
                action: {
                    label: 'Join',
                    onClick: () => {
                        navigate(`/battle/${data.battleId}`);
                    },
                },
            });
        };

        socket.on('battle.invite_received', handleInvite);

        return () => {
            socket.off('battle.invite_received', handleInvite);
        };
    }, [navigate]);
}
