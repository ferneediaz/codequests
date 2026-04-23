import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsInt,
    IsIn,
    IsArray,
    IsEnum,
    MaxLength,
    Min,
    Max,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BattleMode, ClanWarsFormat, SkillType } from '@prisma/client';
import { RoundConfigDto } from '../../battles/dto/round-config.dto';

export class CounterChallengeDto {
    @ApiPropertyOptional({ description: 'Counter-proposal message', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    counterMessage?: string;

    @ApiPropertyOptional({
        description:
            'Counter-proposed battle mode. Defaults to whatever the original proposal used.',
        enum: BattleMode,
    })
    @IsOptional()
    @IsEnum(BattleMode)
    mode?: BattleMode;

    @ApiPropertyOptional({ description: 'Proposed team size', enum: [2, 3, 5] })
    @IsOptional()
    @IsInt()
    @IsIn([2, 3, 5])
    teamSize?: number;

    @ApiPropertyOptional({ description: 'Proposed time limit in minutes', minimum: 1, maximum: 120 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(120)
    timeLimitMinutes?: number;

    @ApiPropertyOptional({ description: 'Proposed skills for the battle', enum: SkillType, isArray: true })
    @IsOptional()
    @IsArray()
    @IsEnum(SkillType, { each: true })
    enabledSkills?: SkillType[];

    @ApiPropertyOptional({ description: 'Proposed problem topic' })
    @IsOptional()
    @IsString()
    preferredTopic?: string;

    // ==============================
    // CLAN_WARS-specific counter-proposal
    // ==============================

    @ApiPropertyOptional({
        description: 'Counter-proposed Clan Wars format (only meaningful when mode === CLAN_WARS).',
        enum: ClanWarsFormat,
    })
    @IsOptional()
    @IsEnum(ClanWarsFormat)
    clanWarsFormat?: ClanWarsFormat;

    @ApiPropertyOptional({
        description:
            'Counter-proposed per-round configuration for CLAN_WARS.',
        type: [RoundConfigDto],
    })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => RoundConfigDto)
    rounds?: RoundConfigDto[];
}
