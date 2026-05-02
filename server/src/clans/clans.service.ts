import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClanDto } from './dto/create-clan.dto';
import { UpdateClanDto } from './dto/update-clan.dto';
import { getClanRankTier } from '../common/utils/rank-tiers';

@Injectable()
export class ClansService {
    constructor(private prisma: PrismaService) { }

    /**
     * Attach the MMR-derived rank tier to a clan response object. Idempotent
     * and non-destructive — callers can hand any clan row through this
     * function before returning it from a controller.
     */
    private withTier<T extends { mmr: number }>(clan: T): T & { tier: ReturnType<typeof getClanRankTier> } {
        return { ...clan, tier: getClanRankTier(clan.mmr) };
    }

    /**
     * Get all clans with member counts
     */
    async findAll(options?: { limit?: number; offset?: number }) {
        const clans = await this.prisma.clan.findMany({
            take: options?.limit || 50,
            skip: options?.offset || 0,
            orderBy: { mmr: 'desc' },
            include: {
                members: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        mmr: true,
                    },
                },
            },
        });
        return clans.map((c) => this.withTier(c));
    }

    /**
     * Get clan by ID with full details
     */
    async findOne(id: string) {
        const clan = await this.prisma.clan.findUnique({
            where: { id },
            include: {
                members: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        mmr: true,
                        wins: true,
                        losses: true,
                    },
                    orderBy: { mmr: 'desc' },
                },
            },
        });

        if (!clan) {
            throw new NotFoundException(`Clan with ID ${id} not found`);
        }

        return this.withTier(clan);
    }

    /**
     * Get clan by tag
     */
    async findByTag(tag: string) {
        const clan = await this.prisma.clan.findUnique({
            where: { tag: tag.toUpperCase() },
            include: {
                members: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        mmr: true,
                    },
                },
            },
        });

        if (!clan) {
            throw new NotFoundException(`Clan [${tag}] not found`);
        }

        return this.withTier(clan);
    }

    /**
     * Create a new clan
     */
    async create(userId: string, createClanDto: CreateClanDto) {
        // Check if user already owns or is in a clan
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { clanId: true },
        });

        if (user?.clanId) {
            throw new BadRequestException(
                'You must leave your current clan before creating a new one',
            );
        }

        // Check if name or tag already exists
        const existing = await this.prisma.clan.findFirst({
            where: {
                OR: [
                    { name: createClanDto.name },
                    { tag: createClanDto.tag.toUpperCase() },
                ],
            },
        });

        if (existing) {
            throw new BadRequestException(
                existing.name === createClanDto.name
                    ? 'Clan name already taken'
                    : 'Clan tag already taken',
            );
        }

        // Create clan and add creator as owner/member
        const created = await this.prisma.clan.create({
            data: {
                name: createClanDto.name,
                tag: createClanDto.tag.toUpperCase(),
                ownerId: userId,
                members: {
                    connect: { id: userId },
                },
            },
            include: {
                members: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        mmr: true,
                    },
                },
            },
        });
        return this.withTier(created);
    }

    /**
     * Update clan details (owner only)
     */
    async update(id: string, userId: string, updateClanDto: UpdateClanDto) {
        const clan = await this.prisma.clan.findUnique({ where: { id } });

        if (!clan) {
            throw new NotFoundException(`Clan with ID ${id} not found`);
        }

        if (clan.ownerId !== userId) {
            throw new ForbiddenException('Only the clan owner can update clan details');
        }

        // Check for duplicate name/tag
        if (updateClanDto.name || updateClanDto.tag) {
            const existing = await this.prisma.clan.findFirst({
                where: {
                    id: { not: id },
                    OR: [
                        updateClanDto.name ? { name: updateClanDto.name } : {},
                        updateClanDto.tag
                            ? { tag: updateClanDto.tag.toUpperCase() }
                            : {},
                    ].filter((o) => Object.keys(o).length > 0),
                },
            });

            if (existing) {
                throw new BadRequestException(
                    existing.name === updateClanDto.name
                        ? 'Clan name already taken'
                        : 'Clan tag already taken',
                );
            }
        }

        const updated = await this.prisma.clan.update({
            where: { id },
            data: {
                ...(updateClanDto.name && { name: updateClanDto.name }),
                ...(updateClanDto.tag && { tag: updateClanDto.tag.toUpperCase() }),
            },
            include: {
                members: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        mmr: true,
                    },
                },
            },
        });
        return this.withTier(updated);
    }

    /**
     * Join a clan
     */
    async join(clanId: string, userId: string) {
        // Check if user is already in a clan
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { clanId: true },
        });

        if (user?.clanId) {
            throw new BadRequestException(
                'You must leave your current clan before joining another',
            );
        }

        // Check if clan exists
        const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
        if (!clan) {
            throw new NotFoundException(`Clan with ID ${clanId} not found`);
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { clanId },
        });

        return this.findOne(clanId);
    }

    /**
     * Leave a clan
     */
    async leave(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { clanId: true },
        });

        if (!user?.clanId) {
            throw new BadRequestException('You are not in a clan');
        }

        // Check if user is the owner
        const clan = await this.prisma.clan.findUnique({
            where: { id: user.clanId },
            include: { members: { select: { id: true } } },
        });

        if (clan?.ownerId === userId) {
            // If owner is leaving and there are other members, transfer ownership
            const otherMembers = clan.members.filter((m) => m.id !== userId);
            if (otherMembers.length > 0) {
                await this.prisma.clan.update({
                    where: { id: clan.id },
                    data: { ownerId: otherMembers[0].id },
                });
            } else {
                // Delete clan if owner is the only member
                await this.prisma.clan.delete({ where: { id: clan.id } });
                await this.prisma.user.update({
                    where: { id: userId },
                    data: { clanId: null },
                });
                return { message: 'Clan disbanded' };
            }
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { clanId: null },
        });

        return { message: 'Left clan successfully' };
    }

    /**
     * Kick a member from clan (owner only)
     */
    async kick(clanId: string, ownerId: string, memberId: string) {
        const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });

        if (!clan) {
            throw new NotFoundException(`Clan with ID ${clanId} not found`);
        }

        if (clan.ownerId !== ownerId) {
            throw new ForbiddenException('Only the clan owner can kick members');
        }

        if (memberId === ownerId) {
            throw new BadRequestException('Owner cannot kick themselves');
        }

        const member = await this.prisma.user.findUnique({
            where: { id: memberId },
            select: { clanId: true },
        });

        if (member?.clanId !== clanId) {
            throw new BadRequestException('User is not a member of this clan');
        }

        await this.prisma.user.update({
            where: { id: memberId },
            data: { clanId: null },
        });

        return this.findOne(clanId);
    }

    /**
     * Delete a clan (owner only)
     */
    async delete(id: string, userId: string) {
        const clan = await this.prisma.clan.findUnique({ where: { id } });

        if (!clan) {
            throw new NotFoundException(`Clan with ID ${id} not found`);
        }

        if (clan.ownerId !== userId) {
            throw new ForbiddenException('Only the clan owner can delete the clan');
        }

        // Remove all members from clan first
        await this.prisma.user.updateMany({
            where: { clanId: id },
            data: { clanId: null },
        });

        await this.prisma.clan.delete({ where: { id } });

        return { message: 'Clan deleted successfully' };
    }

    /**
     * Update clan MMR (called after clan battles)
     */
    async updateMmr(clanId: string, mmrChange: number) {
        return this.prisma.clan.update({
            where: { id: clanId },
            data: {
                mmr: { increment: mmrChange },
            },
        });
    }

    /**
     * Get clan battle history (completed CLAN_VS_CLAN battles involving this clan's members)
     */
    async getBattleHistory(
        clanId: string,
        page: number = 1,
        limit: number = 20,
    ) {
        const clan = await this.prisma.clan.findUnique({
            where: { id: clanId },
            select: { id: true, name: true, tag: true, wins: true, losses: true, mmr: true },
        });

        if (!clan) {
            throw new NotFoundException(`Clan with ID ${clanId} not found`);
        }

        const skip = (page - 1) * limit;

        const where = {
            mode: 'CLAN_VS_CLAN' as const,
            status: 'COMPLETED' as const,
            participants: {
                some: { user: { clanId } },
            },
        };

        const [battles, total] = await Promise.all([
            this.prisma.battle.findMany({
                where,
                skip,
                take: limit,
                orderBy: { endedAt: 'desc' as const },
                include: {
                    participants: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    avatarUrl: true,
                                    mmr: true,
                                    clanId: true,
                                    clan: { select: { id: true, name: true, tag: true } },
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.battle.count({ where }),
        ]);

        return {
            clan: {
                id: clan.id,
                name: clan.name,
                tag: clan.tag,
                wins: clan.wins,
                losses: clan.losses,
                mmr: clan.mmr,
            },
            data: battles.map((battle) => ({
                id: battle.id,
                mode: battle.mode,
                winningTeam: battle.winningTeam,
                teamSize: battle.teamSize,
                endedAt: battle.endedAt,
                createdAt: battle.createdAt,
                clanResult: this.getClanResult(battle, clanId),
                participants: battle.participants.map((p) => ({
                    userId: p.userId,
                    username: p.user.username,
                    avatarUrl: p.user.avatarUrl,
                    teamId: p.teamId,
                    pointsEarned: p.pointsEarned,
                    clan: p.user.clan,
                })),
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Determine if the clan won, lost, or drew a specific battle
     */
    private getClanResult(
        battle: {
            winningTeam: string | null;
            participants: Array<{ teamId: string | null; user: { clanId: string | null } }>;
        },
        clanId: string,
    ): 'win' | 'loss' | 'draw' {
        if (!battle.winningTeam) return 'draw';

        const clanParticipant = battle.participants.find(
            (p) => p.user.clanId === clanId,
        );
        if (!clanParticipant?.teamId) return 'draw';

        return clanParticipant.teamId === battle.winningTeam ? 'win' : 'loss';
    }
}
