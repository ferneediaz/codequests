import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitSolutionDto {
    @ApiProperty({
        description: 'The code solution',
        example: 'function twoSum(nums, target) { ... }',
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({
        description: 'Programming language',
        example: 'javascript',
    })
    @IsString()
    @IsNotEmpty()
    language: string;

    @ApiPropertyOptional({
        description: 'Problem ID (required for team battles to specify which problem)',
        example: 'problem-uuid-123',
    })
    @IsString()
    @IsOptional()
    problemId?: string;
}
