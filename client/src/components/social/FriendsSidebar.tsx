import type { ReactNode } from 'react';
import { X, Users, Wifi, WifiOff, Inbox, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFriends } from '@/hooks/useFriends';
import { useSocialLayout } from '@/hooks/useSocialLayout';
import { AddFriendPopover } from './AddFriendPopover';
import { FriendRow } from './FriendRow';
import { IncomingRequestRow } from './IncomingRequestRow';
import { OutgoingPendingRow } from './OutgoingPendingRow';

export function FriendsSidebar() {
    const {
        friends,
        pendingRequests,
        outgoingRequests,
        loading,
        isFriendOnline,
    } = useFriends();
    const { setFriendsSidebarOpen } = useSocialLayout();

    const onlineFriends = friends.filter((friend) => isFriendOnline(friend.id));
    const offlineFriends = friends.filter((friend) => !isFriendOnline(friend.id));
    const hasAnyContent =
        friends.length > 0 ||
        pendingRequests.length > 0 ||
        outgoingRequests.length > 0;

    return (
        <div className="flex h-full flex-col border-l border-border bg-card text-card-foreground shadow-xl lg:shadow-none">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                        <div className="text-sm font-semibold">Friends</div>
                        <div className="text-[11px] text-muted-foreground">
                            {onlineFriends.length}/{friends.length} online
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <AddFriendPopover />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setFriendsSidebarOpen(false)}
                        aria-label="Close friends sidebar"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                {loading ? (
                    <LoadingState />
                ) : hasAnyContent ? (
                    <>
                        {pendingRequests.length > 0 && (
                            <SidebarSection
                                icon={<Inbox className="h-3.5 w-3.5" />}
                                title="Incoming"
                                count={pendingRequests.length}
                            >
                                <div className="space-y-2">
                                    {pendingRequests.map((request) => (
                                        <IncomingRequestRow
                                            key={request.id}
                                            request={request}
                                        />
                                    ))}
                                </div>
                            </SidebarSection>
                        )}

                        {outgoingRequests.length > 0 && (
                            <SidebarSection
                                icon={<Send className="h-3.5 w-3.5" />}
                                title="Outgoing"
                                count={outgoingRequests.length}
                            >
                                <div className="space-y-2">
                                    {outgoingRequests.map((request) => (
                                        <OutgoingPendingRow
                                            key={request.friendshipId}
                                            request={request}
                                        />
                                    ))}
                                </div>
                            </SidebarSection>
                        )}

                        <SidebarSection
                            icon={<Wifi className="h-3.5 w-3.5" />}
                            title="Online"
                            count={onlineFriends.length}
                        >
                            {onlineFriends.length === 0 ? (
                                <EmptySection>No friends online right now.</EmptySection>
                            ) : (
                                <div className="space-y-1">
                                    {onlineFriends.map((friend) => (
                                        <FriendRow
                                            key={friend.id}
                                            friend={friend}
                                            online
                                        />
                                    ))}
                                </div>
                            )}
                        </SidebarSection>

                        {offlineFriends.length > 0 && (
                            <SidebarSection
                                icon={<WifiOff className="h-3.5 w-3.5" />}
                                title="Offline"
                                count={offlineFriends.length}
                            >
                                <div className="space-y-1">
                                    {offlineFriends.map((friend) => (
                                        <FriendRow
                                            key={friend.id}
                                            friend={friend}
                                            online={false}
                                        />
                                    ))}
                                </div>
                            </SidebarSection>
                        )}
                    </>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <Users className="mb-3 h-8 w-8 text-muted-foreground/70" />
                        <div className="text-sm font-medium">No friends yet</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Add someone by exact username, or use the Lobby to meet
                            online players.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function SidebarSection({
    icon,
    title,
    count,
    children,
}: {
    icon: ReactNode;
    title: string;
    count: number;
    children: ReactNode;
}) {
    return (
        <section>
            <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {icon}
                <span>{title}</span>
                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5">
                    {count}
                </span>
            </div>
            {children}
        </section>
    );
}

function EmptySection({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {children}
        </div>
    );
}

function LoadingState() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-2 py-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
            ))}
        </div>
    );
}
