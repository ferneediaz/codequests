import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PistonClient, PISTON_LANGUAGES } from './piston.client';

export interface TestCaseResult {
    testCaseId: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string | null;
    error: string | null;
    executionTime: string | null;
}

export interface ExecutionResult {
    passed: number;
    total: number;
    results: TestCaseResult[];
    allPassed: boolean;
}

@Injectable()
export class CodeExecutionService {
    constructor(
        private prisma: PrismaService,
        private pistonClient: PistonClient,
    ) { }

    /**
     * Execute code against all test cases for a problem
     */
    async executeCode(
        problemId: string,
        code: string,
        language: string,
    ): Promise<ExecutionResult> {
        // Validate language
        this.validateLanguage(language);

        // Get problem with all test cases
        const problem = await this.prisma.problem.findUnique({
            where: { id: problemId },
            include: { testCases: true },
        });

        if (!problem) {
            throw new BadRequestException('Problem not found');
        }

        if (!problem.testCases || problem.testCases.length === 0) {
            throw new BadRequestException('No test cases found for this problem');
        }

        // Execute code against each test case
        const results: TestCaseResult[] = [];
        let passedCount = 0;

        for (const testCase of problem.testCases) {
            try {
                const result = await this.pistonClient.executeCode(
                    code,
                    language,
                    testCase.input,
                );

                const actualOutput = this.normalizeOutput(result.stdout);
                const expectedOutput = this.normalizeOutput(testCase.expectedOutput);
                const passed = actualOutput === expectedOutput && result.status.id === 3; // Status 3 = Accepted

                if (passed) {
                    passedCount++;
                }

                results.push({
                    testCaseId: testCase.id,
                    passed,
                    input: testCase.isHidden ? '[Hidden]' : testCase.input,
                    expectedOutput: testCase.isHidden ? '[Hidden]' : testCase.expectedOutput,
                    actualOutput: testCase.isHidden && !passed ? '[Hidden]' : actualOutput,
                    error: result.stderr || result.compile_output || result.message,
                    executionTime: result.time,
                });

                // Stop on first failure for hidden test cases (don't reveal all hidden tests)
                if (!passed && testCase.isHidden) {
                    break;
                }
            } catch (error) {
                results.push({
                    testCaseId: testCase.id,
                    passed: false,
                    input: testCase.isHidden ? '[Hidden]' : testCase.input,
                    expectedOutput: testCase.isHidden ? '[Hidden]' : testCase.expectedOutput,
                    actualOutput: null,
                    error: error.message || 'Execution failed',
                    executionTime: null,
                });

                // Stop on error
                break;
            }
        }

        return {
            passed: passedCount,
            total: problem.testCases.length,
            results,
            allPassed: passedCount === problem.testCases.length,
        };
    }

    /**
     * Validate language is supported by Piston
     */
    private validateLanguage(language: string): void {
        const normalizedLanguage = language.toLowerCase();

        if (!(normalizedLanguage in PISTON_LANGUAGES)) {
            throw new BadRequestException(
                `Unsupported language: ${language}. Supported languages: ${Object.keys(PISTON_LANGUAGES).join(', ')}`,
            );
        }
    }

    /**
     * Normalize output for comparison (trim whitespace, handle line endings)
     */
    private normalizeOutput(output: string | null): string {
        if (!output) return '';

        return output
            .trim()
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\s+$/gm, ''); // Remove trailing whitespace from each line
    }
}
