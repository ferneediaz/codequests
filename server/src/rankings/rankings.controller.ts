import {
  BadRequestException,
  Controller,
  Get,
  ParseIntPipe,
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
import {
  RANKINGS_PERIODS,
  RankingsPeriod,
  RankingsService,
} from './rankings.service';
import { ClanRankingRowDto, UserRankingRowDto } from './dto';
import { AuthedRequest } from '../common/types/authed-request';

function parsePeriod(value: string | undefined): RankingsPeriod {
  const v = (value ?? 'alltime') as RankingsPeriod;
  if (!RANKINGS_PERIODS.includes(v)) {
    throw new BadRequestException(
      `Invalid period "${value}". Expected one of: ${RANKINGS_PERIODS.join(', ')}`,
    );
  }
  return v;
}

@ApiTags('rankings')
@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get('global')
  @ApiOperation({
    summary: 'Global rankings with optional period and language filters',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly', 'alltime'],
  })
  @ApiQuery({ name: 'language', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200, type: [UserRankingRowDto] })
  global(
    @Query('period') period?: string,
    @Query('language') language?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.rankings.getGlobalRankings({
      period: parsePeriod(period),
      language,
      limit,
      offset,
    });
  }

  @Get('clans')
  @ApiOperation({ summary: 'Clan rankings with optional period filter' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly', 'alltime'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200, type: [ClanRankingRowDto] })
  clans(
    @Query('period') period?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.rankings.getClanRankings({
      period: parsePeriod(period),
      limit,
      offset,
    });
  }

  @Get('friends')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Rankings restricted to the authenticated user and their friends',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly', 'alltime'],
  })
  @ApiQuery({ name: 'language', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200, type: [UserRankingRowDto] })
  friends(
    @Req() req: AuthedRequest,
    @Query('period') period?: string,
    @Query('language') language?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.rankings.getFriendsRankings(req.user.id, {
      period: parsePeriod(period),
      language,
      limit,
      offset,
    });
  }
}
