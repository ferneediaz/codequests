import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
    Inject,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
    SEASON_EVENTS_PORT,
    SeasonEventsPort,
} from '../realtime/ports/season-events.port';
import { getRankTier } from '../common/utils/rank-tiers';

@Injectable()
export class SeasonsService {
    private readonly logger = new Logger(SeasonsService.name);

    constructor(
        private prisma: PrismaService,
        @Inject(SEASON_EVENTS_PORT)
        private seasonEvents: SeasonEventsPort,
    ) {}

    /**
     * Get the currently active season
     */
    async getActiveSeason() {
        const season = await this.prisma.season.findFirst({
            where: { isActive: true },
        });

        return season;
    }

    /**
     * Get all seasons ordered by number
     */
    async getAllSeasons() {
        return this.prisma.season.findMany({
            orderBy: { number: 'desc' },
        });
    }

    /**
     * Get a specific season by ID
     */
    async getSeasonById(seasonId: string) {
        const season = await this.prisma.season.findUnique({
            where: { id: seasonId },
        });

        if (!season) {
            throw new NotFoundException(`Season with ID ${seasonId} not found`);
        }

        return season;
    }

    /**
     * Get season records for a user
     */
    async getSeasonRecords(userId: string) {
        return this.prisma.seasonRecord.findMany({
            where: { userId },
            include: {
                season: {
                    select: { number: true, name: true, startDate: true, endDate: true },
                },
            },
            orderBy: { season: { number: 'desc' } },
        });
    }

    /**
     * Toggle whether a season record is displayed on a user's profile
     */
    async toggleDisplaySeason(userId: string, seasonId: string) {
        const record = await this.prisma.seasonRecord.findUnique({
            where: { userId_seasonId: { userId, seasonId } },
        });

        if (!record) {
            throw new NotFoundException('Season record not found');
        }

        return this.prisma.seasonRecord.update({
            where: { id: record.id },
            data: { isDisplayed: !record.isDisplayed },
        });
    }

    /**
     * Update peak MMR for a user in the active season.
     * Called after MMR changes from battle completion.
     */
    async updatePeakMmr(userId: string, currentMmr: number) {
        const activeSeason = await this.getActiveSeason();
        if (!activeSeason) return;

        const tier = getRankTier(currentMmr);

        await this.prisma.seasonRecord.upsert({
            where: {
                userId_seasonId: { userId, seasonId: activeSeason.id },
            },
            create: {
                userId,
                seasonId: activeSeason.id,
                peakMmr: currentMmr,
                peakRankTier: tier.name,
                finalMmr: currentMmr,
                finalRankTier: tier.name,
            },
            update: {
                finalMmr: currentMmr,
                finalRankTier: tier.name,
            },
        });

        // Update peak separately to use conditional logic
        await this.prisma.$transaction(async (tx) => {
            const record = await tx.seasonRecord.findUnique({
                where: { userId_seasonId: { userId, seasonId: activeSeason.id } },
            });
            if (record && currentMmr > record.peakMmr) {
                await tx.seasonRecord.update({
                    where: { id: record.id },
                    data: {
                        peakMmr: currentMmr,
                        peakRankTier: tier.name,
                    },
                });
            }
        });
    }

    /**
     * Increment wins or losses on a user's season record
     */
    async incrementSeasonStats(userId: string, won: boolean) {
        const activeSeason = await this.getActiveSeason();
        if (!activeSeason) return;

        const tier = getRankTier(1000); // default tier for new record

        const record = await this.prisma.seasonRecord.upsert({
            where: {
                userId_seasonId: { userId, seasonId: activeSeason.id },
            },
            create: {
                userId,
                seasonId: activeSeason.id,
                peakMmr: 1000,
                peakRankTier: tier.name,
                finalMmr: 1000,
                finalRankTier: tier.name,
                wins: won ? 1 : 0,
                losses: won ? 0 : 1,
                winRate: won ? 100 : 0,
            },
            update: {
                wins: won ? { increment: 1 } : undefined,
                losses: !won ? { increment: 1 } : undefined,
            },
        });

        // Recalculate win rate
        const totalGames = record.wins + record.losses;
        const winRate = totalGames > 0 ? (record.wins / totalGames) * 100 : 0;
        await this.prisma.seasonRecord.update({
            where: { id: record.id },
            data: { winRate: Math.round(winRate * 10) / 10 },
        });
    }

    /**
     * Get season leaderboard by peak MMR or final MMR
     */
    async getSeasonLeaderboard(
        seasonId: string,
        options?: { limit?: number; offset?: number; sortBy?: 'peakMmr' | 'finalMmr' },
    ) {
        const season = await this.getSeasonById(seasonId);

        const sortBy = options?.sortBy || 'peakMmr';

        const records = await this.prisma.seasonRecord.findMany({
            where: { seasonId },
            take: options?.limit || 50,
            skip: options?.offset || 0,
            orderBy: { [sortBy]: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                    },
                },
            },
        });

        return {
            season,
            records,
        };
    }

    /**
     * Start a new season
     */
    async startSeason(name?: string): Promise<any> {
        // Deactivate any current active season
        await this.prisma.season.updateMany({
            where: { isActive: true },
            data: { isActive: false },
        });

        // Get next season number
        const lastSeason = await this.prisma.season.findFirst({
            orderBy: { number: 'desc' },
        });
        const nextNumber = (lastSeason?.number || 0) + 1;

        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 3); // 3-month season

        const season = await this.prisma.season.create({
            data: {
                number: nextNumber,
                name: name || `Season ${nextNumber}`,
                isActive: true,
                startDate: now,
                endDate,
            },
        });

        this.logger.log(`Started ${season.name} (ends ${endDate.toISOString()})`);
        return season;
    }

    /**
     * End a season: snapshot all players, hard-reset MMR
     */
    async endSeason(seasonId: string) {
        const season = await this.getSeasonById(seasonId);

        if (!season.isActive) {
            throw new BadRequestException('Season is not active');
        }

        // Get all users who played during this season (have season records)
        const records = await this.prisma.seasonRecord.findMany({
            where: { seasonId },
            include: { user: { select: { id: true, mmr: true, wins: true, losses: true } } },
        });

        await this.prisma.$transaction(async (tx) => {
            // Finalize each record with current user stats
            for (const record of records) {
                const finalMmr = record.user.mmr;
                const finalTier = getRankTier(finalMmr);
                const totalGames = record.wins + record.losses;
                const winRate = totalGames > 0 ? (record.wins / totalGames) * 100 : 0;

                await tx.seasonRecord.update({
                    where: { id: record.id },
                    data: {
                        finalMmr,
                        finalRankTier: finalTier.name,
                        winRate: Math.round(winRate * 10) / 10,
                    },
                });
            }

            // Hard reset ALL users' MMR to 1000, wins/losses to 0
            await tx.user.updateMany({
                data: {
                    mmr: 1000,
                    wins: 0,
                    losses: 0,
                },
            });

            // Mark season as inactive
            await tx.season.update({
                where: { id: seasonId },
                data: { isActive: false },
            });
        });

        this.logger.log(`Ended ${season.name}. All MMR reset to 1000.`);
        return season;
    }

    /**
     * Daily cron: check if active season has ended, trigger transition
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async processSeasonTransition() {
        const activeSeason = await this.getActiveSeason();
        if (!activeSeason) {
            this.logger.warn('No active season found');
            return;
        }

        const now = new Date();
        if (now < activeSeason.endDate) {
            return; // Season still active
        }

        this.logger.log(`Season ${activeSeason.name} has ended. Processing transition...`);

        // End current season
        await this.endSeason(activeSeason.id);

        // Start new season
        const newSeason = await this.startSeason();

        // Notify all connected clients
        this.seasonEvents.emitSeasonEnded({
            endedSeason: { id: activeSeason.id, name: activeSeason.name, number: activeSeason.number },
            newSeason: { id: newSeason.id, name: newSeason.name, number: newSeason.number },
        });

        return { ended: activeSeason, started: newSeason };
    }
}
