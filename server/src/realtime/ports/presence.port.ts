export interface PresencePort {
    isOnline(userId: string): boolean;
    // Snapshot of every currently-connected user id. Returned as a fresh
    // array (not the live Map) so callers can iterate without coupling to
    // the underlying socket store.
    getOnlineUserIds(): string[];
    // Best-effort direct-to-user emit. Returns true when the user was
    // online and the payload was handed to a socket; false otherwise.
    emitToUser(userId: string, event: string, payload: unknown): boolean;
}

export const PRESENCE_PORT = 'PRESENCE_PORT';
