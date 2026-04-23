import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEnum,
    IsArray,
    IsInt,
    Min,
    Max,
    IsBoolean,
    ValidateNested,
    ArrayMinSize,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClanWarsFormat, SkillType } from '@prisma/client';
import { RoundConfigDto } from './round-config.dto';

/**
 * Optional descriptor for one team when creating a Clan Wars battle.
 *
 * - `clanId` — if provided, the team is backed by an official clan; stats
 *   (wins/losses/MMR) are persisted on the clan row at finalize time. All
 *   players joining this side must be members of that clan.
 * - `clanId` omitted — team is a "temporary clan": labels-only, no stats
 *   persistence. Any player may join via the invite path.
 * - `name` / `tag` — display labels. For official clans these default to
 *   the clan's registered name/tag; for temporary clans the captain
 *   chooses them.
 */
export class ClanWarsTeamDto {
    @ApiPropertyOptional({
        description:
            'Display name for the team. Required for temp clans, optional for official (defaults to clan.name).',
        example: 'Team Rocket',
        maxLength: 50,
    })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({
        description:
            'Display tag for the team. Optional; defaults to clan.tag for official clans.',
        example: 'RCKT',
        maxLength: 10,
    })
    @IsString()
    @MaxLength(10)
    @IsOptional()
    tag?: string;

    @ApiPropertyOptional({
        description:
            'Official clan ID to back this team. If present, joiners must be members of this clan and the clan row gets MMR/wins/losses updated at finalize time.',
        example: 'clan-uuid-123',
    })
    @IsString()
    @IsOptional()
    clanId?: string;
}

/**
 * Create a new Clan Wars battle (multi-round, two-team, cumulative team scoring).
 *
 * Architecturally mirrors Battle Royale: one `BattleRound` row per configured
 * round, optional invite code for the lobby, optional problem pool for
 * SCORE_ATTACK. Unlike BR, there is no elimination — the winning team is the
 * one with the highest cumulative team score at the end of the final round.
 */
export class CreateClanWarsBattleDto {
    @ApiProperty({
        description: 'Clan Wars format.',
        enum: ClanWarsFormat,
    })
    @IsEnum(ClanWarsFormat)
    clanWarsFormat!: ClanWarsFormat;

    @ApiProperty({
        description: 'Players per team (1..10). Total lobby size = teamSize * 2.',
        example: 3,
        minimum: 1,
        maximum: 10,
    })
    @IsInt()
    @Min(1)
    @Max(10)
    teamSize!: number;

    @ApiProperty({
        description:
            'Per-round configuration. Each entry specifies the round time limit (seconds). eliminateCount is ignored for Clan Wars.',
        type: [RoundConfigDto],
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => RoundConfigDto)
    rounds!: RoundConfigDto[];

    @ApiPropertyOptional({
        description: 'Skills enabled for this battle (each usable once per player).',
        enum: SkillType,
        isArray: true,
    })
    @IsArray()
    @IsEnum(SkillType, { each: true })
    @IsOptional()
    enabledSkills?: SkillType[];

    @ApiPropertyOptional({
        description: 'Preferred topic tag for random problem selection (SAME_PROBLEM).',
        example: 'arrays',
    })
    @IsString()
    @IsOptional()
    preferredTopic?: string;

    @ApiPropertyOptional({
        description: 'Preferred difficulty for random problem selection (SAME_PROBLEM).',
        enum: ['EASY', 'MEDIUM', 'HARD'],
    })
    @IsString()
    @IsOptional()
    preferredDifficulty?: 'EASY' | 'MEDIUM' | 'HARD';

    @ApiPropertyOptional({
        description:
            'Explicit problem pool for SCORE_ATTACK. If omitted, the server samples from the global pool at round start.',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    problemIds?: string[];

    @ApiPropertyOptional({
        description: 'Creator-side team config. Creator becomes team-1 captain.',
        type: ClanWarsTeamDto,
    })
    @ValidateNested()
    @Type(() => ClanWarsTeamDto)
    @IsOptional()
    teamOne?: ClanWarsTeamDto;

    @ApiPropertyOptional({
        description:
            'Opponent-side team config. May be pre-filled (e.g. from ClanChallenge accept) or left empty — the first joiner on team-2 becomes captain and sets the labels.',
        type: ClanWarsTeamDto,
    })
    @ValidateNested()
    @Type(() => ClanWarsTeamDto)
    @IsOptional()
    teamTwo?: ClanWarsTeamDto;

    @ApiPropertyOptional({
        description:
            'Generate an invite code for the lobby. Players must ready up before the first round starts.',
        default: true,
    })
    @IsBoolean()
    @IsOptional()
    withInviteCode?: boolean;
}
