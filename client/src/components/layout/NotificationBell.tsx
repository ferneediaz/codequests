import { useEffect, useRef, useState } from 'react';
import { Popover } from 'radix-ui';
import { Bell, Check, X, UserPlus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RankBadge } from '@/components/ui/RankBadge';
import { useFriendNotifications } from '@/hooks/useFriendNotifications';
import type { PendingRequest } from '@/services/friends';

/**
 * Notification center entry point.
 *
 * Shows a bell icon in the navbar with an unread count. Clicking opens a
 * popover that lists incoming friend requests with inline Accept /
 * Decline actions, plus a "Recent" section for acceptances of the user's
 * own outgoing requests. Declines are intentionally not persisted here —
 * they're delivered via a single toast to avoid making them feel
 * permanent.
 */
export function NotificationBell() {
    const {
        pendingRequests,
        recentAccepted,
        unreadCount,
        loading,
        accept,
        decline,
        markAllSeen,
        refresh,
    } = useFriendNotifications();
    const [open, setOpen] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const seenOnOpenRef = useRef(false);

    // When the panel opens, clear the unread badge and silently refresh
    // in the background to catch anything that was missed while the
    // socket was disconnected.
    useEffect(() => {
        if (open && !seenOnOpenRef.current) {
            seenOnOpenRef.current = true;
            markAllSeen();
            void refresh();
        }
        if (!open) {
            seenOnOpenRef.current = false;
        }
    }, [open, markAllSeen, refresh]);

    const handleAccept = async (id: string) => {
        setBusyId(id);
        try {
            await accept(id);
        } finally {
            setBusyId(null);
        }
    };

    const handleDecline = async (id: string) => {
        setBusyId(id);
        try {
            await decline(id);
        } finally {
            setBusyId(null);
        }
    };

    const totalItems = pendingRequests.length + recentAccepted.length;

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={
                        unreadCount > 0
                            ? `Notifications (${unreadCount} unread)`
                            : 'Notifications'
                    }
                    className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span
                            aria-hidden
                            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-card bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 w-[360px] origin-(--radix-popover-content-transform-origin) overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">Notifications</span>
                        </div>
                        {totalItems > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                                {totalItems} item{totalItems === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        <PendingSection
                            requests={pendingRequests}
                            busyId={busyId}
                            loading={loading}
                            onAccept={handleAccept}
                            onDecline={handleDecline}
                        />
                        {recentAccepted.length > 0 && (
                            <RecentSection
                                items={recentAccepted.map((a) => ({
                                    friendshipId: a.friendshipId,
                                    friendUsername: a.friendUsername,
                                    friendAvatarUrl: a.friendAvatarUrl ?? null,
                                }))}
                            />
                        )}
                        {pendingRequests.length === 0 &&
                            recentAccepted.length === 0 &&
                            !loading && <EmptyState />}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

interface PendingSectionProps {
    requests: PendingRequest[];
    busyId: string | null;
    loading: boolean;
    onAccept: (id: string) => void;
    onDecline: (id: string) => void;
}

function PendingSection({
    requests,
    busyId,
    loading,
    onAccept,
    onDecline,
}: PendingSectionProps) {
    if (requests.length === 0 && !loading) return null;

    return (
        <div>
            <SectionHeader icon={<UserPlus className="h-3.5 w-3.5" />}>
                Friend requests
            </SectionHeader>
            {loading && requests.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Loading…
                </div>
            ) : (
                <ul className="divide-y divide-border">
                    {requests.map((r) => (
                        <li
                            key={r.id}
                            className="flex items-center gap-3 px-3 py-2.5"
                        >
                            <Avatar
                                username={r.requester.username}
                                avatarUrl={r.requester.avatarUrl}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                    {r.requester.username}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                    <RankBadge
                                        mmr={r.requester.mmr}
                                        className="text-[10px]"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => onAccept(r.id)}
                                    disabled={busyId === r.id}
                                    title="Accept"
                                    aria-label={`Accept friend request from ${r.requester.username}`}
                                    className="flex h-7 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Check className="h-3 w-3" />
                                    Accept
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDecline(r.id)}
                                    disabled={busyId === r.id}
                                    title="Decline"
                                    aria-label={`Decline friend request from ${r.requester.username}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

interface RecentSectionProps {
    items: {
        friendshipId: string;
        friendUsername: string;
        friendAvatarUrl: string | null;
    }[];
}

function RecentSection({ items }: RecentSectionProps) {
    return (
        <div>
            <SectionHeader icon={<UserCheck className="h-3.5 w-3.5" />}>
                Recent
            </SectionHeader>
            <ul className="divide-y divide-border">
                {items.map((a) => (
                    <li
                        key={a.friendshipId}
                        className="flex items-center gap-3 px-3 py-2.5"
                    >
                        <Avatar
                            username={a.friendUsername}
                            avatarUrl={a.friendAvatarUrl}
                        />
                        <div className="min-w-0 flex-1 text-sm">
                            <span className="font-medium">{a.friendUsername}</span>
                            <span className="text-muted-foreground">
                                {' '}
                                accepted your friend request.
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function SectionHeader({
    icon,
    children,
}: {
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {icon}
            {children}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="px-4 py-8 text-center">
            <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">You're all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
                Friend requests will show up here.
            </p>
        </div>
    );
}

function Avatar({
    username,
    avatarUrl,
}: {
    username: string;
    avatarUrl?: string | null;
}) {
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={username}
                className="h-9 w-9 shrink-0 rounded-full"
            />
        );
    }
    const initial = username.charAt(0).toUpperCase();
    return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {initial}
        </div>
    );
}
