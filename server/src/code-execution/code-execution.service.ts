import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PistonClient, PISTON_LANGUAGES } from './piston.client';
import {
    LanguageStarter,
    parseStarterCode,
    stitchSource,
} from './starter-code';

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

const EMPTY_OUTPUT_HINT =
    'Your program ran but produced no output. Make sure your function returns a value that the harness can print.';

@Injectable()
export class CodeExecutionService {
    constructor(
        private prisma: PrismaService,
        private pistonClient: PistonClient,
    ) { }

    /**
     * Execute code against all test cases for a problem.
     *
     * `code` is the user's function body. The server stitches it into the
     * problem's stored harness (`prefix + body + suffix`) before handing the
     * full program to Piston. Users never see or edit the harness.
     */
    async executeCode(
        problemId: string,
        code: string,
        language: string,
    ): Promise<ExecutionResult> {
        this.validateLanguage(language);

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

        const starter = this.resolveStarter(problem.starterCode, language);
        const fullSource = stitchSource(starter, code);

        const results: TestCaseResult[] = [];
        let passedCount = 0;

        for (const testCase of problem.testCases) {
            try {
                const result = await this.pistonClient.executeCode(
                    fullSource,
                    language,
                    testCase.input,
                );

                const actualOutput = this.normalizeOutput(result.stdout);
                const expectedOutput = this.normalizeOutput(testCase.expectedOutput);
                const passed = actualOutput === expectedOutput && result.status.id === 3; // Status 3 = Accepted

                if (passed) {
                    passedCount++;
                }

                const rawError = result.stderr || result.compile_output || result.message;
                const error = !passed && !rawError && !actualOutput
                    ? EMPTY_OUTPUT_HINT
                    : rawError;

                results.push({
                    testCaseId: testCase.id,
                    passed,
                    input: testCase.isHidden ? '[Hidden]' : testCase.input,
                    expectedOutput: testCase.isHidden ? '[Hidden]' : testCase.expectedOutput,
                    actualOutput: testCase.isHidden && !passed ? '[Hidden]' : actualOutput,
                    error,
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
     * Execute an arbitrary `{prefix, body, suffix}` harness against a list of
     * ad-hoc test cases without touching the DB. Used by the authoring
     * dry-run endpoint so problem authors can iterate on new YAML files
     * before they have been imported.
     */
    async executeWithHarness(params: {
        language: string;
        starter: LanguageStarter;
        testCases: Array<{ input: string; expectedOutput: string }>;
    }): Promise<ExecutionResult> {
        this.validateLanguage(params.language);
        if (params.testCases.length === 0) {
            throw new BadRequestException('No test cases provided');
        }

        const fullSource = stitchSource(params.starter, params.starter.body);
        const results: TestCaseResult[] = [];
        let passedCount = 0;

        for (let i = 0; i < params.testCases.length; i++) {
            const testCase = params.testCases[i];
            try {
                const result = await this.pistonClient.executeCode(
                    fullSource,
                    params.language,
                    testCase.input,
                );

                const actualOutput = this.normalizeOutput(result.stdout);
                const expectedOutput = this.normalizeOutput(testCase.expectedOutput);
                const passed = actualOutput === expectedOutput && result.status.id === 3;

                if (passed) passedCount++;

                const rawError = result.stderr || result.compile_output || result.message;
                const error = !passed && !rawError && !actualOutput
                    ? EMPTY_OUTPUT_HINT
                    : rawError;

                results.push({
                    testCaseId: `adhoc-${i}`,
                    passed,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput,
                    error,
                    executionTime: result.time,
                });
            } catch (error) {
                results.push({
                    testCaseId: `adhoc-${i}`,
                    passed: false,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput: null,
                    error: (error as Error).message || 'Execution failed',
                    executionTime: null,
                });
                break;
            }
        }

        return {
            passed: passedCount,
            total: params.testCases.length,
            results,
            allPassed: passedCount === params.testCases.length,
        };
    }

    /**
     * Resolve the per-language harness from the problem's JSON-encoded
     * `starterCode`. Throws when the language entry is missing rather than
     * silently running the user's body with no IO wrapper (which would
     * produce the empty-output confusion this whole change solves).
     */
    private resolveStarter(raw: string, language: string): LanguageStarter {
        const map = parseStarterCode(raw);
        const entry = map[language.toLowerCase()];
        if (!entry) {
            throw new BadRequestException(
                `This problem has no starter harness for language '${language}'.`,
            );
        }
        return entry;
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
