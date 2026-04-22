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
import { SUPPORTED_LANGUAGES } from './problem-yaml.schema';

interface DryRunRequestBody {
    language: string;
    prefix: string;
    body: string;
    suffix: string;
    testCases: Array<{ input: string; expectedOutput: string }>;
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
            testCount: problem.testCases.length,
            languages: Object.keys(problem.languages),
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
}
