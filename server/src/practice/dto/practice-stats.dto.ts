import { ApiProperty } from '@nestjs/swagger';

export class TopicStatDto {
    @ApiProperty({ description: 'Tag / topic name', example: 'arrays' })
    tag: string;

    @ApiProperty({ description: 'Number of problems with this tag the user has solved', example: 3 })
    solved: number;

    @ApiProperty({ description: 'Total attempts made on problems with this tag', example: 12 })
    attempts: number;
}

export class DifficultyStatsDto {
    @ApiProperty({ description: 'Easy problems solved', example: 5 })
    EASY: number;

    @ApiProperty({ description: 'Medium problems solved', example: 2 })
    MEDIUM: number;

    @ApiProperty({ description: 'Hard problems solved', example: 0 })
    HARD: number;
}

export class PracticeStatsDto {
    @ApiProperty({ description: 'Total attempts recorded for this user', example: 27 })
    totalAttempts: number;

    @ApiProperty({ description: 'Unique problems with at least one passing attempt', example: 7 })
    totalSolved: number;

    @ApiProperty({ description: 'Percentage of attempts that passed (0-100)', example: 44.4 })
    solveRate: number;

    @ApiProperty({ description: 'Per-topic breakdown', type: [TopicStatDto] })
    topics: TopicStatDto[];

    @ApiProperty({ description: 'Solved counts by difficulty', type: DifficultyStatsDto })
    byDifficulty: DifficultyStatsDto;

    @ApiProperty({
        description: 'Whether the user is on a plan where attempts are persisted. FREE users always see empty stats.',
        example: true,
    })
    isTracked: boolean;
}
