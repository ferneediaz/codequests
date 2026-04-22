import {
    BadRequestException,
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
import { BattleRoyaleService } from './battle-royale.service';
import {
    CreateBattleDto,
    SubmitSolutionDto,
    BattleResponseDto,
    BattleHistoryResponseDto,
    BattleRoundResponseDto,
    BattleRoyaleStandingsResponseDto,
    RoyalePresetDto,
} from './dto';

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
    constructor(
        private readonly battlesService: BattlesService,
        private readonly battleRoyaleService: BattleRoyaleService,
    ) { }

    // ========================================
    // Battle Royale routes (MUST come before :id routes to avoid conflicts)
    // ========================================

    @Get('royale/presets')
    @ApiOperation({ summary: 'List server-provided Battle Royale preset configs' })
    @ApiResponse({
        status: 200,
        description: 'Returns a list of preset BR configurations the client can use as-is or mutate before POSTing.',
        type: [RoyalePresetDto],
    })
    getRoyalePresets(): RoyalePresetDto[] {
        return this.battleRoyaleService.getPresets();
    }

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

    @Get(':id/rounds')
    @ApiOperation({ summary: 'List all Battle Royale rounds for a battle (config + runtime state)' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Returns all rounds in ascending order.',
        type: [BattleRoundResponseDto],
    })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async listRounds(@Param('id') id: string) {
        return this.battleRoyaleService.listRounds(id);
    }

    @Get(':id/rounds/:n')
    @ApiOperation({ summary: 'Get details for a single Battle Royale round' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiParam({ name: 'n', description: 'Round number (1-indexed)' })
    @ApiResponse({
        status: 200,
        description: 'Returns round details including submissions. Only battle participants may access this endpoint.',
        type: BattleRoundResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Requesting user is not a participant of the battle' })
    @ApiResponse({ status: 404, description: 'Battle or round not found' })
    async getRoundDetails(
        @Param('id') id: string,
        @Param('n') n: string,
        @Req() req: AuthRequest,
    ) {
        const roundNumber = parseInt(n, 10);
        if (!Number.isInteger(roundNumber) || roundNumber < 1) {
            throw new BadRequestException(
                'Round number must be a positive integer',
            );
        }
        return this.battleRoyaleService.getRoundDetails(
            id,
            roundNumber,
            req.user.sub,
        );
    }

    @Get(':id/standings')
    @ApiOperation({ summary: 'Get current Battle Royale standings' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Returns ordered standings with placements and cumulative points.',
        type: BattleRoyaleStandingsResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async getStandings(@Param('id') id: string) {
        const standings = await this.battleRoyaleService.getStandings(id);
        // Pull currentRound for convenience on the client.
        const battle = await this.battlesService.getBattleDetails(id);
        return {
            battleId: id,
            currentRound: (battle as any).currentRound ?? 0,
            standings,
        };
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
