import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';
import { PracticeService } from './practice.service';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { AttemptResultDto } from './dto/attempt-response.dto';
import { PracticeStatsDto } from './dto/practice-stats.dto';
import { PracticeProblemDetailDto } from './dto/practice-problem.dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('practice')
@Controller('practice')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class PracticeController {
    constructor(private readonly practice: PracticeService) { }

    @Post('attempts')
    @ApiOperation({
        summary: 'Submit a practice attempt for a problem',
        description:
            'Runs the code against all test cases. Attempt is only persisted for PRO/trial users.',
    })
    @ApiResponse({
        status: 201,
        description: 'Execution result plus a `saved` flag',
        type: AttemptResultDto,
    })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    submitAttempt(
        @Req() req: AuthedRequest,
        @Body() dto: SubmitAttemptDto,
    ) {
        return this.practice.submitAttempt(
            req.user.id,
            dto.problemId,
            dto.code,
            dto.language,
        );
    }

    @Get('attempts')
    @ApiOperation({ summary: 'List the current user\'s practice attempts' })
    @ApiQuery({ name: 'problemId', required: false, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'Paginated attempts' })
    getMyAttempts(
        @Req() req: AuthedRequest,
        @Query('problemId') problemId?: string,
        @Query('page', new ParseIntPipe({ optional: true })) page?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.practice.getMyAttempts(req.user.id, {
            problemId,
            page,
            limit,
        });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Practice stats for the current user' })
    @ApiResponse({
        status: 200,
        description: 'Aggregated practice stats',
        type: PracticeStatsDto,
    })
    getMyStats(@Req() req: AuthedRequest) {
        return this.practice.getMyStats(req.user.id);
    }

    /**
     * Practice stats for any user — drives the practice section on the
     * public profile page. Same exposure model as `/users/:id/history`:
     * any authenticated viewer can read another user's solved/attempt
     * counts.
     */
    @Get('stats/:userId')
    @ApiOperation({ summary: 'Practice stats for a specific user' })
    @ApiResponse({
        status: 200,
        description: 'Aggregated practice stats for the given user',
        type: PracticeStatsDto,
    })
    getStatsForUser(@Param('userId') userId: string) {
        return this.practice.getMyStats(userId);
    }

    @Get('problems')
    @ApiOperation({
        summary: 'List all practice problems enriched with user progress',
    })
    @ApiQuery({ name: 'difficulty', required: false, enum: Difficulty })
    @ApiQuery({
        name: 'tags',
        required: false,
        type: String,
        description: 'Comma-separated tag filter',
    })
    @ApiQuery({
        name: 'unsolvedOnly',
        required: false,
        type: Boolean,
        description: 'Return only problems the user has not yet solved',
    })
    @ApiResponse({
        status: 200,
        description: 'Problem list with solved/attempts per problem',
    })
    listProblems(
        @Req() req: AuthedRequest,
        @Query('difficulty') difficulty?: Difficulty,
        @Query('tags') tags?: string,
        @Query('unsolvedOnly') unsolvedOnly?: string,
    ) {
        const parsedTags = tags
            ? tags.split(',').map((t) => t.trim()).filter(Boolean)
            : undefined;
        return this.practice.listProblems(req.user.id, {
            difficulty,
            tags: parsedTags,
            unsolvedOnly: unsolvedOnly === 'true',
        });
    }

    @Get('problems/:problemId')
    @ApiOperation({
        summary: 'Get a problem for the practice solve view',
        description:
            'Practice-scoped problem fetch that includes the reference `solution` and progressive `hints`. These fields are intentionally absent from the generic `/problems/:id` endpoint so they cannot leak during live battles.',
    })
    @ApiResponse({
        status: 200,
        description: 'Problem detail with hints + solution',
        type: PracticeProblemDetailDto,
    })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    getProblem(@Param('problemId') problemId: string) {
        return this.practice.getProblemForPractice(problemId);
    }
}
