import { ApiProperty } from '@nestjs/swagger';
import { TestCaseResult } from '../../code-execution/code-execution.service';

export class AttemptResultDto {
    @ApiProperty({ description: 'Number of test cases passed', example: 3 })
    passed: number;

    @ApiProperty({ description: 'Total number of test cases executed', example: 5 })
    total: number;

    @ApiProperty({ description: 'Whether every test case passed', example: false })
    allPassed: boolean;

    @ApiProperty({ description: 'Per-test case results' })
    results: TestCaseResult[];

    @ApiProperty({
        description: 'Whether this attempt was persisted to the DB (only true for PRO/trial users)',
        example: true,
    })
    saved: boolean;
}
