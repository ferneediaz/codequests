import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { BattleMode, BattleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { getRankTier } from '../common/utils/rank-tiers';
import { PracticeService } from '../practice/practice.service';

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

  /**
   * Get user by ID with full details
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        clan: true,
        battles: {
          take: 10,
          orderBy: { battle: { createdAt: 'desc' } },
          include: {
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
          include: {
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
   * Get user by username
   */
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { clan: true },
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
