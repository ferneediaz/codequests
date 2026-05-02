import { Test, TestingModule } from '@nestjs/testing';
import { SeasonsService } from './seasons.service';
import { PrismaService } from '../prisma/prisma.service';
import {
    SEASON_EVENTS_PORT,
    SeasonEventsPort,
} from '../realtime/ports/season-events.port';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SeasonsService', () => {
    let service: SeasonsService;
    let prisma: MockPrismaService;
    let seasonEvents: jest.Mocked<SeasonEventsPort>;

    const mockSeason = {
        id: 'season-1',
        number: 1,
        name: 'Season 1',
        isActive: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-04-01'),
        createdAt: new Date(),
    };

    const mockSeasonRecord = {
        id: 'record-1',
        userId: 'user-1',
        seasonId: 'season-1',
        peakMmr: 1200,
        peakRankTier: 'Copy Paster',
        finalMmr: 1100,
        finalRankTier: 'Copy Paster',
        wins: 10,
        losses: 5,
        winRate: 66.7,
        isDisplayed: false,
        createdAt: new Date(),
    };

    beforeEach(async () => {
        prisma = createMockPrismaService() as MockPrismaService;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SeasonsService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: SEASON_EVENTS_PORT,
                    useValue: {
                        emitSeasonEnded: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<SeasonsService>(SeasonsService);
        seasonEvents = module.get(SEASON_EVENTS_PORT);
    });

    describe('getActiveSeason', () => {
        it('should return active season', async () => {
            prisma.season.findFirst.mockResolvedValue(mockSeason);
            const result = await service.getActiveSeason();
            expect(result).toEqual(mockSeason);
            expect(prisma.season.findFirst).toHaveBeenCalledWith({
                where: { isActive: true },
            });
        });

        it('should return null when no active season', async () => {
            prisma.season.findFirst.mockResolvedValue(null);
            const result = await service.getActiveSeason();
            expect(result).toBeNull();
        });
    });

    describe('getAllSeasons', () => {
        it('should return all seasons ordered by number desc', async () => {
            prisma.season.findMany.mockResolvedValue([mockSeason]);
            const result = await service.getAllSeasons();
            expect(result).toEqual([mockSeason]);
            expect(prisma.season.findMany).toHaveBeenCalledWith({
                orderBy: { number: 'desc' },
            });
        });
    });

    describe('getSeasonById', () => {
        it('should return season by id', async () => {
            prisma.season.findUnique.mockResolvedValue(mockSeason);
            const result = await service.getSeasonById('season-1');
            expect(result).toEqual(mockSeason);
        });

        it('should throw NotFoundException for invalid id', async () => {
            prisma.season.findUnique.mockResolvedValue(null);
            await expect(service.getSeasonById('bad-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getSeasonRecords', () => {
        it('should return season records for user', async () => {
            prisma.seasonRecord.findMany.mockResolvedValue([mockSeasonRecord]);
            const result = await service.getSeasonRecords('user-1');
            expect(result).toEqual([mockSeasonRecord]);
            expect(prisma.seasonRecord.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                include: {
                    season: {
                        select: { number: true, name: true, startDate: true, endDate: true },
                    },
                },
                orderBy: { season: { number: 'desc' } },
            });
        });
    });

    describe('toggleDisplaySeason', () => {
        it('should toggle isDisplayed from false to true', async () => {
            prisma.seasonRecord.findUnique.mockResolvedValue(mockSeasonRecord);
            prisma.seasonRecord.update.mockResolvedValue({
                ...mockSeasonRecord,
                isDisplayed: true,
            });

            const result = await service.toggleDisplaySeason('user-1', 'season-1');
            expect(result.isDisplayed).toBe(true);
            expect(prisma.seasonRecord.update).toHaveBeenCalledWith({
                where: { id: mockSeasonRecord.id },
                data: { isDisplayed: true },
            });
        });

        it('should toggle isDisplayed from true to false', async () => {
            prisma.seasonRecord.findUnique.mockResolvedValue({
                ...mockSeasonRecord,
                isDisplayed: true,
            });
            prisma.seasonRecord.update.mockResolvedValue({
                ...mockSeasonRecord,
                isDisplayed: false,
            });

            const result = await service.toggleDisplaySeason('user-1', 'season-1');
            expect(result.isDisplayed).toBe(false);
        });

        it('should throw NotFoundException for missing record', async () => {
            prisma.seasonRecord.findUnique.mockResolvedValue(null);
            await expect(
                service.toggleDisplaySeason('user-1', 'bad-season'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('updatePeakMmr', () => {
        it('should create season record if none exists', async () => {
            prisma.season.findFirst.mockResolvedValue(mockSeason);
            prisma.seasonRecord.upsert.mockResolvedValue(mockSeasonRecord);
            prisma.$transaction.mockImplementation(async (cb) => {
                const tx = {
                    seasonRecord: {
                        findUnique: jest.fn().mockResolvedValue({
                            ...mockSeasonRecord,
                            peakMmr: 1000,
                        }),
                        update: jest.fn().mockResolvedValue(mockSeasonRecord),
                    },
                };
                return cb(tx);
            });

            await service.updatePeakMmr('user-1', 1200);

            expect(prisma.seasonRecord.upsert).toHaveBeenCalled();
        });

        it('should update peak if new MMR is higher', async () => {
            prisma.season.findFirst.mockResolvedValue(mockSeason);
            prisma.seasonRecord.upsert.mockResolvedValue(mockSeasonRecord);

            let capturedUpdate: any = null;
            prisma.$transaction.mockImplementation(async (cb) => {
                const tx = {
                    seasonRecord: {
                        findUnique: jest.fn().mockResolvedValue({
                            ...mockSeasonRecord,
                            peakMmr: 1100,
                        }),
                        update: jest.fn().mockImplementation((args) => {
                            capturedUpdate = args;
                            return Promise.resolve({});
                        }),
                    },
                };
                return cb(tx);
            });

            await service.updatePeakMmr('user-1', 1300);

            expect(capturedUpdate).not.toBeNull();
            expect(capturedUpdate.data.peakMmr).toBe(1300);
        });

        it('should not update peak if new MMR is lower', async () => {
            prisma.season.findFirst.mockResolvedValue(mockSeason);
            prisma.seasonRecord.upsert.mockResolvedValue(mockSeasonRecord);

            let updateCalled = false;
            prisma.$transaction.mockImplementation(async (cb) => {
                const tx = {
                    seasonRecord: {
                        findUnique: jest.fn().mockResolvedValue({
                            ...mockSeasonRecord,
                            peakMmr: 1500,
                        }),
                        update: jest.fn().mockImplementation(() => {
                            updateCalled = true;
                            return Promise.resolve({});
                        }),
                    },
                };
                return cb(tx);
            });

            await service.updatePeakMmr('user-1', 1200);

            expect(updateCalled).toBe(false);
        });

        it('should do nothing when no active season', async () => {
            prisma.season.findFirst.mockResolvedValue(null);
            await service.updatePeakMmr('user-1', 1200);
            expect(prisma.seasonRecord.upsert).not.toHaveBeenCalled();
        });
    });

    describe('incrementSeasonStats', () => {
        it('should increment wins for winner', async () => {
            prisma.season.findFirst.mockResolvedValue(mockSeason);
            prisma.seasonRecord.upsert.mockResolvedValue({
                ...mockSeasonRecord,
                wins: 11,
            });
            prisma.seasonRecord.update.mockResolvedValue({});

            await service.incrementSeasonStats('user-1', true);

            const upsertCall = prisma.seasonRecord.upsert.mock.calls[0][0];
            expect(upsertCall.update.wins).toEqual({ increment: 1 });
        });

        it('should increment losses for loser', async () => {
            prisma.season.findFirst.mockResolvedValue(mockSeason);
            prisma.seasonRecord.upsert.mockResolvedValue({
                ...mockSeasonRecord,
                losses: 6,
            });
            prisma.seasonRecord.update.mockResolvedValue({});

            await service.incrementSeasonStats('user-1', false);

            const upsertCall = prisma.seasonRecord.upsert.mock.calls[0][0];
            expect(upsertCall.update.losses).toEqual({ increment: 1 });
        });

        it('should do nothing when no active season', async () => {
            prisma.season.findFirst.mockResolvedValue(null);
            await service.incrementSeasonStats('user-1', true);
            expect(prisma.seasonRecord.upsert).not.toHaveBeenCalled();
        });
    });

    describe('startSeason', () => {
        it('should create a new season with auto-generated name', async () => {
            prisma.season.updateMany.mockResolvedValue({ count: 1 });
            prisma.season.findFirst.mockResolvedValue(mockSeason);
            prisma.season.create.mockResolvedValue({
                ...mockSeason,
                id: 'season-2',
                number: 2,
                name: 'Season 2',
            });

            const result = await service.startSeason();

            expect(result.number).toBe(2);
            expect(result.name).toBe('Season 2');
            expect(prisma.season.updateMany).toHaveBeenCalledWith({
                where: { isActive: true },
                data: { isActive: false },
            });
        });

        it('should start as Season 1 when no previous seasons', async () => {
            prisma.season.updateMany.mockResolvedValue({ count: 0 });
            prisma.season.findFirst.mockResolvedValue(null);
            prisma.season.create.mockImplementation(async (args) => ({
                id: 'new-season',
                ...args.data,
                createdAt: new Date(),
            }));

            const result = await service.startSeason();

            expect(result.number).toBe(1);
            expect(result.name).toBe('Season 1');
        });

        it('should accept custom name', async () => {
            prisma.season.updateMany.mockResolvedValue({ count: 0 });
            prisma.season.findFirst.mockResolvedValue(null);
            prisma.season.create.mockImplementation(async (args) => ({
                id: 'new-season',
                ...args.data,
                createdAt: new Date(),
            }));

            const result = await service.startSeason('The Awakening');

            expect(result.name).toBe('The Awakening');
        });

        it('should set end date 3 months from now', async () => {
            prisma.season.updateMany.mockResolvedValue({ count: 0 });
            prisma.season.findFirst.mockResolvedValue(null);
            prisma.season.create.mockImplementation(async (args) => ({
                id: 'new-season',
                ...args.data,
                createdAt: new Date(),
            }));

            const result = await service.startSeason();

            const now = new Date();
            const expectedEnd = new Date(now);
            expectedEnd.setMonth(expectedEnd.getMonth() + 3);

            // Should be roughly 3 months from now (within a minute tolerance)
            const diffMs = Math.abs(result.endDate.getTime() - expectedEnd.getTime());
            expect(diffMs).toBeLessThan(60000);
        });
    });

    describe('endSeason', () => {
        it('should finalize records and hard-reset all MMR', async () => {
            prisma.season.findUnique.mockResolvedValue(mockSeason);
            prisma.seasonRecord.findMany.mockResolvedValue([
                {
                    ...mockSeasonRecord,
                    user: { id: 'user-1', mmr: 1400, wins: 20, losses: 10 },
                },
            ]);

            let txOperations: string[] = [];
            prisma.$transaction.mockImplementation(async (cb) => {
                const tx = {
                    seasonRecord: {
                        update: jest.fn().mockImplementation(() => {
                            txOperations.push('seasonRecord.update');
                            return Promise.resolve({});
                        }),
                    },
                    user: {
                        updateMany: jest.fn().mockImplementation(() => {
                            txOperations.push('user.updateMany');
                            return Promise.resolve({});
                        }),
                    },
                    season: {
                        update: jest.fn().mockImplementation(() => {
                            txOperations.push('season.update');
                            return Promise.resolve({});
                        }),
                    },
                };
                return cb(tx);
            });

            await service.endSeason('season-1');

            expect(txOperations).toContain('seasonRecord.update');
            expect(txOperations).toContain('user.updateMany');
            expect(txOperations).toContain('season.update');
        });

        it('should hard-reset MMR to 1000 for all users', async () => {
            prisma.season.findUnique.mockResolvedValue(mockSeason);
            prisma.seasonRecord.findMany.mockResolvedValue([]);

            let resetData: any = null;
            prisma.$transaction.mockImplementation(async (cb) => {
                const tx = {
                    seasonRecord: { update: jest.fn().mockResolvedValue({}) },
                    user: {
                        updateMany: jest.fn().mockImplementation((args) => {
                            resetData = args.data;
                            return Promise.resolve({});
                        }),
                    },
                    season: { update: jest.fn().mockResolvedValue({}) },
                };
                return cb(tx);
            });

            await service.endSeason('season-1');

            expect(resetData).toEqual({ mmr: 1000, wins: 0, losses: 0 });
        });

        it('should throw BadRequestException for inactive season', async () => {
            prisma.season.findUnique.mockResolvedValue({
                ...mockSeason,
                isActive: false,
            });

            await expect(service.endSeason('season-1')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw NotFoundException for invalid season', async () => {
            prisma.season.findUnique.mockResolvedValue(null);
            await expect(service.endSeason('bad-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('processSeasonTransition', () => {
        it('should not trigger if season has not ended', async () => {
            const futureSeason = {
                ...mockSeason,
                endDate: new Date(Date.now() + 86400000 * 30), // 30 days from now
            };
            prisma.season.findFirst.mockResolvedValue(futureSeason);

            const result = await service.processSeasonTransition();
            expect(result).toBeUndefined();
            expect(prisma.seasonRecord.findMany).not.toHaveBeenCalled();
        });

        it('should trigger transition when season has ended', async () => {
            const expiredSeason = {
                ...mockSeason,
                endDate: new Date(Date.now() - 86400000), // yesterday
            };
            prisma.season.findFirst.mockResolvedValue(expiredSeason);
            prisma.season.findUnique.mockResolvedValue(expiredSeason);
            prisma.seasonRecord.findMany.mockResolvedValue([]);
            prisma.$transaction.mockImplementation(async (cb) => {
                const tx = {
                    seasonRecord: { update: jest.fn().mockResolvedValue({}) },
                    user: { updateMany: jest.fn().mockResolvedValue({}) },
                    season: { update: jest.fn().mockResolvedValue({}) },
                };
                return cb(tx);
            });
            prisma.season.updateMany.mockResolvedValue({ count: 1 });
            prisma.season.create.mockResolvedValue({
                ...mockSeason,
                id: 'season-2',
                number: 2,
                name: 'Season 2',
            });

            const result = await service.processSeasonTransition();

            expect(result).toBeDefined();
            expect(result!.ended).toEqual(expiredSeason);
            expect(result!.started.number).toBe(2);
        });

        it('should emit season.ended WebSocket event on transition', async () => {
            const expiredSeason = {
                ...mockSeason,
                endDate: new Date(Date.now() - 86400000),
            };
            prisma.season.findFirst.mockResolvedValue(expiredSeason);
            prisma.season.findUnique.mockResolvedValue(expiredSeason);
            prisma.seasonRecord.findMany.mockResolvedValue([]);
            prisma.$transaction.mockImplementation(async (cb) => {
                const tx = {
                    seasonRecord: { update: jest.fn().mockResolvedValue({}) },
                    user: { updateMany: jest.fn().mockResolvedValue({}) },
                    season: { update: jest.fn().mockResolvedValue({}) },
                };
                return cb(tx);
            });
            prisma.season.updateMany.mockResolvedValue({ count: 1 });
            const newSeason = {
                ...mockSeason,
                id: 'season-2',
                number: 2,
                name: 'Season 2',
            };
            prisma.season.create.mockResolvedValue(newSeason);

            await service.processSeasonTransition();

            expect(seasonEvents.emitSeasonEnded).toHaveBeenCalledWith({
                endedSeason: {
                    id: expiredSeason.id,
                    name: expiredSeason.name,
                    number: expiredSeason.number,
                },
                newSeason: {
                    id: newSeason.id,
                    name: newSeason.name,
                    number: newSeason.number,
                },
            });
        });

        it('should log warning when no active season', async () => {
            prisma.season.findFirst.mockResolvedValue(null);
            const result = await service.processSeasonTransition();
            expect(result).toBeUndefined();
        });
    });

    describe('getSeasonLeaderboard', () => {
        it('should return leaderboard sorted by peakMmr', async () => {
            prisma.season.findUnique.mockResolvedValue(mockSeason);
            prisma.seasonRecord.findMany.mockResolvedValue([mockSeasonRecord]);

            const result = await service.getSeasonLeaderboard('season-1');

            expect(result.season).toEqual(mockSeason);
            expect(result.records).toEqual([mockSeasonRecord]);
            expect(prisma.seasonRecord.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { peakMmr: 'desc' },
                }),
            );
        });

        it('should support sorting by finalMmr', async () => {
            prisma.season.findUnique.mockResolvedValue(mockSeason);
            prisma.seasonRecord.findMany.mockResolvedValue([]);

            await service.getSeasonLeaderboard('season-1', { sortBy: 'finalMmr' });

            expect(prisma.seasonRecord.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { finalMmr: 'desc' },
                }),
            );
        });
    });
});
