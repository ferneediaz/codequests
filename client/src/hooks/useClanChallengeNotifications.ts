import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getSocket } from '@/services/socket';
import type { ChallengeClan } from '@/types/clans';

interface ClanChallengeEventPayload {
    challengeId: string;
    challengerClan?: ChallengeClan;
    challengedClan?: ChallengeClan;
    message?: string;
    battleId?: string | null;
}

export function useClanChallengeNotifications() {
    const navigate = useNavigate();

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const showToast = (
            title: string,
            data: ClanChallengeEventPayload,
            description?: string,
        ) => {
            const clanId = data.challengedClan?.id ?? data.challengerClan?.id;
            toast(title, {
                description,
                action: clanId
                    ? {
                          label: 'View',
                          onClick: () => navigate(`/clans/${clanId}`),
                      }
                    : undefined,
            });
        };

        const handleReceived = (data: ClanChallengeEventPayload) => {
            showToast(
                `${data.challengerClan?.name ?? 'A clan'} challenged your clan`,
                data,
                data.message,
            );
        };

        const handleAccepted = (data: ClanChallengeEventPayload) => {
            if (data.battleId) {
                toast('Clan challenge accepted', {
                    action: {
                        label: 'Join Battle',
                        onClick: () => navigate(`/battle/${data.battleId}`),
                    },
                });
                return;
            }
            showToast('Clan challenge accepted', data);
        };

        const handleDeclined = (data: ClanChallengeEventPayload) => {
            showToast('Clan challenge declined', data);
        };

        const handleCountered = (data: ClanChallengeEventPayload) => {
            showToast('Clan challenge countered', data);
        };

        socket.on('clan.challenge_received', handleReceived);
        socket.on('clan.challenge_accepted', handleAccepted);
        socket.on('clan.challenge_declined', handleDeclined);
        socket.on('clan.challenge_countered', handleCountered);

        return () => {
            socket.off('clan.challenge_received', handleReceived);
            socket.off('clan.challenge_accepted', handleAccepted);
            socket.off('clan.challenge_declined', handleDeclined);
            socket.off('clan.challenge_countered', handleCountered);
        };
    }, [navigate]);
}
