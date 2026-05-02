import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { ClansService } from './clans.service';
import { ClanChallengeService } from './clan-challenges.service';
import { BattlesGateway } from '../websockets/battles.gateway';
import {
    CreateClanDto,
    UpdateClanDto,
    ClanResponseDto,
    SendChallengeDto,
    CounterChallengeDto,
    ChallengeResponseDto,
} from './dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('clans')
@Controller('clans')
export class ClansController {
    constructor(
        private readonly clansService: ClansService,
        private readonly clanChallengeService: ClanChallengeService,
        private readonly battlesGateway: BattlesGateway,
    ) { }

    /**
     * Get all clans (sorted by MMR)
     */
    @Get()
    @ApiOperation({ summary: 'Get all clans' })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
    @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
    @ApiResponse({ status: 200, description: 'List of clans', type: [ClanResponseDto] })
    findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
        return this.clansService.findAll({
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    // ============================================
    // CLAN CHALLENGE ENDPOINTS (static routes before :id)
    // ============================================

    /**
     * Send a clan challenge
     */
    @Post('challenges')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Send a clan challenge' })
    @ApiResponse({ status: 201, description: 'Challenge sent', type: ChallengeResponseDto })
    @ApiResponse({ status: 400, description: 'Not in a clan or challenging own clan' })
    @ApiResponse({ status: 403, description: 'Not the clan owner' })
    @ApiResponse({ status: 404, description: 'Target clan not found' })
    @ApiResponse({ status: 409, description: 'Active challenge already exists' })
    async sendChallenge(
        @Body() dto: SendChallengeDto,
        @Req() req: AuthedRequest,
    ) {
        const challenge = await this.clanChallengeService.sendChallenge(req.user.id, dto);

        // Notify all online members of the challenged clan
        const memberIds = await this.clanChallengeService.getClanMemberIds(
            challenge.challengedClanId,
        );
        this.battlesGateway.emitToClanMembers(memberIds, 'clan.challenge_received', {
            challengeId: challenge.id,
            challengerClan: challenge.challengerClan,
            challengedClan: challenge.challengedClan,
            message: challenge.message,
            teamSize: challenge.teamSize,
            timeLimitMinutes: challenge.timeLimitMinutes,
            enabledSkills: challenge.enabledSkills,
            preferredTopic: challenge.preferredTopic,
            expiresAt: challenge.expiresAt,
        });

        return challenge;
    }

    /**
     * Accept a clan challenge
     */
    @Post('challenges/:id/accept')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Accept a clan challenge' })
    @ApiParam({ name: 'id', description: 'Challenge ID' })
    @ApiResponse({ status: 200, description: 'Challenge accepted', type: ChallengeResponseDto })
    @ApiResponse({ status: 400, description: 'Challenge expired or wrong status' })
    @ApiResponse({ status: 403, description: 'Not the clan owner' })
    @ApiResponse({ status: 404, description: 'Challenge not found' })
    async acceptChallenge(
        @Param('id') id: string,
        @Req() req: AuthedRequest,
    ) {
        const challenge = await this.clanChallengeService.acceptChallenge(req.user.id, id);

        // Notify both clans
        const [challengerMembers, challengedMembers] = await Promise.all([
            this.clanChallengeService.getClanMemberIds(challenge.challengerClanId),
            this.clanChallengeService.getClanMemberIds(challenge.challengedClanId),
        ]);
        const allMembers = [...challengerMembers, ...challengedMembers];
        this.battlesGateway.emitToClanMembers(allMembers, 'clan.challenge_accepted', {
            challengeId: challenge.id,
            challengerClan: challenge.challengerClan,
            challengedClan: challenge.challengedClan,
        });

        return challenge;
    }

    /**
     * Decline a clan challenge
     */
    @Post('challenges/:id/decline')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Decline a clan challenge' })
    @ApiParam({ name: 'id', description: 'Challenge ID' })
    @ApiResponse({ status: 200, description: 'Challenge declined', type: ChallengeResponseDto })
    @ApiResponse({ status: 400, description: 'Challenge expired or wrong status' })
    @ApiResponse({ status: 403, description: 'Not the clan owner' })
    @ApiResponse({ status: 404, description: 'Challenge not found' })
    async declineChallenge(
        @Param('id') id: string,
        @Req() req: AuthedRequest,
    ) {
        const challenge = await this.clanChallengeService.declineChallenge(req.user.id, id);

        // Notify the other clan
        const otherClanId =
            challenge.challengerClanId === challenge.challengedClanId
                ? challenge.challengerClanId
                : challenge.challengerClanId; // Notify challenger
        const memberIds = await this.clanChallengeService.getClanMemberIds(
            challenge.challengerClanId,
        );
        // Also notify challenged clan
        const challengedMemberIds = await this.clanChallengeService.getClanMemberIds(
            challenge.challengedClanId,
        );
        this.battlesGateway.emitToClanMembers(
            [...memberIds, ...challengedMemberIds],
            'clan.challenge_declined',
            {
                challengeId: challenge.id,
                challengerClan: challenge.challengerClan,
                challengedClan: challenge.challengedClan,
            },
        );

        return challenge;
    }

    /**
     * Counter-propose a clan challenge
     */
    @Post('challenges/:id/counter')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Counter-propose a clan challenge' })
    @ApiParam({ name: 'id', description: 'Challenge ID' })
    @ApiResponse({ status: 200, description: 'Counter-proposal sent', type: ChallengeResponseDto })
    @ApiResponse({ status: 400, description: 'Challenge not pending or expired' })
    @ApiResponse({ status: 403, description: 'Not the challenged clan owner' })
    @ApiResponse({ status: 404, description: 'Challenge not found' })
    async counterChallenge(
        @Param('id') id: string,
        @Body() dto: CounterChallengeDto,
        @Req() req: AuthedRequest,
    ) {
        const challenge = await this.clanChallengeService.counterChallenge(
            req.user.id,
            id,
            dto,
        );

        // Notify challenger clan of counter-proposal
        const memberIds = await this.clanChallengeService.getClanMemberIds(
            challenge.challengerClanId,
        );
        this.battlesGateway.emitToClanMembers(memberIds, 'clan.challenge_countered', {
            challengeId: challenge.id,
            challengerClan: challenge.challengerClan,
            challengedClan: challenge.challengedClan,
            counterTeamSize: challenge.counterTeamSize,
            counterTimeLimitMinutes: challenge.counterTimeLimitMinutes,
            counterEnabledSkills: challenge.counterEnabledSkills,
            counterPreferredTopic: challenge.counterPreferredTopic,
            counterMessage: challenge.counterMessage,
            expiresAt: challenge.expiresAt,
        });

        return challenge;
    }

    // ============================================
    // PARAMETERIZED CLAN ROUTES (:id)
    // ============================================

    /**
     * Get clan by ID
     */
    @Get(':id')
    @ApiOperation({ summary: 'Get clan by ID' })
    @ApiParam({ name: 'id', description: 'Clan ID' })
    @ApiResponse({ status: 200, description: 'Clan found', type: ClanResponseDto })
    @ApiResponse({ status: 404, description: 'Clan not found' })
    findOne(@Param('id') id: string) {
        return this.clansService.findOne(id);
    }

    /**
     * Get challenges for a clan
     */
    @Get(':id/challenges')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get challenges for a clan' })
    @ApiParam({ name: 'id', description: 'Clan ID' })
    @ApiQuery({ name: 'pending', required: false, type: Boolean, description: 'Only show pending/countered challenges' })
    @ApiResponse({ status: 200, description: 'List of challenges', type: [ChallengeResponseDto] })
    @ApiResponse({ status: 403, description: 'Not a member of this clan' })
    getChallenges(
        @Param('id') id: string,
        @Query('pending') pending: string,
        @Req() req: AuthedRequest,
    ) {
        if (pending === 'true') {
            return this.clanChallengeService.getPendingChallenges(id, req.user.id);
        }
        return this.clanChallengeService.getChallenges(id, req.user.id);
    }

    /**
     * Get clan by tag
     */
    @Get('tag/:tag')
    @ApiOperation({ summary: 'Get clan by tag' })
    @ApiParam({ name: 'tag', description: 'Clan tag (e.g., CW)', example: 'CW' })
    @ApiResponse({ status: 200, description: 'Clan found', type: ClanResponseDto })
    @ApiResponse({ status: 404, description: 'Clan not found' })
    findByTag(@Param('tag') tag: string) {
        return this.clansService.findByTag(tag);
    }

    /**
     * Create a new clan
     */
    @Post()
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Create a new clan' })
    @ApiResponse({ status: 201, description: 'Clan created', type: ClanResponseDto })
    @ApiResponse({ status: 400, description: 'Already in a clan or name/tag taken' })
    create(
        @Body() createClanDto: CreateClanDto,
        @Req() req: AuthedRequest,
    ) {
        return this.clansService.create(req.user.id, createClanDto);
    }

    /**
     * Update clan details (owner only)
     */
    @Patch(':id')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Update clan details' })
    @ApiParam({ name: 'id', description: 'Clan ID' })
    @ApiResponse({ status: 200, description: 'Clan updated', type: ClanResponseDto })
    @ApiResponse({ status: 403, description: 'Not the clan owner' })
    @ApiResponse({ status: 404, description: 'Clan not found' })
    update(
        @Param('id') id: string,
        @Body() updateClanDto: UpdateClanDto,
        @Req() req: AuthedRequest,
    ) {
        return this.clansService.update(id, req.user.id, updateClanDto);
    }

    /**
     * Join a clan
     */
    @Post(':id/join')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Join a clan' })
    @ApiParam({ name: 'id', description: 'Clan ID to join' })
    @ApiResponse({ status: 200, description: 'Joined clan', type: ClanResponseDto })
    @ApiResponse({ status: 400, description: 'Already in a clan' })
    @ApiResponse({ status: 404, description: 'Clan not found' })
    join(@Param('id') id: string, @Req() req: AuthedRequest) {
        return this.clansService.join(id, req.user.id);
    }

    /**
     * Leave current clan
     */
    @Post('leave')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Leave current clan' })
    @ApiResponse({ status: 200, description: 'Left clan successfully' })
    @ApiResponse({ status: 400, description: 'Not in a clan' })
    leave(@Req() req: AuthedRequest) {
        return this.clansService.leave(req.user.id);
    }

    /**
     * Kick a member from clan (owner only)
     */
    @Delete(':id/members/:memberId')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Kick member from clan' })
    @ApiParam({ name: 'id', description: 'Clan ID' })
    @ApiParam({ name: 'memberId', description: 'Member ID to kick' })
    @ApiResponse({ status: 200, description: 'Member kicked', type: ClanResponseDto })
    @ApiResponse({ status: 403, description: 'Not the clan owner' })
    @ApiResponse({ status: 404, description: 'Clan not found' })
    kick(
        @Param('id') id: string,
        @Param('memberId') memberId: string,
        @Req() req: AuthedRequest,
    ) {
        return this.clansService.kick(id, req.user.id, memberId);
    }

    /**
     * Delete clan (owner only)
     */
    @Delete(':id')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Delete clan' })
    @ApiParam({ name: 'id', description: 'Clan ID' })
    @ApiResponse({ status: 200, description: 'Clan deleted' })
    @ApiResponse({ status: 403, description: 'Not the clan owner' })
    @ApiResponse({ status: 404, description: 'Clan not found' })
    delete(@Param('id') id: string, @Req() req: AuthedRequest) {
        return this.clansService.delete(id, req.user.id);
    }
}
