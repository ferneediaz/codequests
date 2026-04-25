import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../__mocks__/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { getRankTier } from '../common/utils/rank-tiers';
import { PracticeService } from '../practice/practice.service';

describe('UsersService', () => {
    let service: UsersService;
    let prisma: MockPrismaService;

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();
        const mockPractice = {
            getMyStats: jest.fn().mockResolvedValue({
                totalAttempts: 0,
                totalSolved: 0,
                solveRate: 0,
                topics: [],
                byDifficulty: { EASY: 0, MEDIUM: 0, HARD: 0 },
                isTracked: false,
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: PracticeService,
                    useValue: mockPractice,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        prisma = module.get<MockPrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return users sorted by MMR', async () => {
            const users = [
                {
                    id: 'user-1',
                    username: 'topplayer',
                    avatarUrl: null,
                    mmr: 1800,
                    wins: 50,
                    losses: 20,
                    clan: { tag: 'PRO', name: 'Pro Clan' },
                },
                {
                    id: 'user-2',
                    username: 'midplayer',
                    avatarUrl: null,
                    mmr: 1200,
                    wins: 20,
                    losses: 15,
                    clan: null,
                },
            ];

            prisma.user.findMany.mockResolvedValue(users);

            const result = await service.findAll();

            expect(prisma.user.findMany).toHaveBeenCalledWith({
                take: 50,
                skip: 0,
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
            expect(result[0]).toEqual({ ...users[0], tier: getRankTier(1800) });
            expect(result[1]).toEqual({ ...users[1], tier: getRankTier(1200) });
        });

        it('should respect limit and offset options', async () => {
            prisma.user.findMany.mockResolvedValue([]);

            await service.findAll({ limit: 10, offset: 20 });

            expect(prisma.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 10,
                    skip: 20,
                }),
            );
        });
    });

    describe('findOne', () => {
        it('should return user with clan and battles', async () => {
            const user = {
                id: 'user-123',
                email: 'test@example.com',
                username: 'testuser',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 5,
                losses: 3,
                clanId: null,
                clan: null,
                battles: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            prisma.user.findUnique.mockResolvedValue(user);

            const result = await service.findOne('user-123');

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 'user-123' },
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
            expect(result).toEqual({ ...user, tier: getRankTier(1000) });
        });

        it('should throw NotFoundException if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.findOne('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('findByUsername', () => {
        it('should return user by username', async () => {
            const user = {
                id: 'user-123',
                email: 'test@example.com',
                username: 'testuser',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: null,
                clan: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            prisma.user.findUnique.mockResolvedValue(user);

            const result = await service.findByUsername('testuser');

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { username: 'testuser' },
                include: { clan: true },
            });
            expect(result).toEqual(user);
        });

        it('should throw NotFoundException if username not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.findByUsername('invalid')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('update', () => {
        it('should update user successfully', async () => {
            const existingUser = {
                id: 'user-123',
                email: 'test@example.com',
                username: 'oldname',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedUser = { ...existingUser, username: 'newname' };

            prisma.user.findUnique
                .mockResolvedValueOnce(existingUser) // First call: check if user exists
                .mockResolvedValueOnce(null); // Second call: check if username is taken

            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.update('user-123', { username: 'newname' });

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-123' },
                data: { username: 'newname' },
            });
            expect(result.username).toBe('newname');
        });

        it('should throw NotFoundException if user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.update('nonexistent', { username: 'newname' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ConflictException if username is taken', async () => {
            const existingUser = {
                id: 'user-123',
                username: 'oldname',
                email: 'test@example.com',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const otherUser = {
                id: 'user-456',
                username: 'taken',
                email: 'other@example.com',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            prisma.user.findUnique
                .mockResolvedValueOnce(existingUser)
                .mockResolvedValueOnce(otherUser);

            await expect(
                service.update('user-123', { username: 'taken' }),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('getMatchHistory', () => {
        it('should return flattened match rows with usernames and winner fields for the client', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'u1', username: 'a' });
            const p1 = {
                id: 'bp-1',
                userId: 'u1',
                battleId: 'b-1',
                user: { id: 'u1', username: 'alice', mmr: 1000, avatarUrl: null },
            };
            const p2 = {
                id: 'bp-2',
                userId: 'u2',
                battleId: 'b-1',
                user: { id: 'u2', username: 'bob', mmr: 1000, avatarUrl: null },
            };
            prisma.battleParticipant.findMany.mockResolvedValue([
                {
                    battle: {
                        id: 'b-1',
                        mode: 'ONE_V_ONE',
                        status: 'COMPLETED',
                        winnerId: 'u1',
                        winningTeam: null,
                        startedAt: new Date('2024-01-15T10:00:00Z'),
                        endedAt: new Date('2024-01-15T10:10:00Z'),
                        createdAt: new Date('2024-01-15T09:00:00Z'),
                        timeLimitMinutes: 10,
                        participants: [
                            {
                                id: p1.id,
                                userId: p1.userId,
                                teamId: null,
                                code: null,
                                language: 'typescript',
                                testsPassed: 2,
                                totalTests: 2,
                                pointsEarned: 0,
                                isReady: true,
                                submittedAt: new Date('2024-01-15T10:05:00Z'),
                                mmrChange: 12,
                                user: p1.user,
                            },
                            {
                                id: p2.id,
                                userId: p2.userId,
                                teamId: null,
                                code: null,
                                language: 'python',
                                testsPassed: 1,
                                totalTests: 2,
                                pointsEarned: 0,
                                isReady: true,
                                submittedAt: new Date('2024-01-15T10:08:00Z'),
                                mmrChange: -12,
                                user: p2.user,
                            },
                        ],
                    },
                },
            ]);

            const out = await service.getMatchHistory('u1', 20);

            expect(out).toHaveLength(1);
            expect(out[0]).toMatchObject({
                id: 'b-1',
                mode: 'ONE_V_ONE',
                status: 'COMPLETED',
                winnerId: 'u1',
                timeLimitMinutes: 10,
            });
            expect(out[0].participants).toEqual([
                expect.objectContaining({
                    userId: 'u1',
                    username: 'alice',
                    language: 'typescript',
                    testsPassed: 2,
                }),
                expect.objectContaining({
                    userId: 'u2',
                    username: 'bob',
                }),
            ]);
        });
    });

    describe('getStats', () => {
        it('should calculate correct stats and tier', async () => {
            const user = {
                id: 'user-123',
                username: 'tester',
                mmr: 1500,
            };

            prisma.user.findUnique.mockResolvedValue(user);
            const winRows = Array.from({ length: 15 }, () => ({
                teamId: null,
                battle: {
                    mode: 'ONE_V_ONE' as const,
                    winnerId: 'user-123',
                    winningTeam: null,
                },
            }));
            const lossRows = Array.from({ length: 5 }, () => ({
                teamId: null,
                battle: {
                    mode: 'ONE_V_ONE' as const,
                    winnerId: 'opponent-1',
                    winningTeam: null,
                },
            }));
            prisma.battleParticipant.findMany.mockResolvedValue([
                ...winRows,
                ...lossRows,
            ]);

            const result = await service.getStats('user-123');

            expect(result).toMatchObject({
                id: 'user-123',
                username: 'tester',
                mmr: 1500,
                wins: 15,
                losses: 5,
                totalGames: 20,
                winRate: 75,
                tier: getRankTier(1500),
            });
            expect(result.practice).toBeDefined();
            expect(result.practice.isTracked).toBe(false);
        });

        it('should handle zero games', async () => {
            const user = {
                id: 'user-123',
                username: 'tester',
                mmr: 1000,
            };

            prisma.user.findUnique.mockResolvedValue(user);
            prisma.battleParticipant.findMany.mockResolvedValue([]);

            const result = await service.getStats('user-123');

            expect(result.totalGames).toBe(0);
            expect(result.winRate).toBe(0);
            expect(result.tier).toEqual(getRankTier(1000));
        });

        it('should throw NotFoundException if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.getStats('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getRankTier', () => {
        it.each([
            [799, 'Bug', '🐛', '#22c55e'],
            [0, 'Bug', '🐛', '#22c55e'],
            [500, 'Bug', '🐛', '#22c55e'],
            [800, 'Intern', '📎', '#9ca3af'],
            [999, 'Intern', '📎', '#9ca3af'],
            [1000, 'Copy Paster', '📋', '#cd7f32'],
            [1199, 'Copy Paster', '📋', '#cd7f32'],
            [1200, 'Stack Overflow Andy', '🔍', '#c0c0c0'],
            [1399, 'Stack Overflow Andy', '🔍', '#c0c0c0'],
            [1400, 'Code Monkey', '🐒', '#ffd700'],
            [1599, 'Code Monkey', '🐒', '#ffd700'],
            [1600, '10x Dev', '⚡', '#3b82f6'],
            [1899, '10x Dev', '⚡', '#3b82f6'],
            [1900, 'Cracked', '💀', '#ef4444'],
            [2500, 'Cracked', '💀', '#ef4444'],
        ])('mmr %i should be %s %s', (mmr, name, icon, color) => {
            const tier = getRankTier(mmr);
            expect(tier.name).toBe(name);
            expect(tier.icon).toBe(icon);
            expect(tier.color).toBe(color);
        });

        it('should return minMmr and maxMmr for each tier', () => {
            const bug = getRankTier(500);
            expect(bug.minMmr).toBe(-Infinity);
            expect(bug.maxMmr).toBe(799);

            const intern = getRankTier(800);
            expect(intern.minMmr).toBe(800);
            expect(intern.maxMmr).toBe(999);

            const cracked = getRankTier(1900);
            expect(cracked.minMmr).toBe(1900);
            expect(cracked.maxMmr).toBeNull();
        });
    });
});
