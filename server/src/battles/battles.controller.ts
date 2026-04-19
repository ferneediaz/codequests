import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Query,
    Req,
    Delete,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { BattlesService } from './battles.service';
import { CreateBattleDto, SubmitSolutionDto, BattleResponseDto, BattleHistoryResponseDto } from './dto';

// Extend Express Request to include user
interface AuthRequest extends Request {
    user: {
        sub: string;
        email: string;
        role?: string;
    };
}

@ApiTags('battles')
@Controller('battles')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class BattlesController {
    constructor(private readonly battlesService: BattlesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new battle' })
    @ApiResponse({
        status: 201,
        description: 'Battle created successfully',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    async create(
        @Req() req: AuthRequest,
        @Body() createBattleDto: CreateBattleDto,
    ) {
        return this.battlesService.createBattle(req.user.sub, createBattleDto);
    }

    @Get('available')
    @ApiOperation({ summary: 'Get available battles to join' })
    @ApiResponse({
        status: 200,
        description: 'Returns list of available battles',
        type: [BattleResponseDto],
    })
    async getAvailable(@Req() req: AuthRequest) {
        return this.battlesService.getAvailableBattles(req.user.sub);
    }

    @Get('history')
    @ApiOperation({ summary: "Get user's battle history" })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (default: 1)',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Items per page (default: 20)',
    })
    @ApiResponse({
        status: 200,
        description: "Returns user's battle history",
        type: BattleHistoryResponseDto,
    })
    async getHistory(
        @Req() req: AuthRequest,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.battlesService.getBattleHistory(
            req.user.sub,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    // Invite routes MUST come before :id routes to avoid route conflicts
    @Post('invite')
    @ApiOperation({ summary: 'Create a battle with an invite code' })
    @ApiResponse({
        status: 201,
        description: 'Battle created with invite code',
        type: BattleResponseDto,
    })
    async createWithInvite(
        @Req() req: AuthRequest,
        @Body() createBattleDto: CreateBattleDto,
    ) {
        return this.battlesService.createBattle(req.user.sub, {
            ...createBattleDto,
            withInviteCode: true,
        });
    }

    @Get('invite/:code')
    @ApiOperation({ summary: 'Get battle info from invite code' })
    @ApiParam({ name: 'code', description: 'Invite code (case-insensitive)' })
    @ApiResponse({ status: 200, description: 'Battle details', type: BattleResponseDto })
    @ApiResponse({ status: 404, description: 'Invalid invite code' })
    @ApiResponse({ status: 400, description: 'Invite code expired or battle started' })
    async getByInviteCode(@Param('code') code: string) {
        return this.battlesService.getByInviteCode(code);
    }

    @Post('invite/:code/join')
    @ApiOperation({ summary: 'Join a battle via invite code' })
    @ApiParam({ name: 'code', description: 'Invite code (case-insensitive)' })
    @ApiResponse({ status: 200, description: 'Successfully joined battle', type: BattleResponseDto })
    @ApiResponse({ status: 400, description: 'Cannot join battle' })
    @ApiResponse({ status: 404, description: 'Invalid invite code' })
    async joinByInviteCode(
        @Req() req: AuthRequest,
        @Param('code') code: string,
    ) {
        return this.battlesService.joinByInviteCode(req.user.sub, code);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get battle details' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Returns battle details',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async getBattle(@Param('id') id: string) {
        return this.battlesService.getBattleDetails(id);
    }

    @Post(':id/join')
    @ApiOperation({ summary: 'Join an existing battle' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Successfully joined battle',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Cannot join battle' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async joinBattle(@Req() req: AuthRequest, @Param('id') id: string) {
        return this.battlesService.joinBattle(req.user.sub, id);
    }

    @Post(':id/submit')
    @ApiOperation({ summary: 'Submit a solution for the battle' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Solution submitted and evaluated',
    })
    @ApiResponse({ status: 400, description: 'Battle not in progress' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async submitSolution(
        @Req() req: AuthRequest,
        @Param('id') id: string,
        @Body() submitDto: SubmitSolutionDto,
    ) {
        return this.battlesService.submitSolution(
            id,
            req.user.sub,
            submitDto.code,
            submitDto.language,
            submitDto.problemId,
        );
    }

    @Post(':id/complete')
    @ApiOperation({ summary: 'Force complete a battle (for timeouts)' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Battle completed',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Battle already completed' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async completeBattle(@Param('id') id: string) {
        return this.battlesService.completeBattle(id);
    }

    @Post(':id/ready')
    @ApiOperation({ summary: 'Mark yourself as ready. Battle starts when all players are ready.' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({ status: 200, description: 'Ready status updated' })
    @ApiResponse({ status: 400, description: 'Cannot ready up' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    async readyUp(@Req() req: AuthRequest, @Param('id') id: string) {
        return this.battlesService.readyUp(id, req.user.sub);
    }

    @Delete(':id/ready')
    @ApiOperation({ summary: 'Unready yourself' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({ status: 200, description: 'Unready successful' })
    @ApiResponse({ status: 400, description: 'Not currently ready' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    async unready(@Req() req: AuthRequest, @Param('id') id: string) {
        return this.battlesService.unready(id, req.user.sub);
    }

    @Post(':id/invite-user')
    @ApiOperation({ summary: 'Send an in-app invite to a user by username' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({ status: 200, description: 'Invite sent' })
    @ApiResponse({ status: 404, description: 'Battle or user not found' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    async inviteUser(
        @Req() req: AuthRequest,
        @Param('id') id: string,
        @Body('username') username: string,
    ) {
        return this.battlesService.inviteUserToBattle(id, req.user.sub, username);
    }
}
