import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    Req,
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
import { SeasonsService } from './seasons.service';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('seasons')
@Controller('seasons')
export class SeasonsController {
    constructor(private readonly seasonsService: SeasonsService) {}

    @Get()
    @ApiOperation({ summary: 'Get all seasons' })
    @ApiResponse({ status: 200, description: 'Returns all seasons' })
    getAllSeasons() {
        return this.seasonsService.getAllSeasons();
    }

    @Get('active')
    @ApiOperation({ summary: 'Get the currently active season' })
    @ApiResponse({ status: 200, description: 'Returns active season or null' })
    getActiveSeason() {
        return this.seasonsService.getActiveSeason();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific season by ID' })
    @ApiParam({ name: 'id', description: 'Season ID' })
    @ApiResponse({ status: 200, description: 'Returns the season' })
    getSeason(@Param('id') id: string) {
        return this.seasonsService.getSeasonById(id);
    }

    @Get(':id/leaderboard')
    @ApiOperation({ summary: 'Get season leaderboard' })
    @ApiParam({ name: 'id', description: 'Season ID' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiQuery({ name: 'sortBy', required: false, enum: ['peakMmr', 'finalMmr'] })
    @ApiResponse({ status: 200, description: 'Returns season leaderboard' })
    getSeasonLeaderboard(
        @Param('id') id: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('sortBy') sortBy?: 'peakMmr' | 'finalMmr',
    ) {
        return this.seasonsService.getSeasonLeaderboard(id, {
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
            sortBy,
        });
    }
}

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class UserSeasonsController {
    constructor(private readonly seasonsService: SeasonsService) {}

    @Get(':id/seasons')
    @ApiOperation({ summary: "Get a user's season history" })
    @ApiParam({ name: 'id', description: 'User ID' })
    @ApiResponse({ status: 200, description: 'Returns season records for user' })
    getUserSeasons(@Param('id') id: string) {
        return this.seasonsService.getSeasonRecords(id);
    }

    @Post('seasons/:seasonId/display')
    @ApiOperation({ summary: 'Toggle display of a season record on your profile' })
    @ApiParam({ name: 'seasonId', description: 'Season ID' })
    @ApiResponse({ status: 200, description: 'Season record display toggled' })
    toggleDisplaySeason(
        @Req() req: AuthedRequest,
        @Param('seasonId') seasonId: string,
    ) {
        const userId = req.user.id;
        return this.seasonsService.toggleDisplaySeason(userId, seasonId);
    }
}
