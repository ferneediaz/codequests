import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../__mocks__/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('UsersService', () => {
    let service: UsersService;
    let prisma: MockPrismaService;

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
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
            expect(result).toEqual(users);
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
                },
            });
            expect(result).toEqual(user);
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

    describe('getStats', () => {
        it('should calculate correct stats and tier', async () => {
            const user = {
                mmr: 1500,
                wins: 15,
                losses: 5,
            };

            prisma.user.findUnique.mockResolvedValue(user);

            const result = await service.getStats('user-123');

            expect(result).toEqual({
                mmr: 1500,
                wins: 15,
                losses: 5,
                totalGames: 20,
                winRate: 75,
                tier: 'Platinum',
            });
        });

        it('should handle zero games', async () => {
            const user = {
                mmr: 1000,
                wins: 0,
                losses: 0,
            };

            prisma.user.findUnique.mockResolvedValue(user);

            const result = await service.getStats('user-123');

            expect(result.totalGames).toBe(0);
            expect(result.winRate).toBe(0);
            expect(result.tier).toBe('Silver');
        });

        it('should throw NotFoundException if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.getStats('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('calculateTier', () => {
        it('should return correct tier for each MMR bracket', () => {
            // Access private method through any type
            const calculateTier = (service as any).calculateTier.bind(service);

            expect(calculateTier(2100)).toBe('Grandmaster');
            expect(calculateTier(2000)).toBe('Grandmaster');
            expect(calculateTier(1900)).toBe('Master');
            expect(calculateTier(1800)).toBe('Master');
            expect(calculateTier(1700)).toBe('Diamond');
            expect(calculateTier(1600)).toBe('Diamond');
            expect(calculateTier(1500)).toBe('Platinum');
            expect(calculateTier(1400)).toBe('Platinum');
            expect(calculateTier(1300)).toBe('Gold');
            expect(calculateTier(1200)).toBe('Gold');
            expect(calculateTier(1100)).toBe('Silver');
            expect(calculateTier(1000)).toBe('Silver');
            expect(calculateTier(900)).toBe('Bronze');
            expect(calculateTier(500)).toBe('Bronze');
        });
    });
});
