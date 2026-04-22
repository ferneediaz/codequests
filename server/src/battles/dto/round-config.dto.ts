import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

/**
 * Configuration for a single Battle Royale round.
 *
 * Clients provide one of these per round when creating a BR battle.
 * Each round has an independent time limit and elimination count,
 * so arbitrary formats like "20 players, 5 rounds, eliminate [5,5,5,3,1]"
 * are supported.
 */
export class RoundConfigDto {
    @ApiProperty({
        description: 'Per-round time limit in seconds (10s .. 7200s).',
        example: 300,
        minimum: 10,
        maximum: 7200,
    })
    @IsInt()
    @Min(10)
    @Max(7200)
    timeLimitSeconds!: number;

    @ApiProperty({
        description:
            'Number of players eliminated at the end of this round (>= 0). Sum across rounds must equal maxPlayers - 1.',
        example: 2,
        minimum: 0,
    })
    @IsInt()
    @Min(0)
    eliminateCount!: number;
}
