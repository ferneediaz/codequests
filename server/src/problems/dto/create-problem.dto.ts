import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsArray,
    ValidateNested,
    IsBoolean,
    IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty } from '@prisma/client';

export class CreateTestCaseDto {
    @ApiProperty({
        description: 'Input for the test case',
        example: '[2,7,11,15]\n9',
    })
    @IsString()
    @IsNotEmpty()
    input: string;

    @ApiProperty({
        description: 'Expected output for the test case',
        example: '[0,1]',
    })
    @IsString()
    @IsNotEmpty()
    expectedOutput: string;

    @ApiProperty({
        description: 'Whether this test case is hidden from users',
        example: false,
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    isHidden?: boolean;
}

export class CreateProblemDto {
    @ApiProperty({
        description: 'Title of the problem',
        example: 'Two Sum',
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({
        description: 'Detailed description of the problem with examples',
        example: 'Given an array of integers nums and an integer target...',
    })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({
        description: 'Difficulty level of the problem',
        enum: Difficulty,
        example: Difficulty.EASY,
    })
    @IsEnum(Difficulty)
    difficulty: Difficulty;

    @ApiProperty({
        description: 'Starter code for different languages (JSON object)',
        example: {
            javascript: 'function twoSum(nums, target) {\n  // Your code here\n}',
            python: 'def two_sum(nums, target):\n    # Your code here\n    pass',
        },
    })
    @IsOptional()
    starterCode?: Record<string, string>;

    @ApiProperty({
        description: 'Test cases for the problem',
        type: [CreateTestCaseDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateTestCaseDto)
    testCases: CreateTestCaseDto[];

    @ApiPropertyOptional({
        description: 'Tags for categorizing the problem (e.g. arrays, strings, graphs)',
        example: ['arrays', 'hash-table'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}
