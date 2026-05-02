export interface ClanEventsPort {
    emitToClanMembers(memberIds: string[], event: string, data: unknown): void;
}

export const CLAN_EVENTS_PORT = 'CLAN_EVENTS_PORT';
