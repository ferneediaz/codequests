import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
  ParseIntPipe,
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
import { UsersService } from './users.service';
import { NewsService, NewsFilter } from './news.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { NewsResponseDto } from './dto/news-response.dto';
import { ContributionResponseDto } from './dto/contribution-response.dto';
import { GithubActivityResponseDto } from './dto/github-activity-response.dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly newsService: NewsService,
  ) {}

  /**
   * Get all users (paginated, sorted by MMR)
   */
  @Get()
  @ApiOperation({ summary: 'Get all users (leaderboard)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.usersService.findAll({ limit, offset });
  }

  @Get('search')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Search users by username prefix' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Matching public user records' })
  search(
    @Req() req: AuthedRequest,
    @Query('q') q: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.usersService.searchByUsername(q, req.user.id, limit);
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description:
      'Public user profile with rank tier, clan, last 10 battles, and displayed season records. Internal billing fields (stripeCustomerId, daily-usage counters) are stripped.',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Get user by username
   */
  @Get('username/:username')
  @ApiOperation({ summary: 'Get user by username' })
  @ApiParam({ name: 'username', description: 'Username', example: 'codemaster42' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  /**
   * Update user profile (authenticated, own profile only)
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 403, description: 'Cannot update other users' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: AuthedRequest,
  ) {
    // Users can only update their own profile
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Get user's match history
   */
  @Get(':id/history')
  @ApiOperation({ summary: 'Get user match history' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Match history' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getHistory(
    @Param('id') id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.usersService.getMatchHistory(id, limit);
  }

  /**
   * Get approved problems this user has contributed.
   */
  @Get(':id/contributions')
  @ApiOperation({ summary: 'Get problems contributed by user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Approved problems contributed by this user (latest first, capped at 50)',
    type: [ContributionResponseDto],
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getContributions(@Param('id') id: string) {
    return this.usersService.getContributions(id);
  }

  /**
   * Get user's GitHub push-event activity for the heatmap.
   * Returns `{ username: null, commitsByDate: {} }` when the user has no
   * GH login on file (e.g., signed in with Google) — heatmap still
   * renders battle activity.
   */
  @Get(':id/github-activity')
  @ApiOperation({ summary: 'Get user GitHub push activity (for heatmap)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({ name: 'year', required: false, type: String, example: '2026' })
  @ApiResponse({
    status: 200,
    description: 'GitHub push events bucketed by date',
    type: GithubActivityResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getGithubActivity(
    @Param('id') id: string,
    @Query('year') year?: string,
  ) {
    return this.usersService.getGithubActivity(
      id,
      year ?? String(new Date().getUTCFullYear()),
    );
  }

  /**
   * Get user stats (MMR, win rate, tier)
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get user stats' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User stats' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getStats(@Param('id') id: string) {
    return this.usersService.getStats(id);
  }

  /**
   * Get the news feed for a user.
   *
   * Clan challenge events are globally visible; friend battle results are
   * only surfaced when at least one participant is in the viewer's
   * accepted-friends set. The viewer (`id`) must match the authenticated
   * user so friend scoping can't be spoofed.
   */
  @Get(':id/news')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get dashboard news feed for a user' })
  @ApiParam({ name: 'id', description: 'User ID (must match authenticated user)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 15 })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    description: 'ISO timestamp cursor (from a previous `nextCursor`)',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', 'clan', 'friends', 'shame'],
  })
  @ApiResponse({ status: 200, description: 'News feed', type: NewsResponseDto })
  @ApiResponse({ status: 403, description: 'Cannot read another user\'s news feed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getNews(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('before') before?: string,
    @Query('filter') filter?: string,
  ) {
    if (req.user.id !== id) {
      throw new ForbiddenException(
        'You can only read your own news feed',
      );
    }
    return this.newsService.getNews(id, {
      limit,
      before,
      filter: sanitizeFilter(filter),
    });
  }
}

function sanitizeFilter(value?: string): NewsFilter | undefined {
  if (!value) return undefined;
  switch (value) {
    case 'all':
    case 'clan':
    case 'friends':
    case 'shame':
      return value;
    default:
      return undefined;
  }
}
