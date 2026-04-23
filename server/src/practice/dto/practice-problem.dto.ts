import { ApiProperty } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';
import { TestCaseResponseDto } from '../../problems/dto/problem-response.dto';

export class PracticeProblemDetailDto {
    @ApiProperty({ description: 'Problem ID' })
    id: string;

    @ApiProperty({ description: 'Problem title' })
    title: string;

    @ApiProperty({ description: 'Problem description (markdown)' })
    description: string;

    @ApiProperty({ description: 'Difficulty level', enum: Difficulty })
    difficulty: Difficulty;

    @ApiProperty({ description: 'Tags', type: [String] })
    tags: string[];

    @ApiProperty({ description: 'Starter code JSON (per-language prefix/body/suffix)' })
    starterCode: string;

    @ApiProperty({ description: 'Visible test cases', type: [TestCaseResponseDto] })
    testCases: TestCaseResponseDto[];

    @ApiProperty({
        description: 'Progressive hints, ordered from gentle nudge to strong spoiler. Length 1–3.',
        type: [String],
    })
    hints: string[];

    @ApiProperty({
        description: 'Reference solution, revealed on demand in the Practice Ground.',
    })
    solution: string;

    @ApiProperty({ description: 'Creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Last update timestamp' })
    updatedAt: Date;
}
