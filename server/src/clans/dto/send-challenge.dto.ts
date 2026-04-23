import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
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

export class SendChallengeDto {
    @ApiProperty({ description: 'Target clan ID to challenge' })
    @IsString()
    @IsNotEmpty()
    targetClanId: string;

    @ApiPropertyOptional({ description: 'Challenge message', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;

    @ApiPropertyOptional({
        description:
            'Battle mode negotiated by this challenge. Defaults to CLAN_VS_CLAN (legacy single-problem team battle). Use CLAN_WARS for a multi-round two-team war.',
        enum: BattleMode,
        default: BattleMode.CLAN_VS_CLAN,
    })
    @IsOptional()
    @IsEnum(BattleMode)
    mode?: BattleMode;

    @ApiPropertyOptional({ description: 'Team size', enum: [2, 3, 5], default: 2 })
    @IsOptional()
    @IsInt()
    @IsIn([2, 3, 5])
    teamSize?: number;

    @ApiPropertyOptional({ description: 'Time limit in minutes', default: 30, minimum: 1, maximum: 120 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(120)
    timeLimitMinutes?: number;

    @ApiPropertyOptional({ description: 'Enabled skills for the battle', enum: SkillType, isArray: true })
    @IsOptional()
    @IsArray()
    @IsEnum(SkillType, { each: true })
    enabledSkills?: SkillType[];

    @ApiPropertyOptional({ description: 'Preferred problem topic' })
    @IsOptional()
    @IsString()
    preferredTopic?: string;

    // ==============================
    // CLAN_WARS-specific proposed config
    // ==============================

    @ApiPropertyOptional({
        description: 'Clan Wars format (required when mode === CLAN_WARS).',
        enum: ClanWarsFormat,
    })
    @IsOptional()
    @IsEnum(ClanWarsFormat)
    clanWarsFormat?: ClanWarsFormat;

    @ApiPropertyOptional({
        description:
            'Per-round configuration for CLAN_WARS. Each entry specifies the round time limit (seconds). Required when mode === CLAN_WARS.',
        type: [RoundConfigDto],
    })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => RoundConfigDto)
    rounds?: RoundConfigDto[];
}
