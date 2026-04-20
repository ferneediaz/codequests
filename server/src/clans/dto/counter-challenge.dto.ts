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
} from 'class-validator';
import { SkillType } from '@prisma/client';

export class CounterChallengeDto {
    @ApiPropertyOptional({ description: 'Counter-proposal message', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    counterMessage?: string;

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
}
