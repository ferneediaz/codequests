import { ApiProperty } from '@nestjs/swagger';
import { BattleRoyaleFormat } from '@prisma/client';

/**
 * A single round preset entry (per-round config).
 */
export class RoyalePresetRoundDto {
    @ApiProperty({ example: 300 })
    timeLimitSeconds!: number;

    @ApiProperty({ example: 2 })
    eliminateCount!: number;
}

/**
 * A server-provided Battle Royale preset the client can fetch and use
 * as-is or mutate before POSTing a new battle.
 *
 * Presets are NOT enforced server-side — clients may always POST fully
 * custom configurations that satisfy the `validateConfig` rules.
 */
export class RoyalePresetDto {
    @ApiProperty({ example: 'classic-8' })
    id!: string;

    @ApiProperty({ example: 'Classic 8-player bracket' })
    name!: string;

    @ApiProperty({ example: 'Eight players, three rounds, last one standing.' })
    description!: string;

    @ApiProperty({ enum: BattleRoyaleFormat })
    battleRoyaleFormat!: BattleRoyaleFormat;

    @ApiProperty({ example: 8 })
    maxPlayers!: number;

    @ApiProperty({ type: [RoyalePresetRoundDto] })
    rounds!: RoyalePresetRoundDto[];
}
