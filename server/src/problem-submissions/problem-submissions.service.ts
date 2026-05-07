import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import {
    encodeTestExpected,
    encodeTestInput,
    generateStarterCodeMap,
    generateStubBody,
} from '../problems/authoring/harness-codegen';
import {
    ProblemYamlV2,
    ProblemYamlV2Schema,
    SUPPORTED_LANGUAGES,
    SupportedAuthoringLanguage,
} from '../problems/authoring/problem-yaml.schema';
import {
    SUBMISSION_EVENTS_PORT,
    SubmissionEventsPort,
} from '../realtime/ports/submission-events.port';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import {
    ApproveSubmissionDto,
    RejectSubmissionDto,
    RequestChangesDto,
} from './dto/review-action.dto';

const SUBMITTER_SELECT = {
    id: true,
    username: true,
    avatarUrl: true,
} as const;

@Injectable()
export class ProblemSubmissionsService {
    private readonly logger = new Logger(ProblemSubmissionsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly codeExecution: CodeExecutionService,
        @Inject(SUBMISSION_EVENTS_PORT)
        private readonly events: SubmissionEventsPort,
    ) {}

    // -------------------------------------------------------------------------
    // Contributor flows
    // -------------------------------------------------------------------------

    async create(userId: string, dto: CreateSubmissionDto) {
        const validated = this.validateAndShape(dto);
        await this.assertReferenceSolutionPasses(validated, dto.referenceCode);

        const submission = await this.prisma.problemSubmission.create({
            data: {
                submittedById: userId,
                title: validated.title,
                description: validated.description,
                difficulty: validated.difficulty,
                tags: validated.tags ?? [],
                starterCode: validated.starter as unknown as Prisma.InputJsonValue,
                signature: validated.signature as unknown as Prisma.InputJsonValue,
                tests: validated.tests as unknown as Prisma.InputJsonValue,
                hints: validated.hints,
                solution: validated.solution,
                referenceCode: dto.referenceCode as unknown as Prisma.InputJsonValue,
                status: SubmissionStatus.PENDING,
            },
            include: { submittedBy: { select: SUBMITTER_SELECT } },
        });

        await this.fanOutNewSubmissionToAdmins(submission);
        return submission;
    }

    listMine(userId: string) {
        return this.prisma.problemSubmission.findMany({
            where: { submittedById: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                reviewer: { select: SUBMITTER_SELECT },
                linkedProblem: { select: { id: true, title: true } },
            },
        });
    }

    async getById(userId: string, isAdmin: boolean, id: string) {
        const submission = await this.prisma.problemSubmission.findUnique({
            where: { id },
            include: {
                submittedBy: { select: SUBMITTER_SELECT },
                reviewer: { select: SUBMITTER_SELECT },
                linkedProblem: { select: { id: true, title: true } },
            },
        });
        if (!submission) throw new NotFoundException('Submission not found');
        if (!isAdmin && submission.submittedById !== userId) {
            throw new ForbiddenException();
        }
        return submission;
    }

    async updateOwn(userId: string, id: string, dto: CreateSubmissionDto) {
        const submission = await this.prisma.problemSubmission.findUnique({
            where: { id },
        });
        if (!submission) throw new NotFoundException('Submission not found');
        if (submission.submittedById !== userId) throw new ForbiddenException();
        if (submission.status !== SubmissionStatus.NEEDS_CHANGES) {
            throw new BadRequestException(
                'Only submissions in NEEDS_CHANGES can be edited',
            );
        }

        const validated = this.validateAndShape(dto);
        await this.assertReferenceSolutionPasses(validated, dto.referenceCode);

        return this.prisma.problemSubmission.update({
            where: { id },
            data: {
                title: validated.title,
                description: validated.description,
                difficulty: validated.difficulty,
                tags: validated.tags ?? [],
                starterCode: validated.starter as unknown as Prisma.InputJsonValue,
                signature: validated.signature as unknown as Prisma.InputJsonValue,
                tests: validated.tests as unknown as Prisma.InputJsonValue,
                hints: validated.hints,
                solution: validated.solution,
                referenceCode: dto.referenceCode as unknown as Prisma.InputJsonValue,
                status: SubmissionStatus.PENDING,
                reviewNotes: null,
                reviewedAt: null,
                reviewerId: null,
            },
        });
    }

    // -------------------------------------------------------------------------
    // Admin flows
    // -------------------------------------------------------------------------

    listForReview(opts: {
        status?: SubmissionStatus;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const page = Math.max(1, opts.page ?? 1);
        const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
        const where: Prisma.ProblemSubmissionWhereInput = {};
        if (opts.status) where.status = opts.status;
        if (opts.search) {
            where.OR = [
                { title: { contains: opts.search, mode: 'insensitive' } },
                { submittedBy: { username: { contains: opts.search, mode: 'insensitive' } } },
            ];
        }
        return Promise.all([
            this.prisma.problemSubmission.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    submittedBy: { select: SUBMITTER_SELECT },
                    reviewer: { select: SUBMITTER_SELECT },
                    linkedProblem: { select: { id: true, title: true } },
                },
            }),
            this.prisma.problemSubmission.count({ where }),
        ]).then(([items, total]) => ({ items, total, page, limit }));
    }

    /**
     * Run the contributor's reference solution against ALL tests (including
     * hidden), per language. Used by the admin sandbox to confirm the problem
     * is solvable before approving.
     */
    async dryRunForReview(submissionId: string, language: string) {
        const submission = await this.prisma.problemSubmission.findUnique({
            where: { id: submissionId },
        });
        if (!submission) throw new NotFoundException('Submission not found');

        const lang = (language ?? '').toLowerCase();
        if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
            throw new BadRequestException(
                `Unsupported language '${language}'. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
            );
        }

        const referenceCode =
            (submission.referenceCode as Record<string, string>)?.[lang];
        if (!referenceCode) {
            throw new BadRequestException(
                `No reference code submitted for language '${lang}'.`,
            );
        }

        const validated = this.validatePersistedSubmission(submission);
        const starterMap = generateStarterCodeMap({
            ...validated,
            // Run with the contributor's working solution as the body so the
            // admin sandbox executes the actual reference, not the stub.
            starter: { ...validated.starter, [lang]: referenceCode },
        });
        const starter = starterMap[lang as SupportedAuthoringLanguage];
        if (!starter) {
            throw new BadRequestException(
                `Codegen did not produce a harness for language '${lang}'.`,
            );
        }

        return this.codeExecution.executeWithHarness({
            language: lang,
            starter,
            testCases: validated.tests.map((t) => ({
                input: encodeTestInput(t.args),
                expectedOutput: encodeTestExpected(t.expected),
            })),
        });
    }

    async approve(reviewerId: string, id: string, dto: ApproveSubmissionDto) {
        const existing = await this.prisma.problemSubmission.findUnique({
            where: { id },
        });
        if (!existing) throw new NotFoundException('Submission not found');
        if (existing.status === SubmissionStatus.APPROVED) {
            throw new BadRequestException('Submission already approved');
        }

        // If the admin tweaked anything inline, rerun validation against the
        // edited payload + contributor's reference code so we never publish
        // a problem whose tests don't agree with the signature.
        const merged: CreateSubmissionDto = dto.edits
            ? { ...dto.edits, referenceCode: existing.referenceCode as Record<string, string> }
            : this.persistedToCreateDto(existing);

        const validated = this.validateAndShape(merged);
        await this.assertReferenceSolutionPasses(validated, merged.referenceCode);

        // Auto-generate stub bodies (so users see "Your code here", not the
        // contributor's solution) and wrap them via the existing codegen.
        const stubProblem: ProblemYamlV2 = {
            ...validated,
            starter: this.buildStubStarter(validated),
        };
        const harnessMap = generateStarterCodeMap(stubProblem);
        const starterCodeJson = JSON.stringify(harnessMap);

        const reviewer = await this.prisma.user.findUnique({
            where: { id: reviewerId },
            select: { id: true, username: true },
        });
        if (!reviewer) throw new ForbiddenException();

        const result = await this.prisma.$transaction(async (tx) => {
            const problem = await tx.problem.create({
                data: {
                    title: validated.title,
                    description: validated.description,
                    difficulty: validated.difficulty,
                    tags: validated.tags ?? [],
                    starterCode: starterCodeJson,
                    hints: validated.hints,
                    solution: validated.solution,
                    contributedById: existing.submittedById,
                    testCases: {
                        create: validated.tests.map((t) => ({
                            input: encodeTestInput(t.args),
                            expectedOutput: encodeTestExpected(t.expected),
                            isHidden: t.hidden ?? false,
                        })),
                    },
                },
            });
            const updated = await tx.problemSubmission.update({
                where: { id },
                data: {
                    title: validated.title,
                    description: validated.description,
                    difficulty: validated.difficulty,
                    tags: validated.tags ?? [],
                    starterCode: validated.starter as unknown as Prisma.InputJsonValue,
                    signature: validated.signature as unknown as Prisma.InputJsonValue,
                    tests: validated.tests as unknown as Prisma.InputJsonValue,
                    hints: validated.hints,
                    solution: validated.solution,
                    status: SubmissionStatus.APPROVED,
                    reviewerId,
                    reviewedAt: new Date(),
                    reviewNotes: dto.notes ?? null,
                    linkedProblemId: problem.id,
                },
                include: {
                    submittedBy: { select: SUBMITTER_SELECT },
                    linkedProblem: { select: { id: true, title: true } },
                },
            });
            return { problem, submission: updated };
        });

        try {
            this.events.emitSubmissionApproved(existing.submittedById, {
                submissionId: id,
                title: validated.title,
                reviewerUsername: reviewer.username,
                reviewNotes: dto.notes ?? null,
                linkedProblemId: result.problem.id,
                decidedAt: result.submission.reviewedAt ?? new Date(),
            });
        } catch (err) {
            this.logger.error(`approve emit failed: ${(err as Error).message}`);
        }

        return result;
    }

    async reject(reviewerId: string, id: string, dto: RejectSubmissionDto) {
        const reviewer = await this.requireReviewer(reviewerId);
        const submission = await this.prisma.problemSubmission.findUnique({
            where: { id },
        });
        if (!submission) throw new NotFoundException('Submission not found');
        if (submission.status === SubmissionStatus.APPROVED) {
            throw new BadRequestException('Cannot reject an approved submission');
        }
        const updated = await this.prisma.problemSubmission.update({
            where: { id },
            data: {
                status: SubmissionStatus.REJECTED,
                reviewerId,
                reviewedAt: new Date(),
                reviewNotes: dto.notes,
            },
        });
        try {
            this.events.emitSubmissionRejected(submission.submittedById, {
                submissionId: id,
                title: submission.title,
                reviewerUsername: reviewer.username,
                reviewNotes: dto.notes,
                decidedAt: updated.reviewedAt ?? new Date(),
            });
        } catch (err) {
            this.logger.error(`reject emit failed: ${(err as Error).message}`);
        }
        return updated;
    }

    async requestChanges(reviewerId: string, id: string, dto: RequestChangesDto) {
        const reviewer = await this.requireReviewer(reviewerId);
        const submission = await this.prisma.problemSubmission.findUnique({
            where: { id },
        });
        if (!submission) throw new NotFoundException('Submission not found');
        if (submission.status === SubmissionStatus.APPROVED) {
            throw new BadRequestException(
                'Cannot request changes on an approved submission',
            );
        }
        const updated = await this.prisma.problemSubmission.update({
            where: { id },
            data: {
                status: SubmissionStatus.NEEDS_CHANGES,
                reviewerId,
                reviewedAt: new Date(),
                reviewNotes: dto.notes,
            },
        });
        try {
            this.events.emitSubmissionChangesRequested(submission.submittedById, {
                submissionId: id,
                title: submission.title,
                reviewerUsername: reviewer.username,
                reviewNotes: dto.notes,
                decidedAt: updated.reviewedAt ?? new Date(),
            });
        } catch (err) {
            this.logger.error(`requestChanges emit failed: ${(err as Error).message}`);
        }
        return updated;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private validateAndShape(dto: CreateSubmissionDto): ProblemYamlV2 {
        // Build a synthetic v2 doc so we can lean on the existing zod schema
        // for signature/tests/hints validation. The contributor's "starter"
        // (what the form sends) is treated as the body the v2 schema expects;
        // it'll be replaced with stubs at publish time.
        const enabledLangs = Object.keys(dto.referenceCode).filter(
            (l): l is SupportedAuthoringLanguage =>
                (SUPPORTED_LANGUAGES as readonly string[]).includes(l),
        );
        if (enabledLangs.length === 0) {
            throw new BadRequestException(
                `Reference code is required for at least one supported language: ${SUPPORTED_LANGUAGES.join(', ')}`,
            );
        }
        const starter: Record<string, string> = {};
        for (const lang of enabledLangs) starter[lang] = dto.referenceCode[lang];

        const doc = {
            id: 'pending-submission',
            title: dto.title,
            difficulty: dto.difficulty,
            tags: dto.tags ?? [],
            description: dto.description,
            signature: dto.signature,
            starter,
            tests: dto.tests.map((t) => ({
                args: t.args,
                expected: t.expected,
                hidden: t.hidden ?? false,
            })),
            hints: dto.hints,
            solution: dto.solution,
        };
        const parsed = ProblemYamlV2Schema.safeParse(doc);
        if (!parsed.success) {
            const issues = parsed.error.issues
                .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
                .join('; ');
            throw new BadRequestException(`Invalid submission: ${issues}`);
        }
        return parsed.data;
    }

    /** Re-validate a row read back from the DB (signature/tests are stored
     *  as JSON; we want zod's narrowing on every read path). */
    private validatePersistedSubmission(submission: {
        title: string;
        description: string;
        difficulty: 'EASY' | 'MEDIUM' | 'HARD';
        tags: string[];
        starterCode: Prisma.JsonValue;
        signature: Prisma.JsonValue;
        tests: Prisma.JsonValue;
        hints: string[];
        solution: string;
    }): ProblemYamlV2 {
        const doc = {
            id: 'persisted-submission',
            title: submission.title,
            difficulty: submission.difficulty,
            tags: submission.tags,
            description: submission.description,
            signature: submission.signature,
            starter: submission.starterCode,
            tests: submission.tests,
            hints: submission.hints,
            solution: submission.solution,
        };
        const parsed = ProblemYamlV2Schema.safeParse(doc);
        if (!parsed.success) {
            const issues = parsed.error.issues
                .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
                .join('; ');
            throw new BadRequestException(
                `Stored submission failed re-validation: ${issues}`,
            );
        }
        return parsed.data;
    }

    private persistedToCreateDto(submission: {
        title: string;
        description: string;
        difficulty: 'EASY' | 'MEDIUM' | 'HARD';
        tags: string[];
        signature: Prisma.JsonValue;
        tests: Prisma.JsonValue;
        hints: string[];
        solution: string;
        referenceCode: Prisma.JsonValue;
    }): CreateSubmissionDto {
        return {
            title: submission.title,
            description: submission.description,
            difficulty: submission.difficulty,
            tags: submission.tags,
            signature: submission.signature as Record<string, unknown>,
            referenceCode: submission.referenceCode as Record<string, string>,
            tests: submission.tests as CreateSubmissionDto['tests'],
            hints: submission.hints,
            solution: submission.solution,
        };
    }

    private buildStubStarter(validated: ProblemYamlV2): ProblemYamlV2['starter'] {
        const stubs: ProblemYamlV2['starter'] = {};
        const langs = Object.keys(validated.starter) as SupportedAuthoringLanguage[];
        for (const lang of langs) {
            stubs[lang] = generateStubBody(validated.signature, lang);
        }
        return stubs;
    }

    private async assertReferenceSolutionPasses(
        validated: ProblemYamlV2,
        referenceCode: Record<string, string>,
    ): Promise<void> {
        const langs = Object.keys(validated.starter) as SupportedAuthoringLanguage[];
        for (const lang of langs) {
            const code = referenceCode[lang];
            if (!code || !code.trim()) {
                throw new BadRequestException(
                    `Reference code is required for language '${lang}'.`,
                );
            }
            const harnessMap = generateStarterCodeMap({
                ...validated,
                starter: { ...validated.starter, [lang]: code },
            });
            const starter = harnessMap[lang];
            if (!starter) {
                throw new BadRequestException(
                    `Could not generate harness for language '${lang}'.`,
                );
            }
            const result = await this.codeExecution.executeWithHarness({
                language: lang,
                starter,
                testCases: validated.tests.map((t) => ({
                    input: encodeTestInput(t.args),
                    expectedOutput: encodeTestExpected(t.expected),
                })),
            });
            if (!result.allPassed) {
                const failed = result.results.find((r) => !r.passed);
                const detail = failed?.error
                    ? failed.error
                    : failed
                      ? `expected ${failed.expectedOutput}, got ${failed.actualOutput ?? '<no output>'}`
                      : 'unknown failure';
                throw new BadRequestException(
                    `Your reference solution for ${lang} failed ${result.total - result.passed} of ${result.total} tests. First failure: ${detail}`,
                );
            }
        }
    }

    private async fanOutNewSubmissionToAdmins(submission: {
        id: string;
        title: string;
        createdAt: Date;
        submittedBy: { username: string; avatarUrl: string | null };
    }): Promise<void> {
        try {
            const admins = await this.prisma.user.findMany({
                where: { role: 'admin' },
                select: { id: true },
            });
            this.events.emitNewSubmissionForReview(
                admins.map((a) => a.id),
                {
                    submissionId: submission.id,
                    title: submission.title,
                    submitterUsername: submission.submittedBy.username,
                    submitterAvatarUrl: submission.submittedBy.avatarUrl,
                    createdAt: submission.createdAt,
                },
            );
        } catch (err) {
            this.logger.error(
                `fanOutNewSubmissionToAdmins failed: ${(err as Error).message}`,
            );
        }
    }

    private async requireReviewer(reviewerId: string) {
        const reviewer = await this.prisma.user.findUnique({
            where: { id: reviewerId },
            select: { id: true, username: true },
        });
        if (!reviewer) throw new ForbiddenException();
        return reviewer;
    }
}
