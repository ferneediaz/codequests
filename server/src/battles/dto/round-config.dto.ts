import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

/**
 * Configuration for a single round.
 *
 * Used for both Battle Royale (where `eliminateCount` is required) and
 * Clan Wars (where `eliminateCount` is ignored — teams aren't eliminated).
 *
 * Each round has an independent time limit and (for BR) elimination count,
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

    @ApiPropertyOptional({
        description:
            'Battle Royale only: number of players eliminated at the end of this round (>= 0). Sum across rounds must equal maxPlayers - 1. Ignored for Clan Wars.',
        example: 2,
        minimum: 0,
    })
    @IsInt()
    @Min(0)
    @IsOptional()
    eliminateCount?: number;
}
