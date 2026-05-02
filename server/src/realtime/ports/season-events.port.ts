export interface SeasonEndedPayload {
    endedSeason: { id: string; name: string; number: number };
    newSeason: { id: string; name: string; number: number };
}

export interface SeasonEventsPort {
    emitSeasonEnded(data: SeasonEndedPayload): void;
}

export const SEASON_EVENTS_PORT = 'SEASON_EVENTS_PORT';
