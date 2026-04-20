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
} from 'class-validator';
import { SkillType } from '@prisma/client';

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
}
