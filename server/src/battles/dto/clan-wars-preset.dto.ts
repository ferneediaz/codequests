import { ApiProperty } from '@nestjs/swagger';
import { ClanWarsFormat } from '@prisma/client';

/**
 * A single round preset entry for Clan Wars.
 */
export class ClanWarsPresetRoundDto {
    @ApiProperty({ example: 300 })
    timeLimitSeconds!: number;
}

/**
 * A server-provided Clan Wars preset the client can fetch and use
 * as-is or mutate before POSTing a new battle.
 *
 * Presets are NOT enforced server-side — clients may always POST fully
 * custom configurations that satisfy the Clan Wars validation rules.
 */
export class ClanWarsPresetDto {
    @ApiProperty({ example: '3v3-same-problem-3r' })
    id!: string;

    @ApiProperty({ example: '3v3 Same Problem (3 rounds)' })
    name!: string;

    @ApiProperty({
        example: 'Three rounds, both teams tackle the same problem each round.',
    })
    description!: string;

    @ApiProperty({ enum: ClanWarsFormat })
    clanWarsFormat!: ClanWarsFormat;

    @ApiProperty({ example: 3, description: 'Players per team.' })
    teamSize!: number;

    @ApiProperty({ type: [ClanWarsPresetRoundDto] })
    rounds!: ClanWarsPresetRoundDto[];
}
