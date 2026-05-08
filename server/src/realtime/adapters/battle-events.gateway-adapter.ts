import { Injectable } from '@nestjs/common';
import { BattlesGateway } from '../../websockets/battles.gateway';
import {
    BattleEventsPort,
    BattleRematchCreatedPayload,
    ClanWarsPlayerReadyNextRoundPayload,
    ClanWarsRoundEndPayload,
    ClanWarsRoundIntermissionPayload,
    ClanWarsRoundStartPayload,
    ClanWarsTeamStandingsPayload,
    RoyaleEliminationPayload,
    RoyaleRoundEndPayload,
    RoyaleRoundStartPayload,
    RoyaleStandingsPayload,
    SubmissionPayload,
} from '../ports/battle-events.port';

@Injectable()
export class BattleEventsGatewayAdapter implements BattleEventsPort {
    constructor(private readonly gateway: BattlesGateway) {}

    emitBattleSubmission(battleId: string, data: SubmissionPayload): void {
        this.gateway.emitBattleSubmission(battleId, data);
    }

    emitBattleCompleted(battleId: string, battle: unknown): void {
        this.gateway.emitBattleCompleted(battleId, battle);
    }

    emitBattleRematchCreated(
        participantUserIds: string[],
        data: BattleRematchCreatedPayload,
    ): void {
        this.gateway.emitBattleRematchCreated(participantUserIds, data);
    }

    emitRoyaleRoundStart(
        battleId: string,
        data: RoyaleRoundStartPayload,
    ): void {
        this.gateway.emitRoyaleRoundStart(battleId, data);
    }

    emitRoyaleRoundEnd(battleId: string, data: RoyaleRoundEndPayload): void {
        this.gateway.emitRoyaleRoundEnd(battleId, data);
    }

    emitRoyaleElimination(
        battleId: string,
        data: RoyaleEliminationPayload,
    ): void {
        this.gateway.emitRoyaleElimination(battleId, data);
    }

    emitRoyaleStandings(
        battleId: string,
        data: RoyaleStandingsPayload,
    ): void {
        this.gateway.emitRoyaleStandings(battleId, data);
    }

    emitClanWarsRoundStart(
        battleId: string,
        data: ClanWarsRoundStartPayload,
    ): void {
        this.gateway.emitClanWarsRoundStart(battleId, data);
    }

    emitClanWarsRoundEnd(
        battleId: string,
        data: ClanWarsRoundEndPayload,
    ): void {
        this.gateway.emitClanWarsRoundEnd(battleId, data);
    }

    emitClanWarsTeamStandings(
        battleId: string,
        data: ClanWarsTeamStandingsPayload,
    ): void {
        this.gateway.emitClanWarsTeamStandings(battleId, data);
    }

    emitClanWarsRoundIntermission(
        battleId: string,
        data: ClanWarsRoundIntermissionPayload,
    ): void {
        this.gateway.emitClanWarsRoundIntermission(battleId, data);
    }

    emitClanWarsPlayerReadyNextRound(
        battleId: string,
        data: ClanWarsPlayerReadyNextRoundPayload,
    ): void {
        this.gateway.emitClanWarsPlayerReadyNextRound(battleId, data);
    }
}
