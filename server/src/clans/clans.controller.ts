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
import { Request } from 'express';
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
import { CreateClanDto, UpdateClanDto, ClanResponseDto } from './dto';

@ApiTags('clans')
@Controller('clans')
export class ClansController {
    constructor(private readonly clansService: ClansService) { }

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
        @Req() req: Request & { user: { id: string } },
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
        @Req() req: Request & { user: { id: string } },
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
    join(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
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
    leave(@Req() req: Request & { user: { id: string } }) {
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
        @Req() req: Request & { user: { id: string } },
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
    delete(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
        return this.clansService.delete(id, req.user.id);
    }
}
