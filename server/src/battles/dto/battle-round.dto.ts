import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    BattleRoundEndReason,
    BattleRoundStatus,
} from '@prisma/client';

/**
 * Response DTO for a single Battle Royale round.
 */
export class BattleRoundResponseDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    battleId!: string;

    @ApiProperty({ example: 1 })
    roundNumber!: number;

    @ApiProperty({ enum: BattleRoundStatus })
    status!: BattleRoundStatus;

    @ApiProperty({ example: 300 })
    timeLimitSeconds!: number;

    @ApiProperty({ example: 2 })
    eliminateCount!: number;

    @ApiPropertyOptional({ description: 'SAME_PROBLEM: the problem id for this round.' })
    problemId?: string | null;

    @ApiPropertyOptional({ type: String, format: 'date-time' })
    startedAt?: Date | null;

    @ApiPropertyOptional({ type: String, format: 'date-time' })
    endedAt?: Date | null;

    @ApiPropertyOptional({ enum: BattleRoundEndReason })
    endedReason?: BattleRoundEndReason | null;
}

/**
 * One entry in the BR standings listing.
 */
export class BattleRoyaleStandingsEntryDto {
    @ApiProperty()
    userId!: string;

    @ApiPropertyOptional()
    username?: string;

    @ApiProperty({ example: false })
    isEliminated!: boolean;

    @ApiPropertyOptional({ example: 3, description: '1 = winner; null until battle ends or user is eliminated.' })
    placement?: number | null;

    @ApiPropertyOptional({ example: 2 })
    eliminatedInRound?: number | null;

    @ApiProperty({ example: 17, description: 'Sum of points earned across all BattleRoundSubmissions (SCORE_ATTACK).' })
    cumulativePoints!: number;

    @ApiProperty({ example: 7, description: 'Points earned in the current round (SCORE_ATTACK).' })
    roundPoints!: number;

    @ApiProperty({ example: 3 })
    testsPassed!: number;

    @ApiProperty({ example: 5 })
    totalTests!: number;

    @ApiPropertyOptional({ type: String, format: 'date-time' })
    lastSubmittedAt?: Date | null;
}

export class BattleRoyaleStandingsResponseDto {
    @ApiProperty()
    battleId!: string;

    @ApiProperty({ example: 2 })
    currentRound!: number;

    @ApiProperty({ type: [BattleRoyaleStandingsEntryDto] })
    standings!: BattleRoyaleStandingsEntryDto[];
}
