import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

const SUPPORTED_LANGUAGES = ['javascript', 'python'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const PRACTICE_LANGUAGES = SUPPORTED_LANGUAGES;

export class SubmitAttemptDto {
    @ApiProperty({
        description: 'Problem ID to submit an attempt for',
        example: 'problem-001-two-sum',
    })
    @IsString()
    @IsNotEmpty()
    problemId: string;

    @ApiProperty({
        description: 'Source code to evaluate',
        example: 'function twoSum(nums, target) { return [0, 1]; }',
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({
        description: 'Programming language',
        enum: SUPPORTED_LANGUAGES,
        example: 'javascript',
    })
    @IsString()
    @IsIn(SUPPORTED_LANGUAGES as unknown as string[])
    language: SupportedLanguage;
}
