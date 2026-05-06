import { useState } from 'react';
import { Popover } from 'radix-ui';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/notificationsContext';

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
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

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
                        {notifications.length > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="text-[11px] text-muted-foreground hover:text-foreground"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <ul className="divide-y divide-border">
                                {notifications.map((notification) => (
                                    <li key={notification.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                markRead(notification.id);
                                                setOpen(false);
                                                if (notification.href) {
                                                    navigate(notification.href);
                                                }
                                            }}
                                            className="flex w-full gap-3 px-3 py-3 text-left hover:bg-muted"
                                        >
                                            <span
                                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                                    notification.read
                                                        ? 'bg-muted'
                                                        : 'bg-primary'
                                                }`}
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">
                                                    {notification.title}
                                                </span>
                                                {notification.body && (
                                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                        {notification.body}
                                                    </span>
                                                )}
                                                <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                                                    {notification.kind.replaceAll('_', ' ')}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

function EmptyState() {
    return (
        <div className="px-4 py-8 text-center">
            <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">You're all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
                Match, message, friend, and clan alerts will show up here.
            </p>
        </div>
    );
}
