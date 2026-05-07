import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { BattleMode, BattleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { getRankTier } from '../common/utils/rank-tiers';
import { PracticeService } from '../practice/practice.service';

/**
 * Public-facing User columns. Excludes Stripe billing identifiers
 * (`stripeCustomerId`), free-tier usage counters (`gamesPlayedToday`,
 * `lastGameResetAt`, `trialEndsAt`, `hasUsedTrial`), and the onboarding
 * survey (`onboardingCompletedAt`, `userSegment`, etc.) — those are only
 * exposed via `/auth/me` to the user themselves.
 */
const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  githubUsername: true,
  role: true,
  mmr: true,
  wins: true,
  losses: true,
  clanId: true,
  subscriptionTier: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Win/loss from completed battles (source of truth for the dashboard). Matches
 * the same rules as the client's Recent Match rows — unlike User.wins, which
 * is not updated for team modes and may be stale for older 1v1s.
 */
function winLossForCompletedBattle(
  mode: BattleMode,
  userId: string,
  teamId: string | null,
  battle: { winnerId: string | null; winningTeam: string | null },
): 'W' | 'L' | null {
  if (mode === BattleMode.GROUP || mode === BattleMode.CLAN_VS_CLAN) {
    if (!battle.winningTeam) return null; // draw
    if (!teamId) return 'L';
    return teamId === battle.winningTeam ? 'W' : 'L';
  }
  if (!battle.winnerId) return null; // draw
  return battle.winnerId === userId ? 'W' : 'L';
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private practice: PracticeService,
  ) {}

  /**
   * Get all users (for leaderboard, etc.)
   */
  async findAll(options?: { limit?: number; offset?: number }) {
    const users = await this.prisma.user.findMany({
      take: options?.limit || 50,
      skip: options?.offset || 0,
      orderBy: { mmr: 'desc' },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        mmr: true,
        wins: true,
        losses: true,
        clan: {
          select: { tag: true, name: true },
        },
      },
    });

    return users.map((user) => ({
      ...user,
      tier: getRankTier(user.mmr),
    }));
  }

  async searchByUsername(query: string, viewerId: string, limit = 10) {
    const q = query.trim();
    if (!q) return [];

    return this.prisma.user.findMany({
      where: {
        id: { not: viewerId },
        username: { startsWith: q, mode: 'insensitive' },
      },
      take: Math.min(Math.max(limit, 1), 25),
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        mmr: true,
        clanId: true,
      },
    });
  }

  /**
   * Get user by ID with full details. Selects an explicit public column
   * set so internal billing/usage fields (`stripeCustomerId`,
   * `gamesPlayedToday`, ...) never leak through this public endpoint.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...PUBLIC_USER_SELECT,
        clan: true,
        battles: {
          take: 10,
          orderBy: { battle: { createdAt: 'desc' } },
          select: {
            battle: {
              select: {
                id: true,
                mode: true,
                status: true,
                winnerId: true,
                createdAt: true,
              },
            },
          },
        },
        seasonRecords: {
          where: { isDisplayed: true },
          select: {
            id: true,
            seasonId: true,
            peakMmr: true,
            peakRankTier: true,
            finalMmr: true,
            finalRankTier: true,
            wins: true,
            losses: true,
            winRate: true,
            createdAt: true,
            season: {
              select: { number: true, name: true },
            },
          },
          orderBy: { season: { number: 'desc' } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return {
      ...user,
      tier: getRankTier(user.mmr),
    };
  }

  /**
   * Get user by username. Same public-column projection as `findOne` so
   * the unauthenticated lookup can't leak Stripe IDs or daily-usage flags.
   */
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        ...PUBLIC_USER_SELECT,
        clan: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }

    return user;
  }

  /**
   * Update user profile
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if new username is taken
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: updateUserDto.username },
      });
      if (existingUser) {
        throw new ConflictException('Username already taken');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  /**
   * Get user's match history
   */
  async getMatchHistory(id: string, limit = 20) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const rows = await this.prisma.battleParticipant.findMany({
      where: { userId: id },
      take: limit,
      orderBy: { battle: { createdAt: 'desc' } },
      include: {
        battle: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
              },
            },
          },
        },
      },
    });

    // Flatten to the `MatchHistoryEntry` shape the client expects (not raw Prisma rows).
    return rows.map((row) => {
      const b = row.battle;
      return {
        id: b.id,
        mode: b.mode,
        status: b.status,
        winnerId: b.winnerId ?? undefined,
        winningTeam: b.winningTeam ?? undefined,
        startedAt: b.startedAt ?? undefined,
        endedAt: b.endedAt ?? undefined,
        createdAt: b.createdAt,
        timeLimitMinutes: b.timeLimitMinutes,
        participants: b.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          username: p.user.username,
          teamId: p.teamId ?? undefined,
          code: p.code ?? undefined,
          language: p.language ?? undefined,
          testsPassed: p.testsPassed,
          totalTests: p.totalTests,
          pointsEarned: p.pointsEarned,
          isReady: p.isReady,
          submittedAt: p.submittedAt ?? undefined,
          mmrChange: p.mmrChange ?? undefined,
        })),
      };
    });
  }

  /**
   * GitHub push-event activity for a user, by year. Drives the GH overlay
   * on the activity heatmap on both Dashboard and `/profile/:username`.
   *
   * When `GITHUB_TOKEN` is set we use GraphQL `contributionsCollection`,
   * which gives the full-year contribution calendar for any public GH
   * login (a single shared token covers every user we render). Without a
   * token we fall back to the public events API (PushEvents only,
   * last ~90 days) so dev still works without configuring a token.
   */
  async getGithubActivity(
    userId: string,
    year: string,
  ): Promise<{ username: string | null; commitsByDate: Record<string, number> }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, githubUsername: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    if (!user.githubUsername) {
      // Common after the column was first introduced: the row exists
      // but the user hasn't logged in via GitHub since the schema
      // change, so we have no GH login on file. Heatmap will show
      // battle activity only.
      this.logger.debug(
        `getGithubActivity: user ${userId} has no githubUsername on file (re-login via GitHub to populate it)`,
      );
      return { username: null, commitsByDate: {} };
    }

    const yearNum = parseInt(year, 10);
    const targetYear = Number.isFinite(yearNum)
      ? yearNum
      : new Date().getUTCFullYear();
    // GitHub GraphQL caps the contribution range at exactly 1 year. Use
    // the last instant of the target year (Dec 31 23:59:59.999 UTC) so
    // we stay under that bound — `Date.UTC(year + 1, 0, 1)` is 366 days
    // away in leap years and gets rejected.
    const from = new Date(Date.UTC(targetYear, 0, 1));
    const to = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

    const ghLogin = user.githubUsername;
    const token = process.env.GITHUB_TOKEN;

    if (token) {
      const graphqlData = await this.fetchGithubGraphqlActivity(
        ghLogin,
        from,
        to,
        token,
      );
      if (graphqlData) {
        return { username: ghLogin, commitsByDate: graphqlData };
      }
      this.logger.warn(
        `getGithubActivity: GraphQL returned no data for ${ghLogin} ${targetYear}; falling back to events API (90-day window)`,
      );
    } else {
      this.logger.debug(
        `getGithubActivity: GITHUB_TOKEN not set; using events-API fallback for ${ghLogin} (90-day window)`,
      );
    }

    const eventsData = await this.fetchGithubEventsActivity(
      ghLogin,
      from,
      to,
      token,
    );
    return { username: ghLogin, commitsByDate: eventsData };
  }

  private async fetchGithubGraphqlActivity(
    login: string,
    from: Date,
    to: Date,
    token: string,
  ): Promise<Record<string, number> | null> {
    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'codequest-battles',
        },
        body: JSON.stringify({
          query: `
            query($login: String!, $from: DateTime!, $to: DateTime!) {
              user(login: $login) {
                contributionsCollection(from: $from, to: $to) {
                  contributionCalendar {
                    weeks {
                      contributionDays { date contributionCount }
                    }
                  }
                }
              }
            }
          `,
          variables: { login, from: from.toISOString(), to: to.toISOString() },
        }),
      });
      if (!res.ok) {
        this.logger.warn(
          `GH GraphQL ${res.status} for ${login} (range ${from.toISOString()} → ${to.toISOString()})`,
        );
        return null;
      }
      const json = (await res.json()) as {
        data?: {
          user?: {
            contributionsCollection?: {
              contributionCalendar?: {
                weeks?: Array<{
                  contributionDays?: Array<{
                    date: string;
                    contributionCount: number;
                  }>;
                }>;
              };
            };
          };
        };
        errors?: Array<{ message?: string; type?: string }>;
      };
      // GitHub returns HTTP 200 with an `errors` array on bad queries
      // (invalid date range, missing user, etc). Surface those instead
      // of silently falling back to the events API.
      if (json.errors && json.errors.length > 0) {
        const messages = json.errors
          .map((e) => e.message ?? e.type ?? 'unknown error')
          .join('; ');
        this.logger.warn(
          `GH GraphQL errors for ${login} (range ${from.toISOString()} → ${to.toISOString()}): ${messages}`,
        );
        return null;
      }
      const weeks =
        json.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
      if (!weeks) {
        this.logger.warn(
          `GH GraphQL: no contributionCalendar.weeks for ${login} — likely a non-existent login or private profile`,
        );
        return null;
      }
      const commitsByDate: Record<string, number> = {};
      for (const week of weeks) {
        for (const day of week.contributionDays ?? []) {
          if (day.contributionCount > 0) {
            commitsByDate[day.date] = day.contributionCount;
          }
        }
      }
      this.logger.debug(
        `GH GraphQL: ${Object.keys(commitsByDate).length} active days for ${login} in ${from.toISOString().slice(0, 4)}`,
      );
      return commitsByDate;
    } catch (err) {
      this.logger.warn(
        `GH GraphQL failed for ${login}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async fetchGithubEventsActivity(
    login: string,
    from: Date,
    to: Date,
    token: string | undefined,
  ): Promise<Record<string, number>> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'codequest-battles',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const commitsByDate: Record<string, number> = {};
    try {
      for (let page = 1; page <= 10; page++) {
        const res = await fetch(
          `https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`,
          { headers },
        );
        if (!res.ok) {
          this.logger.warn(
            `GH events API ${res.status} for ${login} (page ${page})`,
          );
          break;
        }
        const events = (await res.json()) as Array<{
          type?: string;
          created_at?: string;
          payload?: { size?: number };
        }>;
        if (!events.length) break;
        let outOfRange = 0;
        for (const event of events) {
          if (event.type !== 'PushEvent' || !event.created_at) continue;
          const eventDate = new Date(event.created_at);
          if (eventDate < from || eventDate >= to) {
            outOfRange += 1;
            continue;
          }
          const dateKey = event.created_at.slice(0, 10);
          const commitCount = Math.max(1, event.payload?.size ?? 1);
          commitsByDate[dateKey] = (commitsByDate[dateKey] ?? 0) + commitCount;
        }
        // Once a whole page's events all fall before `from`, the rest will too.
        if (outOfRange === events.length) break;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to fetch GH events for ${login}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return commitsByDate;
  }

  /**
   * Approved problems contributed by this user. Drives the
   * "Contributions" section on `/profile/:username`.
   */
  async getContributions(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.problem.findMany({
      where: { contributedById: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        difficulty: true,
        tags: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get user stats
   */
  async getStats(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        mmr: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const participation = await this.prisma.battleParticipant.findMany({
      where: { userId: id, battle: { status: BattleStatus.COMPLETED } },
      select: {
        teamId: true,
        battle: { select: { mode: true, winnerId: true, winningTeam: true } },
      },
    });

    let wins = 0;
    let losses = 0;
    for (const row of participation) {
      const w = winLossForCompletedBattle(
        row.battle.mode,
        id,
        row.teamId,
        row.battle,
      );
      if (w === 'W') wins += 1;
      else if (w === 'L') losses += 1;
    }

    const totalGames = wins + losses;
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

    // Calculate rank tier based on MMR
    const tier = getRankTier(user.mmr);

    const practice = await this.practice.getMyStats(id);

    return {
      id: user.id,
      username: user.username,
      mmr: user.mmr,
      wins,
      losses,
      totalGames,
      winRate: Math.round(winRate * 10) / 10,
      tier,
      practice,
    };
  }
}
