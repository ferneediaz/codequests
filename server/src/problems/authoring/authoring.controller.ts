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
 * Dry-run request: same conceptual fields as a v2 YAML (minus id/title/etc.).
 * The server runs harness codegen, then executes against the given tests.
 */
interface DryRunRequestBody {
    language: string;
    signature: unknown;
    body: string;
    tests: Array<{ args: unknown[]; expected: unknown }>;
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
            testCount: problem.tests.length,
            languages: Object.keys(problem.starter),
        }));
    }

    @Get('problems/:slug')
    getProblem(@Param('slug') slug: string) {
        this.assertEnabled();
        const found = loadProblemById(slug);
        if (!found) {
            throw new NotFoundException(`Problem '${slug}' not found in YAML files`);
        }
        return {
            ...found.problem,
            harness: generateStarterCodeMap(found.problem),
        };
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

        if (!Array.isArray(body.tests) || body.tests.length === 0) {
            throw new HttpException(
                'At least one test is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Re-use the full v2 schema to validate the signature + tests shape.
        // Synthesize dummy metadata so the schema accepts the partial doc.
        const doc = {
            id: 'dry-run',
            title: 'Dry Run',
            difficulty: 'EASY' as const,
            tags: [] as string[],
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
                `Invalid dry-run payload: ${issues}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const starterMap = generateStarterCodeMap(parsed.data);
        const starter = starterMap[lang as SupportedAuthoringLanguage];
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
