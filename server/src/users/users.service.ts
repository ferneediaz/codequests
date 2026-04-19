import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { getRankTier } from '../common/utils/rank-tiers';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.battleParticipant.findMany({
      where: { userId: id },
      take: limit,
      orderBy: { battle: { createdAt: 'desc' } },
      include: {
        battle: {
          include: {
            problem: {
              select: { title: true, difficulty: true },
            },
            participants: {
              select: {
                userId: true,
                testsPassed: true,
                totalTests: true,
                user: {
                  select: { username: true, avatarUrl: true },
                },
              },
            },
          },
        },
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
        mmr: true,
        wins: true,
        losses: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const totalGames = user.wins + user.losses;
    const winRate = totalGames > 0 ? (user.wins / totalGames) * 100 : 0;

    // Calculate rank tier based on MMR
    const tier = getRankTier(user.mmr);

    return {
      ...user,
      totalGames,
      winRate: Math.round(winRate * 10) / 10,
      tier,
    };
  }
}
