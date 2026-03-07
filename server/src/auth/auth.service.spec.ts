import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../__mocks__/prisma.service';

describe('AuthService', () => {
    let service: AuthService;
    let prisma: MockPrismaService;

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        prisma = module.get<MockPrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('syncUser', () => {
        it('should create a new user when user does not exist', async () => {
            const userId = 'user-123';
            const email = 'test@example.com';
            const username = 'testuser';
            const role = 'user';

            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({
                id: userId,
                email,
                username,
                role,
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.syncUser(userId, email, username, role);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: userId },
            });
            expect(prisma.user.create).toHaveBeenCalledWith({
                data: {
                    id: userId,
                    email,
                    username,
                    role,
                },
            });
            expect(result.email).toBe(email);
            expect(result.username).toBe(username);
            expect(result.role).toBe(role);
        });

        it('should generate username from email if not provided', async () => {
            const userId = 'user-456';
            const email = 'newuser@example.com';

            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({
                id: userId,
                email,
                username: 'newuser',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await service.syncUser(userId, email);

            expect(prisma.user.create).toHaveBeenCalledWith({
                data: {
                    id: userId,
                    email,
                    username: 'newuser',
                    role: 'user',
                },
            });
        });

        it('should return existing user without updating if role is the same', async () => {
            const userId = 'user-789';
            const email = 'existing@example.com';
            const existingUser = {
                id: userId,
                email,
                username: 'existing',
                role: 'user',
                avatarUrl: null,
                mmr: 1200,
                wins: 5,
                losses: 3,
                clanId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            prisma.user.findUnique.mockResolvedValue(existingUser);

            const result = await service.syncUser(userId, email, undefined, 'user');

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: userId },
            });
            expect(prisma.user.update).not.toHaveBeenCalled();
            expect(result).toEqual(existingUser);
        });

        it('should update role if different from existing user', async () => {
            const userId = 'user-admin';
            const email = 'admin@example.com';
            const existingUser = {
                id: userId,
                email,
                username: 'admin',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedUser = { ...existingUser, role: 'admin' };

            prisma.user.findUnique.mockResolvedValue(existingUser);
            prisma.user.update.mockResolvedValue(updatedUser);

            const result = await service.syncUser(userId, email, undefined, 'admin');

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { role: 'admin' },
            });
            expect(result.role).toBe('admin');
        });
    });

    describe('getUser', () => {
        it('should return user with clan relationship', async () => {
            const userId = 'user-123';
            const user = {
                id: userId,
                email: 'test@example.com',
                username: 'testuser',
                role: 'user',
                avatarUrl: null,
                mmr: 1000,
                wins: 0,
                losses: 0,
                clanId: 'clan-1',
                clan: {
                    id: 'clan-1',
                    name: 'Test Clan',
                    tag: 'TEST',
                    ownerId: 'owner-id',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            prisma.user.findUnique.mockResolvedValue(user);

            const result = await service.getUser(userId);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: userId },
                include: { clan: true },
            });
            expect(result).toEqual(user);
            expect(result?.clan).toBeDefined();
        });

        it('should return user without clan if not member', async () => {
            const userId = 'user-solo';
            const user = {
                id: userId,
                email: 'solo@example.com',
                username: 'soloplayer',
                role: 'user',
                avatarUrl: null,
                mmr: 1500,
                wins: 10,
                losses: 5,
                clanId: null,
                clan: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            prisma.user.findUnique.mockResolvedValue(user);

            const result = await service.getUser(userId);

            expect(result?.clan).toBeNull();
        });
    });
});
