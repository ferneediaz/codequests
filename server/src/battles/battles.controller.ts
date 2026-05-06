import {
    BadRequestException,
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
    Query,
    Req,
    Delete,
} from '@nestjs/common';
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
import { ClanWarsService } from './clan-wars.service';
import {
    CreateBattleDto,
    SubmitSolutionDto,
    BattleResponseDto,
    BattleHistoryResponseDto,
    BattleRoundResponseDto,
    BattleRoyaleStandingsResponseDto,
    RoyalePresetDto,
    CreateClanWarsBattleDto,
    ClanWarsPresetDto,
    ClanWarsStandingsResponseDto,
} from './dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('battles')
@Controller('battles')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class BattlesController {
    constructor(
        private readonly battlesService: BattlesService,
        private readonly battleRoyaleService: BattleRoyaleService,
        private readonly clanWarsService: ClanWarsService,
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

    // ========================================
    // Clan Wars routes (MUST come before :id routes to avoid conflicts)
    // ========================================

    @Get('clan-wars/presets')
    @ApiOperation({ summary: 'List server-provided Clan Wars preset configs' })
    @ApiResponse({
        status: 200,
        description:
            'Returns a list of preset Clan Wars configurations the client can use as-is or mutate before POSTing.',
        type: [ClanWarsPresetDto],
    })
    getClanWarsPresets(): ClanWarsPresetDto[] {
        return this.clanWarsService.getPresets();
    }

    @Post('clan-wars')
    @ApiOperation({
        summary:
            'Create a new Clan Wars battle (multi-round, two-team, cumulative team scoring).',
    })
    @ApiResponse({
        status: 201,
        description: 'Clan Wars battle created successfully',
        type: BattleResponseDto,
    })
    async createClanWars(
        @Req() req: AuthedRequest,
        @Body() dto: CreateClanWarsBattleDto,
    ) {
        return this.clanWarsService.createClanWarsBattle(req.user.id, dto);
    }

    @Post('clan-wars/invite/:code/join')
    @ApiOperation({
        summary:
            'Join a Clan Wars battle via invite code. Use ?team=1|2 to pick a side (defaults to team-2).',
    })
    @ApiParam({ name: 'code', description: 'Invite code (case-insensitive)' })
    @ApiQuery({
        name: 'team',
        required: false,
        description: '"1" for team-1, "2" for team-2. Defaults to team-2.',
    })
    @ApiResponse({ status: 200, description: 'Joined Clan Wars battle', type: BattleResponseDto })
    @ApiResponse({ status: 400, description: 'Cannot join battle' })
    @ApiResponse({ status: 404, description: 'Invalid invite code' })
    async joinClanWarsByInviteCode(
        @Req() req: AuthedRequest,
        @Param('code') code: string,
        @Query('team') teamParam?: string,
        @Body() body?: {
            teamMeta?: { name?: string; tag?: string; clanId?: string };
        },
    ) {
        const battle = await this.battlesService.getByInviteCode(code);
        const team = this.parseTeam(teamParam);
        return this.clanWarsService.joinClanWarsBattle(req.user.id, battle.id, {
            team,
            viaInvite: true,
            teamMeta: body?.teamMeta,
        });
    }

    @Post(':id/clan-wars/join')
    @ApiOperation({
        summary:
            'Join an existing Clan Wars battle by ID. Use ?team=1|2 to pick a side (defaults to team-2).',
    })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiQuery({
        name: 'team',
        required: false,
        description: '"1" for team-1, "2" for team-2. Defaults to team-2.',
    })
    @ApiResponse({ status: 200, description: 'Joined Clan Wars battle', type: BattleResponseDto })
    @ApiResponse({ status: 400, description: 'Cannot join battle' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async joinClanWarsById(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Query('team') teamParam?: string,
        @Body() body?: {
            teamMeta?: { name?: string; tag?: string; clanId?: string };
        },
    ) {
        const team = this.parseTeam(teamParam);
        return this.clanWarsService.joinClanWarsBattle(req.user.id, id, {
            team,
            viaInvite: false,
            teamMeta: body?.teamMeta,
        });
    }

    @Post(':id/clan-wars/submit')
    @ApiOperation({ summary: 'Submit a Clan Wars round solution' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Solution submitted and evaluated',
    })
    @ApiResponse({ status: 400, description: 'Battle not in progress / invalid problem' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async submitClanWars(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() submitDto: SubmitSolutionDto,
    ) {
        return this.clanWarsService.submitClanWarsRound(
            id,
            req.user.id,
            submitDto.code,
            submitDto.language,
            submitDto.problemId,
        );
    }

    @Get(':id/clan-wars/standings')
    @ApiOperation({ summary: 'Get current Clan Wars team standings' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Returns per-team standings with cumulative + current-round points.',
        type: ClanWarsStandingsResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async getClanWarsStandings(@Param('id') id: string) {
        const teams = await this.clanWarsService.getTeamStandings(id);
        const battle = await this.clanWarsService.getClanWarsDetails(id);
        return {
            battleId: id,
            currentRound: battle.currentRound ?? 0,
            isInIntermission: battle.isInIntermission ?? false,
            teams,
        };
    }

    /**
     * Normalize a ?team= query string into a canonical team id.
     * Accepts "1", "2", "team-1", "team-2". Defaults to team-2 (the
     * "opposition" side) so a naked join lands opponents on team-2 by default.
     */
    private parseTeam(teamParam?: string): 'team-1' | 'team-2' {
        if (!teamParam) return 'team-2';
        const normalized = teamParam.toString().trim().toLowerCase();
        if (normalized === '1' || normalized === 'team-1') return 'team-1';
        if (normalized === '2' || normalized === 'team-2') return 'team-2';
        throw new BadRequestException(
            'team must be "1"/"2" or "team-1"/"team-2"',
        );
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
        @Req() req: AuthedRequest,
        @Body() createBattleDto: CreateBattleDto,
    ) {
        return this.battlesService.createBattle(req.user.id, createBattleDto);
    }

    @Get('available')
    @ApiOperation({ summary: 'Get available battles to join' })
    @ApiResponse({
        status: 200,
        description: 'Returns list of available battles',
        type: [BattleResponseDto],
    })
    async getAvailable(@Req() req: AuthedRequest) {
        return this.battlesService.getAvailableBattles(req.user.id);
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
        @Req() req: AuthedRequest,
        @Query('page', new ParseIntPipe({ optional: true })) page?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.battlesService.getBattleHistory(req.user.id, page, limit);
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
        @Req() req: AuthedRequest,
        @Body() createBattleDto: CreateBattleDto,
    ) {
        return this.battlesService.createBattle(req.user.id, {
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
        @Req() req: AuthedRequest,
        @Param('code') code: string,
    ) {
        return this.battlesService.joinByInviteCode(req.user.id, code);
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

    @Post(':id/rematch')
    @ApiOperation({ summary: 'Create a rematch from a completed battle' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({ status: 201, description: 'Rematch created', type: BattleResponseDto })
    @ApiResponse({ status: 400, description: 'Battle cannot be rematched' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async createRematch(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.battlesService.createRematch(req.user.id, id);
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
    async joinBattle(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.battlesService.joinBattle(req.user.id, id);
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
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() submitDto: SubmitSolutionDto,
    ) {
        return this.battlesService.submitSolution(
            id,
            req.user.id,
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
    async readyUp(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.battlesService.readyUp(id, req.user.id);
    }

    @Delete(':id/ready')
    @ApiOperation({ summary: 'Unready yourself' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({ status: 200, description: 'Unready successful' })
    @ApiResponse({ status: 400, description: 'Not currently ready' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    async unready(@Req() req: AuthedRequest, @Param('id') id: string) {
        return this.battlesService.unready(id, req.user.id);
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
        @Param('n', ParseIntPipe) n: number,
        @Req() req: AuthedRequest,
    ) {
        if (n < 1) {
            throw new BadRequestException(
                'Round number must be a positive integer',
            );
        }
        return this.battleRoyaleService.getRoundDetails(id, n, req.user.id);
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
        const battle = await this.battlesService.getBattleDetails(id);
        return {
            battleId: id,
            currentRound: battle.currentRound ?? 0,
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
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body('username') username: string,
    ) {
        return this.battlesService.inviteUserToBattle(id, req.user.id, username);
    }
}
