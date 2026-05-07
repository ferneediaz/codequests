import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
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
import { SubmissionStatus } from '@prisma/client';
import { ProblemSubmissionsService } from './problem-submissions.service';
import { CreateSubmissionDto, UpdateSubmissionDto } from './dto/create-submission.dto';
import {
    ApproveSubmissionDto,
    RejectSubmissionDto,
    RequestChangesDto,
} from './dto/review-action.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('problem-submissions')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class ProblemSubmissionsController {
    constructor(private readonly service: ProblemSubmissionsService) {}

    // -------------------------------------------------------------------------
    // Contributor
    // -------------------------------------------------------------------------

    @Post('problem-submissions')
    @ApiOperation({
        summary:
            'Submit a new problem for admin review. Server validates the reference solution against all tests before persisting.',
    })
    @ApiResponse({ status: 201, description: 'Submission created' })
    @ApiResponse({ status: 400, description: 'Reference solution failed tests or invalid payload' })
    create(@Req() req: AuthedRequest, @Body() dto: CreateSubmissionDto) {
        return this.service.create(req.user.id, dto);
    }

    @Get('problem-submissions/mine')
    @ApiOperation({ summary: "List the current user's submissions." })
    listMine(@Req() req: AuthedRequest) {
        return this.service.listMine(req.user.id);
    }

    @Get('problem-submissions/:id')
    @ApiOperation({ summary: 'Get a submission (owner or admin only).' })
    getOne(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.service.getById(req.user.id, req.user.role === 'admin', id);
    }

    @Patch('problem-submissions/:id')
    @ApiOperation({
        summary:
            'Re-submit changes to a NEEDS_CHANGES submission. Reruns the reference-solution gate.',
    })
    updateOwn(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() dto: UpdateSubmissionDto,
    ) {
        return this.service.updateOwn(req.user.id, id, dto);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    @Get('admin/problem-submissions')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({ summary: 'List submissions with optional status/search filters (admin only).' })
    @ApiQuery({ name: 'status', required: false, enum: SubmissionStatus })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    listForReview(
        @Query('status') status?: SubmissionStatus,
        @Query('search') search?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.service.listForReview({
            status,
            search,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    @Post('admin/problem-submissions/:id/dry-run')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({
        summary:
            "Run the contributor's reference solution against ALL tests (admin sandbox).",
    })
    dryRun(
        @Param('id') id: string,
        @Body() body: { language: string },
    ) {
        return this.service.dryRunForReview(id, body.language);
    }

    @Post('admin/problem-submissions/:id/approve')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({
        summary:
            'Approve a submission. Creates a new published Problem (with auto-generated stub starter). Optional `edits` apply inline tweaks.',
    })
    approve(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() dto: ApproveSubmissionDto,
    ) {
        return this.service.approve(req.user.id, id, dto);
    }

    @Post('admin/problem-submissions/:id/reject')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({ summary: 'Reject a submission with required reviewer notes.' })
    reject(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() dto: RejectSubmissionDto,
    ) {
        return this.service.reject(req.user.id, id, dto);
    }

    @Post('admin/problem-submissions/:id/request-changes')
    @UseGuards(RolesGuard)
    @Roles('admin')
    @ApiOperation({
        summary:
            'Request changes from the contributor. They can edit + resubmit, which puts the submission back into PENDING.',
    })
    requestChanges(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() dto: RequestChangesDto,
    ) {
        return this.service.requestChanges(req.user.id, id, dto);
    }
}
