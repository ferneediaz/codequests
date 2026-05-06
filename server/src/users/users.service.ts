import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
