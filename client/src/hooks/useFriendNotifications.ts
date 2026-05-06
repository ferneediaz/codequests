import { useFriends } from './useFriends';
import type { FriendNotificationsContextValue } from '@/context/friendNotificationsContext';

/**
 * Hook for reading and mutating friend-request notifications.
 *
 * Must be called from inside `<FriendNotificationsProvider>`, which is
 * mounted once in `RootLayout`. The context is shared by the navbar
 * bell (badge + popover) and any ad-hoc accept/decline UI so they
 * always render from the same source of truth.
 */
export function useFriendNotifications(): FriendNotificationsContextValue {
    return useFriends();
}
