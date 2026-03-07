import { ApiProperty } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';

export class TestCaseResponseDto {
    @ApiProperty({ description: 'Test case ID' })
    id: string;

    @ApiProperty({ description: 'Input for the test case' })
    input: string;

    @ApiProperty({ description: 'Expected output for the test case' })
    expectedOutput: string;

    @ApiProperty({ description: 'Whether this test case is hidden from users' })
    isHidden: boolean;
}

export class ProblemResponseDto {
    @ApiProperty({ description: 'Problem ID' })
    id: string;

    @ApiProperty({ description: 'Problem title', example: 'Two Sum' })
    title: string;

    @ApiProperty({ description: 'Problem description' })
    description: string;

    @ApiProperty({ description: 'Difficulty level', enum: Difficulty })
    difficulty: Difficulty;

    @ApiProperty({
        description: 'Starter code for different languages (JSON object)',
        example: {
            javascript: 'function twoSum(nums, target) {\n  // Your code here\n}',
            python: 'def two_sum(nums, target):\n    # Your code here\n    pass',
        },
    })
    starterCode: string;

    @ApiProperty({
        description: 'Test cases (only visible ones for non-admin users)',
        type: [TestCaseResponseDto],
        required: false,
    })
    testCases?: TestCaseResponseDto[];

    @ApiProperty({ description: 'Creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Last update timestamp' })
    updatedAt: Date;
}
