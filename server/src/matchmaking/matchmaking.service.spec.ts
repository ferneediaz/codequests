import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingService } from './matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { BattlesService } from '../battles/battles.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { BattleMode, BattleStatus, Difficulty, MatchmakingStatus } from '@prisma/client';
import { BattlesGateway } from '../websockets/battles.gateway';

describe('MatchmakingService', () => {
    let service: MatchmakingService;
    let prisma: MockPrismaService;
    let battlesService: { createBattle: jest.Mock; joinBattle: jest.Mock };
    let battlesGateway: { emitMatchFound: jest.Mock };

    const mockUser1 = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@test.com',
        avatarUrl: null,
        mmr: 1000,
        wins: 5,
        losses: 3,
        role: 'user',
        clanId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockUser2 = {
        id: 'user-2',
        username: 'bob',
        email: 'bob@test.com',
        avatarUrl: null,
        mmr: 1050,
        wins: 8,
        losses: 2,
        role: 'user',
        clanId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockUser3 = {
        id: 'user-3',
        username: 'charlie',
        email: 'charlie@test.com',
        avatarUrl: null,
        mmr: 2000,
        wins: 50,
        losses: 5,
        role: 'user',
        clanId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockProblem = {
        id: 'problem-1',
        title: 'Two Sum',
        description: 'Find two numbers',
        difficulty: Difficulty.EASY,
        starterCode: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const baseQueueEntry = {
        id: 'entry-1',
        userId: 'user-1',
        mode: BattleMode.ONE_V_ONE,
        preferredDifficulty: null,
        mmrAtQueue: 1000,
        status: MatchmakingStatus.QUEUED,
        queuedAt: new Date(),
        matchedAt: null,
    };

    const mockBattle = {
        id: 'battle-1',
        mode: BattleMode.ONE_V_ONE,
        problemId: 'problem-1',
        winnerId: null,
        winningTeam: null,
        teamSize: null,
        timeLimitMinutes: 5,
        autoBalance: true,
        status: BattleStatus.WAITING,
        startedAt: null,
        endedAt: null,
        createdAt: new Date(),
        participants: [],
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        const mockBattlesService = {
            createBattle: jest.fn(),
            joinBattle: jest.fn(),
        };

        const mockBattlesGateway = {
            emitMatchFound: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MatchmakingService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: BattlesService,
                    useValue: mockBattlesService,
                },
                {
                    provide: BattlesGateway,
                    useValue: mockBattlesGateway,
                },
            ],
        }).compile();

        service = module.get<MatchmakingService>(MatchmakingService);
        prisma = module.get<MockPrismaService>(PrismaService);
        battlesService = module.get(BattlesService);
        battlesGateway = module.get(BattlesGateway);
    });

    // ==========================================
    // joinQueue
    // ==========================================
    describe('joinQueue', () => {
        it('should add a user to the matchmaking queue', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.matchmakingEntry.findUnique.mockResolvedValue(null);
            prisma.battleParticipant.findFirst.mockResolvedValue(null);

            const createdEntry = {
                ...baseQueueEntry,
                userId: mockUser1.id,
                mmrAtQueue: mockUser1.mmr,
            };
            prisma.matchmakingEntry.create.mockResolvedValue(createdEntry);

            // tryFindMatch will be called — no queued entry found after creation
            prisma.matchmakingEntry.findUnique
                .mockResolvedValueOnce(null) // First call: check existing
                .mockResolvedValueOnce(createdEntry); // Second call: in tryFindMatch
            prisma.matchmakingEntry.findMany.mockResolvedValue([]); // No candidates

            const result = await service.joinQueue(mockUser1.id, {});

            expect(result.status).toBe('queued');
            expect(result.entry).toBeDefined();
            expect(prisma.matchmakingEntry.create).toHaveBeenCalledWith({
                data: {
                    userId: mockUser1.id,
                    mode: BattleMode.ONE_V_ONE,
                    preferredDifficulty: null,
                    preferredTopic: null,
                    mmrAtQueue: mockUser1.mmr,
                },
            });
        });

        it('should use specified mode and difficulty', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.matchmakingEntry.findUnique.mockResolvedValue(null);
            prisma.battleParticipant.findFirst.mockResolvedValue(null);

            const createdEntry = {
                ...baseQueueEntry,
                mode: BattleMode.BATTLE_ROYALE,
                preferredDifficulty: Difficulty.HARD,
            };
            prisma.matchmakingEntry.create.mockResolvedValue(createdEntry);
            prisma.matchmakingEntry.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(createdEntry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([]);

            const result = await service.joinQueue(mockUser1.id, {
                mode: BattleMode.BATTLE_ROYALE,
                preferredDifficulty: Difficulty.HARD,
            });

            expect(result.status).toBe('queued');
            expect(prisma.matchmakingEntry.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    mode: BattleMode.BATTLE_ROYALE,
                    preferredDifficulty: Difficulty.HARD,
                }),
            });
        });

        it('should throw BadRequestException if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.joinQueue('nonexistent', {})).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException if already in queue', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.matchmakingEntry.findUnique.mockResolvedValue({
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            });

            await expect(
                service.joinQueue(mockUser1.id, {}),
            ).rejects.toThrow(BadRequestException);
        });

        it('should delete stale MATCHED entry before creating new one', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);

            const staleEntry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.MATCHED,
            };
            prisma.matchmakingEntry.findUnique
                .mockResolvedValueOnce(staleEntry) // First: check existing
                .mockResolvedValueOnce(null) // After delete, createEntry check
                .mockResolvedValueOnce({ ...baseQueueEntry }); // tryFindMatch
            prisma.matchmakingEntry.delete.mockResolvedValue(staleEntry);
            prisma.battleParticipant.findFirst.mockResolvedValue(null);

            const newEntry = { ...baseQueueEntry, id: 'entry-new' };
            prisma.matchmakingEntry.create.mockResolvedValue(newEntry);
            prisma.matchmakingEntry.findUnique.mockResolvedValue(newEntry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([]);

            const result = await service.joinQueue(mockUser1.id, {});

            expect(prisma.matchmakingEntry.delete).toHaveBeenCalledWith({
                where: { userId: mockUser1.id },
            });
            expect(result.status).toBe('queued');
        });

        it('should throw BadRequestException if user is in active battle', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.matchmakingEntry.findUnique.mockResolvedValue(null);
            prisma.battleParticipant.findFirst.mockResolvedValue({
                id: 'participant-1',
                battleId: 'battle-1',
                userId: mockUser1.id,
            });

            await expect(
                service.joinQueue(mockUser1.id, {}),
            ).rejects.toThrow(BadRequestException);
        });

        it('should return matched status when immediate match is found', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.matchmakingEntry.findUnique.mockResolvedValue(null);
            prisma.battleParticipant.findFirst.mockResolvedValue(null);

            const createdEntry = { ...baseQueueEntry };
            prisma.matchmakingEntry.create.mockResolvedValue(createdEntry);

            // tryFindMatch: entry exists and is QUEUED
            prisma.matchmakingEntry.findUnique
                .mockResolvedValueOnce(null) // check existing (first call)
                .mockResolvedValueOnce(createdEntry); // tryFindMatch fetch

            const candidateEntry = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                mmrAtQueue: 1050,
            };
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidateEntry]);

            // createMatchedBattle
            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.joinQueue(mockUser1.id, {});

            expect(result.status).toBe('matched');
            expect(result.battleId).toBe('battle-1');
            expect(battlesService.createBattle).toHaveBeenCalledWith(
                mockUser1.id,
                { problemId: mockProblem.id, mode: BattleMode.ONE_V_ONE },
            );
            expect(battlesService.joinBattle).toHaveBeenCalledWith(
                'user-2',
                'battle-1',
            );
        });
    });

    // ==========================================
    // leaveQueue
    // ==========================================
    describe('leaveQueue', () => {
        it('should remove a user from the queue', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue({
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            });
            prisma.matchmakingEntry.delete.mockResolvedValue(baseQueueEntry);

            const result = await service.leaveQueue(mockUser1.id);

            expect(result.status).toBe('left');
            expect(prisma.matchmakingEntry.delete).toHaveBeenCalledWith({
                where: { userId: mockUser1.id },
            });
        });

        it('should throw BadRequestException if not in queue', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue(null);

            await expect(service.leaveQueue(mockUser1.id)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException if entry is not QUEUED status', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue({
                ...baseQueueEntry,
                status: MatchmakingStatus.MATCHED,
            });

            await expect(service.leaveQueue(mockUser1.id)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    // ==========================================
    // getQueueStatus
    // ==========================================
    describe('getQueueStatus', () => {
        it('should return inQueue: false when user is not in queue', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue(null);

            const result = await service.getQueueStatus(mockUser1.id);

            expect(result.inQueue).toBe(false);
        });

        it('should return inQueue: false when entry is not QUEUED', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue({
                ...baseQueueEntry,
                status: MatchmakingStatus.EXPIRED,
            });

            const result = await service.getQueueStatus(mockUser1.id);

            expect(result.inQueue).toBe(false);
        });

        it('should return queue status with player count when in queue', async () => {
            const entry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            };
            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.count.mockResolvedValue(3);

            const result = await service.getQueueStatus(mockUser1.id);

            expect(result.inQueue).toBe(true);
            expect(result.id).toBe(entry.id);
            expect(result.mode).toBe(BattleMode.ONE_V_ONE);
            expect(result.playersInQueue).toBe(3);
            expect(result.queuedAt).toBeDefined();
        });
    });

    // ==========================================
    // calculateMmrRange
    // ==========================================
    describe('calculateMmrRange', () => {
        it('should return base range of 100 for fresh entries', () => {
            const now = new Date();
            const range = service.calculateMmrRange(now, now);
            expect(range).toBe(100);
        });

        it('should expand range by 50 after 30 seconds', () => {
            const now = new Date();
            const thirtySecsAgo = new Date(now.getTime() - 30_000);
            const range = service.calculateMmrRange(thirtySecsAgo, now);
            expect(range).toBe(150);
        });

        it('should expand range by 100 after 60 seconds', () => {
            const now = new Date();
            const sixtySecsAgo = new Date(now.getTime() - 60_000);
            const range = service.calculateMmrRange(sixtySecsAgo, now);
            expect(range).toBe(200);
        });

        it('should expand range by 250 after 2.5 minutes', () => {
            const now = new Date();
            const twoAndHalfMinsAgo = new Date(now.getTime() - 150_000);
            const range = service.calculateMmrRange(twoAndHalfMinsAgo, now);
            expect(range).toBe(350);
        });

        it('should not expand for partial intervals', () => {
            const now = new Date();
            const twentySecsAgo = new Date(now.getTime() - 20_000);
            const range = service.calculateMmrRange(twentySecsAgo, now);
            expect(range).toBe(100); // Not yet 30 seconds
        });

        it('should cap MMR range at maximum', () => {
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 300_000);
            const range = service.calculateMmrRange(fiveMinutesAgo, now);
            expect(range).toBe(500); // 100 + 10*50 = 600, capped to 500
        });
    });

    // ==========================================
    // tryFindMatch
    // ==========================================
    describe('tryFindMatch', () => {
        it('should return null if entry not found', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue(null);

            const result = await service.tryFindMatch('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null if entry is not QUEUED', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue({
                ...baseQueueEntry,
                status: MatchmakingStatus.MATCHED,
            });

            const result = await service.tryFindMatch(baseQueueEntry.id);

            expect(result).toBeNull();
        });

        it('should return null if no candidates within MMR range', async () => {
            prisma.matchmakingEntry.findUnique.mockResolvedValue({
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            });
            prisma.matchmakingEntry.findMany.mockResolvedValue([]);

            const result = await service.tryFindMatch(baseQueueEntry.id);

            expect(result).toBeNull();
        });

        it('should match with candidate in MMR range and create battle', async () => {
            const entry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                mmrAtQueue: 1050,
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);

            // createMatchedBattle dependencies
            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.tryFindMatch(baseQueueEntry.id);

            expect(result).not.toBeNull();
            expect(result!.battleId).toBe('battle-1');
            expect(result!.player1Id).toBe('user-1');
            expect(result!.player2Id).toBe('user-2');
        });

        it('should prefer candidate with same difficulty preference', async () => {
            const entry = {
                ...baseQueueEntry,
                preferredDifficulty: Difficulty.HARD,
                status: MatchmakingStatus.QUEUED,
            };

            const candidateNoPref = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                mmrAtQueue: 1020,
                preferredDifficulty: null,
                status: MatchmakingStatus.QUEUED,
                queuedAt: new Date(Date.now() - 5000), // queued earlier
            };

            const candidateHard = {
                ...baseQueueEntry,
                id: 'entry-3',
                userId: 'user-3',
                mmrAtQueue: 1080,
                preferredDifficulty: Difficulty.HARD,
                status: MatchmakingStatus.QUEUED,
                queuedAt: new Date(), // queued later
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            // Candidates ordered by queuedAt asc: candidateNoPref first
            prisma.matchmakingEntry.findMany.mockResolvedValue([
                candidateNoPref,
                candidateHard,
            ]);

            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.tryFindMatch(entry.id);

            expect(result).not.toBeNull();
            // Should pick candidateHard (matching preference) over candidateNoPref (no preference but also acceptable)
            // Both are acceptable, but the one with matching pref should be picked
            expect(result!.player2Id).toBe('user-3');
        });

        it('should query candidates filtered by mode and MMR range', async () => {
            const entry = {
                ...baseQueueEntry,
                mode: BattleMode.BATTLE_ROYALE,
                mmrAtQueue: 1500,
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([]);

            await service.tryFindMatch(entry.id);

            expect(prisma.matchmakingEntry.findMany).toHaveBeenCalledWith({
                where: {
                    id: { not: entry.id },
                    mode: BattleMode.BATTLE_ROYALE,
                    status: MatchmakingStatus.QUEUED,
                    mmrAtQueue: {
                        gte: 1400, // 1500 - 100
                        lte: 1600, // 1500 + 100
                    },
                },
                orderBy: [{ queuedAt: 'asc' }],
            });
        });

        it('should return null when no problems are available', async () => {
            const entry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);
            prisma.problem.count.mockResolvedValue(0);

            const result = await service.tryFindMatch(entry.id);

            // When no problems exist, createMatchedBattle returns null
            expect(result).toBeNull();
        });

        it('should fall back to any problem when difficulty filter matches nothing', async () => {
            const entry = {
                ...baseQueueEntry,
                preferredDifficulty: Difficulty.HARD,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                preferredDifficulty: Difficulty.HARD,
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);

            // No HARD problems exist at all
            prisma.problem.count
                .mockResolvedValueOnce(0)  // difficulty=HARD → 0
                .mockResolvedValueOnce(5); // final fallback (any problem) → 5
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.tryFindMatch(entry.id);

            expect(result).not.toBeNull();
            expect(result!.battleId).toBe('battle-1');
            // Final fallback should query with empty where clause
            expect(prisma.problem.count).toHaveBeenLastCalledWith({ where: {} });
            expect(prisma.problem.findFirst).toHaveBeenCalledWith({
                where: {},
                skip: expect.any(Number),
            });
        });
    });

    // ==========================================
    // expireStaleEntries
    // ==========================================
    describe('expireStaleEntries', () => {
        it('should delete entries older than 10 minutes', async () => {
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 3 });

            const result = await service.expireStaleEntries();

            expect(result).toBe(3);
            expect(prisma.matchmakingEntry.deleteMany).toHaveBeenCalledWith({
                where: {
                    status: MatchmakingStatus.QUEUED,
                    queuedAt: { lt: expect.any(Date) },
                },
            });
        });

        it('should return 0 when no stale entries exist', async () => {
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 0 });

            const result = await service.expireStaleEntries();

            expect(result).toBe(0);
        });
    });

    // ==========================================
    // matchQueuedPlayers
    // ==========================================
    describe('matchQueuedPlayers', () => {
        it('should return 0 when queue is empty', async () => {
            prisma.matchmakingEntry.findMany.mockResolvedValue([]);

            const result = await service.matchQueuedPlayers();

            expect(result).toBe(0);
        });

        it('should match players when candidates are available', async () => {
            const entry1 = {
                ...baseQueueEntry,
                id: 'entry-1',
                userId: 'user-1',
                mmrAtQueue: 1000,
                status: MatchmakingStatus.QUEUED,
            };

            const entry2 = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                mmrAtQueue: 1050,
                status: MatchmakingStatus.QUEUED,
            };

            // matchQueuedPlayers fetches all queued entries
            prisma.matchmakingEntry.findMany
                .mockResolvedValueOnce([entry1, entry2]); // initial fetch

            // tryFindMatch for entry1 — fetch by id
            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry1);
            // tryFindMatch candidates query returns entry2
            prisma.matchmakingEntry.findMany.mockResolvedValueOnce([entry2]);

            // createMatchedBattle
            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.matchQueuedPlayers();

            expect(result).toBe(1);
            expect(battlesService.createBattle).toHaveBeenCalled();
            expect(battlesService.joinBattle).toHaveBeenCalled();
        });

        it('should skip already-matched entries in the same cycle', async () => {
            const entry1 = {
                ...baseQueueEntry,
                id: 'entry-1',
                userId: 'user-1',
                mmrAtQueue: 1000,
                status: MatchmakingStatus.QUEUED,
            };

            const entry2 = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                mmrAtQueue: 1050,
                status: MatchmakingStatus.QUEUED,
            };

            // Only two-player queue — one match possible
            prisma.matchmakingEntry.findMany
                .mockResolvedValueOnce([entry1, entry2]) // initial fetch
                .mockResolvedValueOnce([entry2]); // tryFindMatch candidates

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry1);

            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            const result = await service.matchQueuedPlayers();

            // entry2 matched with entry1, so entry2 should be skipped in 2nd iteration
            expect(result).toBe(1);
            // createBattle should only be called once for the pair
            expect(battlesService.createBattle).toHaveBeenCalledTimes(1);
        });
    });

    // ==========================================
    // processQueue
    // ==========================================
    describe('processQueue', () => {
        it('should call expireStaleEntries and matchQueuedPlayers', async () => {
            // expireStaleEntries
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 0 });
            // matchQueuedPlayers
            prisma.matchmakingEntry.findMany.mockResolvedValue([]);

            await service.processQueue();

            expect(prisma.matchmakingEntry.deleteMany).toHaveBeenCalled();
            expect(prisma.matchmakingEntry.findMany).toHaveBeenCalled();
        });

        it('should not throw even if processing errors occur', async () => {
            prisma.matchmakingEntry.deleteMany.mockRejectedValue(
                new Error('DB connection error'),
            );

            // processQueue catches errors internally
            await expect(service.processQueue()).resolves.not.toThrow();
        });
    });

    // ==========================================
    // Battle creation integration
    // ==========================================
    describe('battle creation from match', () => {
        it('should create battle with correct problem and mode', async () => {
            const entry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                mmrAtQueue: 1050,
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);

            prisma.problem.count.mockResolvedValue(5);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            await service.tryFindMatch(entry.id);

            expect(battlesService.createBattle).toHaveBeenCalledWith('user-1', {
                problemId: 'problem-1',
                mode: BattleMode.ONE_V_ONE,
            });
            expect(battlesService.joinBattle).toHaveBeenCalledWith(
                'user-2',
                'battle-1',
            );
        });

        it('should filter problems by preferred difficulty when set', async () => {
            const entry = {
                ...baseQueueEntry,
                preferredDifficulty: Difficulty.MEDIUM,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                preferredDifficulty: null,
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);

            prisma.problem.count.mockResolvedValue(3);
            prisma.problem.findFirst.mockResolvedValue({ ...mockProblem, difficulty: Difficulty.MEDIUM });
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            await service.tryFindMatch(entry.id);

            // Should query problems filtered by MEDIUM difficulty
            expect(prisma.problem.count).toHaveBeenCalledWith({
                where: { difficulty: Difficulty.MEDIUM },
            });
            expect(prisma.problem.findFirst).toHaveBeenCalledWith({
                where: { difficulty: Difficulty.MEDIUM },
                skip: expect.any(Number),
            });
        });

        it('should clean up matchmaking entries after creating battle', async () => {
            const entry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);

            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            await service.tryFindMatch(entry.id);

            // Should mark both entries as MATCHED
            expect(prisma.matchmakingEntry.updateMany).toHaveBeenCalledWith({
                where: { id: { in: ['entry-1', 'entry-2'] } },
                data: {
                    status: MatchmakingStatus.MATCHED,
                    matchedAt: expect.any(Date),
                },
            });

            // Should delete matched entries
            expect(prisma.matchmakingEntry.deleteMany).toHaveBeenCalledWith({
                where: { id: { in: ['entry-1', 'entry-2'] } },
            });
        });

        it('should use second players difficulty preference when first has none', async () => {
            const entry = {
                ...baseQueueEntry,
                preferredDifficulty: null,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                preferredDifficulty: Difficulty.EASY,
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);

            prisma.problem.count.mockResolvedValue(2);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            await service.tryFindMatch(entry.id);

            expect(prisma.problem.count).toHaveBeenCalledWith({
                where: { difficulty: Difficulty.EASY },
            });
        });

        it('should notify both players via WebSocket when match is created', async () => {
            const entry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                mmrAtQueue: 1050,
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);
            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockResolvedValue(mockBattle as any);
            battlesService.joinBattle!.mockResolvedValue(mockBattle as any);
            prisma.matchmakingEntry.deleteMany.mockResolvedValue({ count: 2 });

            await service.tryFindMatch(entry.id);

            expect(battlesGateway.emitMatchFound).toHaveBeenCalledTimes(2);
            expect(battlesGateway.emitMatchFound).toHaveBeenCalledWith('user-1', {
                battleId: 'battle-1',
                opponentId: 'user-2',
            });
            expect(battlesGateway.emitMatchFound).toHaveBeenCalledWith('user-2', {
                battleId: 'battle-1',
                opponentId: 'user-1',
            });
        });

        it('should revert entries to QUEUED when battle creation fails', async () => {
            const entry = {
                ...baseQueueEntry,
                status: MatchmakingStatus.QUEUED,
            };
            const candidate = {
                ...baseQueueEntry,
                id: 'entry-2',
                userId: 'user-2',
                status: MatchmakingStatus.QUEUED,
            };

            prisma.matchmakingEntry.findUnique.mockResolvedValue(entry);
            prisma.matchmakingEntry.findMany.mockResolvedValue([candidate]);
            prisma.problem.count.mockResolvedValue(1);
            prisma.problem.findFirst.mockResolvedValue(mockProblem);
            prisma.matchmakingEntry.updateMany.mockResolvedValue({ count: 2 });
            battlesService.createBattle!.mockRejectedValue(new Error('DB error'));

            const result = await service.tryFindMatch(entry.id);

            expect(result).toBeNull();
            expect(prisma.matchmakingEntry.updateMany).toHaveBeenCalledTimes(2);
            expect(prisma.matchmakingEntry.updateMany).toHaveBeenLastCalledWith({
                where: { id: { in: ['entry-1', 'entry-2'] } },
                data: { status: MatchmakingStatus.QUEUED, matchedAt: null },
            });
        });
    });
});
