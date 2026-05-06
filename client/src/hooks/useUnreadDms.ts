import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnreadCounts, type UnreadCountsResponse } from '@/services/chatApi';
import { getChatSocket } from '@/services/socket';
import { queryKeys } from '@/lib/queryKeys';
import { useAppSelector } from '@/store/hooks';

export function useUnreadDms() {
    const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: queryKeys.chat.unreadCounts(),
        queryFn: getUnreadCounts,
        enabled: isAuthenticated,
        initialData: { dmTotal: 0, perRoom: {} },
    });

    useEffect(() => {
        if (!isAuthenticated) return;
        const socket = getChatSocket();
        if (!socket) return;

        const handleUnreadChanged = (counts: UnreadCountsResponse) => {
            queryClient.setQueryData(queryKeys.chat.unreadCounts(), counts);
        };

        socket.on('chat.unread_changed', handleUnreadChanged);
        return () => {
            socket.off('chat.unread_changed', handleUnreadChanged);
        };
    }, [isAuthenticated, queryClient]);

    return query.data;
}
