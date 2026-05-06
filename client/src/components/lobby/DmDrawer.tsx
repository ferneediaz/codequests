import { Maximize2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DmConversationView } from '@/components/messages/DmConversationView';
import type { DmTargetUser } from '@/context/socialLayoutContext';

interface DmDrawerProps {
    conversationId: string;
    otherUser: DmTargetUser;
    currentUserId?: string;
    onClose: () => void;
}

/**
 * Lightweight DM panel that opens when the user clicks "Message" on a lobby
 * row. Joins the DM Socket.IO room, fetches recent history, and streams
 * incoming messages. Intentionally simple: no unread tracking or multi-DM
 * tabbing — that can come in Phase 3.
 */
export function DmDrawer({
    conversationId,
    otherUser,
    currentUserId,
    onClose,
}: DmDrawerProps) {
    const navigate = useNavigate();

    const openInInbox = () => {
        navigate(`/messages?c=${encodeURIComponent(conversationId)}`);
        onClose();
    };

    return (
        <div className="pointer-events-auto fixed bottom-4 right-4 z-50 flex h-[440px] w-[340px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    {otherUser.avatarUrl ? (
                        <img
                            src={otherUser.avatarUrl}
                            alt={otherUser.username}
                            className="h-6 w-6 rounded-full"
                        />
                    ) : (
                        <div className="h-6 w-6 rounded-full bg-muted" />
                    )}
                    <span className="truncate text-sm font-semibold">
                        {otherUser.username}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={openInInbox}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Open in inbox"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <DmConversationView
                conversationId={conversationId}
                otherUser={otherUser}
                currentUserId={currentUserId}
            />
        </div>
    );
}
