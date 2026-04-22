import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsOptional,
    IsArray,
    IsInt,
    Min,
    Max,
    IsBoolean,
    IsIn,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BattleMode, BattleRoyaleFormat, SkillType } from '@prisma/client';
import { RoundConfigDto } from './round-config.dto';

export class CreateBattleDto {
    @ApiPropertyOptional({
        description: 'ID of the problem for this battle (required for 1v1/battle royale)',
        example: 'problem-uuid-123',
    })
    @IsString()
    @IsOptional()
    problemId?: string;

    @ApiProperty({
        description: 'Battle mode',
        enum: BattleMode,
        default: BattleMode.ONE_V_ONE,
    })
    @IsEnum(BattleMode)
    @IsOptional()
    mode?: BattleMode;

    // Team battle settings (for CLAN_VS_CLAN and GROUP modes)

    @ApiPropertyOptional({
        description: 'Team size for team battles (2, 3, or 5)',
        example: 3,
        enum: [2, 3, 5],
    })
    @IsInt()
    @IsIn([2, 3, 5])
    @IsOptional()
    teamSize?: number;

    @ApiPropertyOptional({
        description: 'Time limit in minutes (default 5, max 120)',
        example: 30,
        minimum: 1,
        maximum: 120,
    })
    @IsInt()
    @Min(1)
    @Max(120)
    @IsOptional()
    timeLimitMinutes?: number;

    @ApiPropertyOptional({
        description: 'Problem IDs for team battles. If empty, uses all available problems.',
        example: ['problem-001', 'problem-002'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    problemIds?: string[];

    @ApiPropertyOptional({
        description: 'Auto-balance teams by MMR (default true for GROUP mode)',
        default: true,
    })
    @IsBoolean()
    @IsOptional()
    autoBalance?: boolean;

    @ApiPropertyOptional({
        description: 'Skills enabled for this battle (each usable once per player)',
        example: ['FREEZE', 'SCRAMBLE'],
        enum: SkillType,
        isArray: true,
    })
    @IsArray()
    @IsEnum(SkillType, { each: true })
    @IsOptional()
    enabledSkills?: SkillType[];

    @ApiPropertyOptional({
        description: 'Generate an invite code for this battle. Players must ready up before the game starts.',
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    withInviteCode?: boolean;

    @ApiPropertyOptional({
        description: 'Preferred topic tag for random problem selection (e.g. arrays, strings, graphs)',
        example: 'arrays',
    })
    @IsString()
    @IsOptional()
    preferredTopic?: string;

    @ApiPropertyOptional({
        description: 'Preferred difficulty for random problem selection',
        enum: ['EASY', 'MEDIUM', 'HARD'],
    })
    @IsString()
    @IsOptional()
    preferredDifficulty?: 'EASY' | 'MEDIUM' | 'HARD';

    // ============================================
    // Battle Royale specific fields (required when mode === BATTLE_ROYALE)
    // ============================================

    @ApiPropertyOptional({
        description:
            'Battle Royale format. Required when mode === BATTLE_ROYALE.',
        enum: BattleRoyaleFormat,
    })
    @IsEnum(BattleRoyaleFormat)
    @IsOptional()
    battleRoyaleFormat?: BattleRoyaleFormat;

    @ApiPropertyOptional({
        description:
            'Total lobby size for Battle Royale (3..50). Required when mode === BATTLE_ROYALE.',
        example: 8,
        minimum: 3,
        maximum: 50,
    })
    @IsInt()
    @Min(3)
    @Max(50)
    @IsOptional()
    maxPlayers?: number;

    @ApiPropertyOptional({
        description:
            'Per-round configuration for Battle Royale. Each entry specifies the round time limit (seconds) and number of eliminations. Sum of eliminations must equal maxPlayers - 1. Required when mode === BATTLE_ROYALE.',
        type: [RoundConfigDto],
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => RoundConfigDto)
    @IsOptional()
    rounds?: RoundConfigDto[];
}
