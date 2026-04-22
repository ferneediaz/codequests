import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CodeExecutionService } from '../../code-execution/code-execution.service';
import { loadAllProblems, loadProblemById } from './problem-loader';
import {
    ProblemYamlV2Schema,
    SUPPORTED_LANGUAGES,
    SupportedAuthoringLanguage,
} from './problem-yaml.schema';
import {
    encodeTestExpected,
    encodeTestInput,
    generateStarterCodeMap,
} from './harness-codegen';

/**
 * A dry-run request in the legacy "write your own harness" format.
 * Still supported so existing tooling keeps working; authors using the
 * new v2 format should prefer `DryRunV2RequestBody`.
 */
interface DryRunV1RequestBody {
    language: string;
    prefix: string;
    body: string;
    suffix: string;
    testCases: Array<{ input: string; expectedOutput: string }>;
}

/**
 * A dry-run request in the new v2 format. The author hands us the same
 * fields they would put in a YAML file (minus the id/title/etc. metadata),
 * we run it through the codegen exactly like the importer would, and
 * execute against the provided tests.
 */
interface DryRunV2RequestBody {
    language: string;
    signature: unknown;
    body: string;
    tests: Array<{ args: unknown[]; expected: unknown }>;
}

type DryRunRequestBody = DryRunV1RequestBody | DryRunV2RequestBody;

function isV2DryRun(body: DryRunRequestBody): body is DryRunV2RequestBody {
    return (
        body !== null &&
        typeof body === 'object' &&
        'signature' in body &&
        'tests' in body
    );
}

/**
 * Endpoints for iterating on YAML problem files locally. Completely gated
 * behind `ENABLE_AUTHOR_TOOLS=true` so nothing ships in production by
 * default. The gate is applied at method entry instead of at module load so
 * flipping the env var at runtime is enough — no restart required.
 *
 * Intentionally NOT under `AuthGuard`: the author preview is a dev-only
 * tool on the same host as the dev server.
 */
@ApiExcludeController()
@Controller('author')
export class AuthoringController {
    constructor(private readonly codeExecution: CodeExecutionService) {}

    private assertEnabled(): void {
        if (process.env.ENABLE_AUTHOR_TOOLS !== 'true') {
            throw new NotFoundException();
        }
    }

    @Get('problems')
    listProblems() {
        this.assertEnabled();
        return loadAllProblems().map(({ filename, problem }) => ({
            filename,
            id: problem.id,
            title: problem.title,
            difficulty: problem.difficulty,
            tags: problem.tags,
            testCount: 'tests' in problem ? problem.tests.length : problem.testCases.length,
            languages:
                'signature' in problem
                    ? Object.keys(problem.starter)
                    : Object.keys(problem.languages),
            format: 'signature' in problem ? 'v2' : 'v1',
        }));
    }

    @Get('problems/:slug')
    getProblem(@Param('slug') slug: string) {
        this.assertEnabled();
        const found = loadProblemById(slug);
        if (!found) {
            throw new NotFoundException(`Problem '${slug}' not found in YAML files`);
        }
        return found.problem;
    }

    @Post('dry-run')
    async dryRun(@Body() body: DryRunRequestBody) {
        this.assertEnabled();

        if (!body || typeof body !== 'object') {
            throw new HttpException('Missing request body', HttpStatus.BAD_REQUEST);
        }
        const lang = (body.language ?? '').toLowerCase();
        if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
            throw new HttpException(
                `Unsupported language '${body.language}'. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        if (isV2DryRun(body)) {
            return this.dryRunV2(body, lang as SupportedAuthoringLanguage);
        }
        return this.dryRunV1(body, lang);
    }

    /**
     * v1 path: author supplies the full `{prefix, body, suffix}` and raw
     * `{input, expectedOutput}` test cases. Hand them straight to the
     * executor.
     */
    private async dryRunV1(body: DryRunV1RequestBody, lang: string) {
        if (!Array.isArray(body.testCases) || body.testCases.length === 0) {
            throw new HttpException(
                'At least one test case is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        return this.codeExecution.executeWithHarness({
            language: lang,
            starter: {
                prefix: body.prefix ?? '',
                body: body.body ?? '',
                suffix: body.suffix ?? '',
            },
            testCases: body.testCases.map((tc) => ({
                input: String(tc?.input ?? ''),
                expectedOutput: String(tc?.expectedOutput ?? ''),
            })),
        });
    }

    /**
     * v2 path: validate the `signature` with the same Zod shape the
     * importer uses, then run codegen + structured test encoding so
     * preview mirrors production behavior exactly.
     */
    private async dryRunV2(
        body: DryRunV2RequestBody,
        lang: SupportedAuthoringLanguage,
    ) {
        if (!Array.isArray(body.tests) || body.tests.length === 0) {
            throw new HttpException(
                'At least one test is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Re-use the full v2 schema to validate the signature + tests shape.
        // We synthesize dummy metadata so the schema accepts the partial doc.
        const doc = {
            id: 'dry-run',
            title: 'Dry Run',
            difficulty: 'EASY' as const,
            tags: [],
            description: 'dry-run',
            signature: body.signature,
            starter: { [lang]: body.body ?? '' },
            tests: body.tests.map((t) => ({
                args: t.args,
                expected: t.expected,
                hidden: false,
            })),
        };
        const parsed = ProblemYamlV2Schema.safeParse(doc);
        if (!parsed.success) {
            const issues = parsed.error.issues
                .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
                .join('; ');
            throw new HttpException(
                `Invalid v2 dry-run payload: ${issues}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const starterMap = generateStarterCodeMap(parsed.data);
        const starter = starterMap[lang];
        if (!starter) {
            throw new HttpException(
                `Codegen did not produce a harness for language '${lang}'.`,
                HttpStatus.BAD_REQUEST,
            );
        }

        return this.codeExecution.executeWithHarness({
            language: lang,
            starter,
            testCases: parsed.data.tests.map((t) => ({
                input: encodeTestInput(t.args),
                expectedOutput: encodeTestExpected(t.expected),
            })),
        });
    }
}
