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
    /** User's `console.log` / `print` output, captured separately from the
     * grading answer so debug prints never break a submission. */
    stdout: string | null;
    /** Captured stderr from the run (compile errors included). */
    stderr: string | null;
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

/**
 * Sentinel emitted by the v2 generated suffix on the line immediately
 * before the answer. Kept in sync with `ANSWER_MARKER` in
 * `problems/authoring/harness-codegen.ts`. Duplicated here (instead of
 * imported) to avoid pulling authoring code into the runtime module.
 */
const ANSWER_MARKER = '<<<CQ_ANSWER>>>';

interface SplitOutput {
    /** Debug stdout for the Console tab. `null` when there was nothing to show. */
    userStdout: string | null;
    /** The payload to compare against `expectedOutput`. */
    answer: string;
    /** True iff the marker was present (v2 harness). False for legacy v1. */
    hadMarker: boolean;
}

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

                const split = this.splitStdout(result.stdout);
                const passed =
                    result.status.id === 3 &&
                    this.outputsMatch(split.answer, testCase.expectedOutput);

                if (passed) {
                    passedCount++;
                }

                const rawError = result.stderr || result.compile_output || result.message;
                const error = !passed && !rawError && !split.answer
                    ? EMPTY_OUTPUT_HINT
                    : rawError;

                results.push({
                    testCaseId: testCase.id,
                    passed,
                    input: testCase.isHidden ? '[Hidden]' : testCase.input,
                    expectedOutput: testCase.isHidden ? '[Hidden]' : testCase.expectedOutput,
                    actualOutput: testCase.isHidden && !passed ? '[Hidden]' : this.normalizeOutput(split.answer),
                    stdout: split.userStdout,
                    stderr: result.stderr,
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
                    stdout: null,
                    stderr: null,
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

                const split = this.splitStdout(result.stdout);
                const passed =
                    result.status.id === 3 &&
                    this.outputsMatch(split.answer, testCase.expectedOutput);

                if (passed) passedCount++;

                const rawError = result.stderr || result.compile_output || result.message;
                const error = !passed && !rawError && !split.answer
                    ? EMPTY_OUTPUT_HINT
                    : rawError;

                results.push({
                    testCaseId: `adhoc-${i}`,
                    passed,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput: this.normalizeOutput(split.answer),
                    stdout: split.userStdout,
                    stderr: result.stderr,
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
                    stdout: null,
                    stderr: null,
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
     * Split raw Piston stdout into `{userStdout, answer}` on the
     * `<<<CQ_ANSWER>>>` sentinel emitted by the v2 generated suffix.
     *
     * The marker is always on its own line and preceded by a leading
     * newline we emit, so anything the user printed earlier ends up in
     * `userStdout` verbatim (newlines preserved). When the marker is
     * absent — legacy v1 problems, or a program that crashed before the
     * suffix ran — we treat the whole stdout as the answer, preserving
     * the previous v1 behavior.
     */
    private splitStdout(raw: string | null): SplitOutput {
        if (!raw) {
            return { userStdout: null, answer: '', hadMarker: false };
        }
        const markerIdx = raw.indexOf(ANSWER_MARKER);
        if (markerIdx === -1) {
            return { userStdout: null, answer: raw, hadMarker: false };
        }

        // Trim a single trailing \n from the user portion (the suffix emits
        // "\n<<<CQ_ANSWER>>>\n" so the marker is guaranteed to follow a
        // newline we added ourselves — we don't want that in the console).
        let left = raw.slice(0, markerIdx);
        if (left.endsWith('\n')) left = left.slice(0, -1);

        // The answer sits right after the marker + its trailing newline.
        let right = raw.slice(markerIdx + ANSWER_MARKER.length);
        if (right.startsWith('\n')) right = right.slice(1);

        return {
            userStdout: left.length > 0 ? left : null,
            answer: right,
            hadMarker: true,
        };
    }

    /**
     * Decide whether the program's answer matches the expected output.
     *
     * Both strings are first trimmed; if both parse as JSON we compare
     * canonicalized JSON (`JSON.stringify(JSON.parse(x))`), so `"[0, 1]"`
     * matches `"[0,1]"`. Otherwise fall back to trimmed string equality.
     * This avoids the "spaces break grading" class of bugs without
     * misbehaving on v1 problems that print free-form strings.
     */
    private outputsMatch(actual: string, expected: string): boolean {
        const a = this.normalizeOutput(actual);
        const e = this.normalizeOutput(expected);
        if (a === e) return true;

        const aJson = tryParseJson(a);
        const eJson = tryParseJson(e);
        if (aJson.ok && eJson.ok) {
            return canonicalize(aJson.value) === canonicalize(eJson.value);
        }
        return false;
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

/** Best-effort JSON parse. Returns a discriminated result so callers can
 *  tell "parse failed" apart from "parsed to `null`" (which is a valid
 *  answer for some problems). */
function tryParseJson(s: string): { ok: true; value: unknown } | { ok: false } {
    if (!s) return { ok: false };
    try {
        return { ok: true, value: JSON.parse(s) };
    } catch {
        return { ok: false };
    }
}

/**
 * Stable stringify. Sorts object keys so `{"a":1,"b":2}` and `{"b":2,"a":1}`
 * compare equal. Array order is preserved — problem semantics decide
 * whether [1,2] and [2,1] should match (usually they shouldn't, e.g.
 * Two Sum cares about index order).
 */
function canonicalize(value: unknown): string {
    return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
            out[k] = sortKeys((value as Record<string, unknown>)[k]);
        }
        return out;
    }
    return value;
}
