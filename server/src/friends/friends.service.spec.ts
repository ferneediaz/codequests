import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import {
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';

describe('FriendsService', () => {
    let service: FriendsService;
    let prisma: MockPrismaService;

    const mockUser1 = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@test.com',
        avatarUrl: null,
        mmr: 1200,
    };

    const mockUser2 = {
        id: 'user-2',
        username: 'bob',
        email: 'bob@test.com',
        avatarUrl: 'https://example.com/bob.png',
        mmr: 1400,
    };

    const mockFriendship = {
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'PENDING',
        createdAt: new Date('2026-04-15T10:00:00Z'),
        updatedAt: new Date('2026-04-15T10:00:00Z'),
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FriendsService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<FriendsService>(FriendsService);
        prisma = module.get<MockPrismaService>(PrismaService);
    });

    // ============================
    // sendRequest
    // ============================

    describe('sendRequest', () => {
        it('should send a friend request successfully', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.friendship.findFirst.mockResolvedValue(null);
            prisma.friendship.create.mockResolvedValue({
                ...mockFriendship,
                addressee: { id: mockUser2.id, username: mockUser2.username, avatarUrl: mockUser2.avatarUrl, mmr: mockUser2.mmr },
            });

            const result = await service.sendRequest('user-1', 'bob');

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { username: 'bob' },
            });
            expect(prisma.friendship.findFirst).toHaveBeenCalled();
            expect(prisma.friendship.create).toHaveBeenCalledWith({
                data: {
                    requesterId: 'user-1',
                    addresseeId: 'user-2',
                    status: 'PENDING',
                },
                include: {
                    addressee: {
                        select: { id: true, username: true, avatarUrl: true, mmr: true },
                    },
                },
            });
            expect(result.addressee.username).toBe('bob');
        });

        it('should throw NotFoundException when addressee not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.sendRequest('user-1', 'nonexistent'))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when sending to self', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);

            await expect(service.sendRequest('user-1', 'alice'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw ConflictException when already friends', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.friendship.findFirst.mockResolvedValue({
                ...mockFriendship,
                status: 'ACCEPTED',
            });

            await expect(service.sendRequest('user-1', 'bob'))
                .rejects.toThrow(ConflictException);
        });

        it('should throw ConflictException when request already pending', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.friendship.findFirst.mockResolvedValue({
                ...mockFriendship,
                status: 'PENDING',
            });

            await expect(service.sendRequest('user-1', 'bob'))
                .rejects.toThrow(ConflictException);
        });

        it('should delete declined record and create new request via transaction', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.friendship.findFirst.mockResolvedValue({
                ...mockFriendship,
                status: 'DECLINED',
            });

            const newFriendship = {
                ...mockFriendship,
                id: 'friendship-2',
                addressee: { id: mockUser2.id, username: mockUser2.username, avatarUrl: mockUser2.avatarUrl, mmr: mockUser2.mmr },
            };

            // $transaction receives a callback; execute it with a mock tx
            const mockTx = {
                friendship: {
                    delete: jest.fn().mockResolvedValue({}),
                    create: jest.fn().mockResolvedValue(newFriendship),
                },
            };
            prisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

            const result = await service.sendRequest('user-1', 'bob');

            expect(prisma.$transaction).toHaveBeenCalled();
            expect(mockTx.friendship.delete).toHaveBeenCalledWith({
                where: { id: 'friendship-1' },
            });
            expect(mockTx.friendship.create).toHaveBeenCalledWith({
                data: {
                    requesterId: 'user-1',
                    addresseeId: 'user-2',
                    status: 'PENDING',
                },
                include: {
                    addressee: {
                        select: { id: true, username: true, avatarUrl: true, mmr: true },
                    },
                },
            });
            expect(result.id).toBe('friendship-2');
        });
    });

    // ============================
    // acceptRequest
    // ============================

    describe('acceptRequest', () => {
        it('should accept a pending friend request', async () => {
            prisma.friendship.findUnique.mockResolvedValue(mockFriendship);
            prisma.friendship.update.mockResolvedValue({
                ...mockFriendship,
                status: 'ACCEPTED',
                requester: { id: mockUser1.id, username: mockUser1.username, avatarUrl: mockUser1.avatarUrl, mmr: mockUser1.mmr },
            });

            const result = await service.acceptRequest('user-2', 'friendship-1');

            expect(prisma.friendship.update).toHaveBeenCalledWith({
                where: { id: 'friendship-1' },
                data: { status: 'ACCEPTED' },
                include: {
                    requester: {
                        select: { id: true, username: true, avatarUrl: true, mmr: true },
                    },
                },
            });
            expect(result.status).toBe('ACCEPTED');
        });

        it('should throw NotFoundException when friendship not found', async () => {
            prisma.friendship.findUnique.mockResolvedValue(null);

            await expect(service.acceptRequest('user-2', 'nonexistent'))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when user is not the addressee', async () => {
            prisma.friendship.findUnique.mockResolvedValue(mockFriendship);

            // user-1 is the requester, not the addressee
            await expect(service.acceptRequest('user-1', 'friendship-1'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when request is not pending', async () => {
            prisma.friendship.findUnique.mockResolvedValue({
                ...mockFriendship,
                status: 'ACCEPTED',
            });

            await expect(service.acceptRequest('user-2', 'friendship-1'))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ============================
    // declineRequest
    // ============================

    describe('declineRequest', () => {
        it('should decline a pending friend request', async () => {
            prisma.friendship.findUnique.mockResolvedValue(mockFriendship);
            prisma.friendship.update.mockResolvedValue({
                ...mockFriendship,
                status: 'DECLINED',
            });

            const result = await service.declineRequest('user-2', 'friendship-1');

            expect(prisma.friendship.update).toHaveBeenCalledWith({
                where: { id: 'friendship-1' },
                data: { status: 'DECLINED' },
            });
            expect(result.status).toBe('DECLINED');
        });

        it('should throw NotFoundException when friendship not found', async () => {
            prisma.friendship.findUnique.mockResolvedValue(null);

            await expect(service.declineRequest('user-2', 'nonexistent'))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when user is not the addressee', async () => {
            prisma.friendship.findUnique.mockResolvedValue(mockFriendship);

            await expect(service.declineRequest('user-1', 'friendship-1'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when request is not pending', async () => {
            prisma.friendship.findUnique.mockResolvedValue({
                ...mockFriendship,
                status: 'ACCEPTED',
            });

            await expect(service.declineRequest('user-2', 'friendship-1'))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ============================
    // removeFriend
    // ============================

    describe('removeFriend', () => {
        it('should remove an accepted friendship', async () => {
            const acceptedFriendship = { ...mockFriendship, status: 'ACCEPTED' };
            prisma.friendship.findFirst.mockResolvedValue(acceptedFriendship);
            prisma.friendship.delete.mockResolvedValue(acceptedFriendship);

            const result = await service.removeFriend('user-1', 'user-2');

            expect(prisma.friendship.findFirst).toHaveBeenCalledWith({
                where: {
                    status: 'ACCEPTED',
                    OR: [
                        { requesterId: 'user-1', addresseeId: 'user-2' },
                        { requesterId: 'user-2', addresseeId: 'user-1' },
                    ],
                },
            });
            expect(prisma.friendship.delete).toHaveBeenCalledWith({
                where: { id: 'friendship-1' },
            });
            expect(result).toEqual({ success: true });
        });

        it('should throw NotFoundException when friendship not found', async () => {
            prisma.friendship.findFirst.mockResolvedValue(null);

            await expect(service.removeFriend('user-1', 'user-3'))
                .rejects.toThrow(NotFoundException);
        });
    });

    // ============================
    // getFriends
    // ============================

    describe('getFriends', () => {
        it('should return list of accepted friends', async () => {
            prisma.friendship.findMany.mockResolvedValue([
                {
                    id: 'friendship-1',
                    requesterId: 'user-1',
                    addresseeId: 'user-2',
                    status: 'ACCEPTED',
                    requester: { id: 'user-1', username: 'alice', avatarUrl: null, mmr: 1200 },
                    addressee: { id: 'user-2', username: 'bob', avatarUrl: 'https://example.com/bob.png', mmr: 1400 },
                },
                {
                    id: 'friendship-2',
                    requesterId: 'user-3',
                    addresseeId: 'user-1',
                    status: 'ACCEPTED',
                    requester: { id: 'user-3', username: 'charlie', avatarUrl: null, mmr: 1100 },
                    addressee: { id: 'user-1', username: 'alice', avatarUrl: null, mmr: 1200 },
                },
            ]);

            const result = await service.getFriends('user-1');

            expect(result).toHaveLength(2);
            // When user-1 is the requester, return the addressee
            expect(result[0].username).toBe('bob');
            expect(result[0].friendshipId).toBe('friendship-1');
            // When user-1 is the addressee, return the requester
            expect(result[1].username).toBe('charlie');
            expect(result[1].friendshipId).toBe('friendship-2');
        });

        it('should return empty array when no friends', async () => {
            prisma.friendship.findMany.mockResolvedValue([]);

            const result = await service.getFriends('user-1');

            expect(result).toHaveLength(0);
        });
    });

    // ============================
    // getPendingRequests
    // ============================

    describe('getPendingRequests', () => {
        it('should return pending requests where user is addressee', async () => {
            prisma.friendship.findMany.mockResolvedValue([
                {
                    id: 'friendship-3',
                    requesterId: 'user-3',
                    addresseeId: 'user-1',
                    status: 'PENDING',
                    createdAt: new Date('2026-04-16T10:00:00Z'),
                    requester: { id: 'user-3', username: 'charlie', avatarUrl: null, mmr: 1100 },
                },
            ]);

            const result = await service.getPendingRequests('user-1');

            expect(result).toHaveLength(1);
            expect(result[0].requester.username).toBe('charlie');
            expect(prisma.friendship.findMany).toHaveBeenCalledWith({
                where: {
                    addresseeId: 'user-1',
                    status: 'PENDING',
                },
                include: {
                    requester: {
                        select: { id: true, username: true, avatarUrl: true, mmr: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should return empty array when no pending requests', async () => {
            prisma.friendship.findMany.mockResolvedValue([]);

            const result = await service.getPendingRequests('user-1');

            expect(result).toHaveLength(0);
        });
    });

    // ============================
    // getFriendIds
    // ============================

    describe('getFriendIds', () => {
        it('should return IDs of accepted friends', async () => {
            prisma.friendship.findMany.mockResolvedValue([
                { requesterId: 'user-1', addresseeId: 'user-2' },
                { requesterId: 'user-3', addresseeId: 'user-1' },
            ]);

            const result = await service.getFriendIds('user-1');

            expect(result).toEqual(['user-2', 'user-3']);
            expect(prisma.friendship.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'ACCEPTED',
                    OR: [
                        { requesterId: 'user-1' },
                        { addresseeId: 'user-1' },
                    ],
                },
                select: {
                    requesterId: true,
                    addresseeId: true,
                },
            });
        });

        it('should return empty array when no friends', async () => {
            prisma.friendship.findMany.mockResolvedValue([]);

            const result = await service.getFriendIds('user-1');

            expect(result).toEqual([]);
        });
    });
});
