import type { BattleRoundEndReason } from '@prisma/client';

// Payload shapes mirror the gateway emit signatures verbatim so the adapter
// can pass through without restructuring. Keep them here (rather than in the
// gateway) so domain services depend only on `realtime/`.

export interface SubmissionPayload {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
    submittedAt: Date;
}

export interface RoyaleRoundStartPayload {
    battleId: string;
    roundNumber: number;
    totalRounds: number;
    problemId: string | null;
    timeLimitSeconds: number;
    eliminateCount: number;
    remainingUserIds: string[];
    startedAt: Date;
}

export interface RoyaleRoundEndPayload {
    battleId: string;
    roundNumber: number;
    endedReason: BattleRoundEndReason;
    eliminatedUserIds: string[];
    standings: unknown[];
}

export interface RoyaleEliminationPayload {
    battleId: string;
    userId: string;
    roundNumber: number;
    placement: number;
}

export interface RoyaleStandingsPayload {
    battleId: string;
    roundNumber: number;
    standings: unknown[];
}

export interface ClanWarsRoundStartPayload {
    battleId: string;
    roundNumber: number;
    totalRounds: number;
    problemId: string | null;
    timeLimitSeconds: number;
    startedAt: Date;
    participantUserIds: string[];
}

export interface ClanWarsRoundEndPayload {
    battleId: string;
    roundNumber: number;
    endedReason: BattleRoundEndReason;
    roundWinner: 'team-1' | 'team-2' | null;
    teams: unknown[];
}

export interface ClanWarsTeamStandingsPayload {
    battleId: string;
    roundNumber: number;
    teams: unknown[];
}

export interface ClanWarsRoundIntermissionPayload {
    battleId: string;
    justEndedRound: number;
    nextRoundNumber: number;
    readyUserIds: string[];
}

export interface ClanWarsPlayerReadyNextRoundPayload {
    battleId: string;
    userId: string;
    nextRoundNumber: number;
    readyUserIds: string[];
    allReady: boolean;
}

export interface BattleRematchCreatedPayload {
    originalBattleId: string;
    rematchBattleId: string;
    initiatedByUserId: string;
}

export interface BattleEventsPort {
    emitBattleSubmission(battleId: string, data: SubmissionPayload): void;
    emitBattleCompleted(battleId: string, battle: unknown): void;
    emitBattleRematchCreated(
        participantUserIds: string[],
        data: BattleRematchCreatedPayload,
    ): void;
    emitRoyaleRoundStart(battleId: string, data: RoyaleRoundStartPayload): void;
    emitRoyaleRoundEnd(battleId: string, data: RoyaleRoundEndPayload): void;
    emitRoyaleElimination(battleId: string, data: RoyaleEliminationPayload): void;
    emitRoyaleStandings(battleId: string, data: RoyaleStandingsPayload): void;
    emitClanWarsRoundStart(battleId: string, data: ClanWarsRoundStartPayload): void;
    emitClanWarsRoundEnd(battleId: string, data: ClanWarsRoundEndPayload): void;
    emitClanWarsTeamStandings(
        battleId: string,
        data: ClanWarsTeamStandingsPayload,
    ): void;
    emitClanWarsRoundIntermission(
        battleId: string,
        data: ClanWarsRoundIntermissionPayload,
    ): void;
    emitClanWarsPlayerReadyNextRound(
        battleId: string,
        data: ClanWarsPlayerReadyNextRoundPayload,
    ): void;
}

export const BATTLE_EVENTS_PORT = 'BATTLE_EVENTS_PORT';
