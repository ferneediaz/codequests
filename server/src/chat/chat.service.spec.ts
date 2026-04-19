import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';

describe('ChatService', () => {
    let service: ChatService;
    let prisma: MockPrismaService;
    let mockFriendsService: { getFriendIds: jest.Mock };

    const mockUser1 = {
        id: 'user-1',
        username: 'alice',
        avatarUrl: null,
    };

    const mockUser2 = {
        id: 'user-2',
        username: 'bob',
        avatarUrl: 'https://example.com/bob.png',
    };

    const mockConversation = {
        id: 'conv-1',
        type: 'DM',
        participantIds: ['user-1', 'user-2'],
        createdAt: new Date('2026-04-15T10:00:00Z'),
        updatedAt: new Date('2026-04-15T10:00:00Z'),
    };

    const mockMessage = {
        id: 'msg-1',
        senderId: 'user-1',
        content: 'Hello!',
        roomType: 'LOBBY',
        roomId: 'lobby',
        createdAt: new Date('2026-04-15T10:00:00Z'),
        sender: { id: 'user-1', username: 'alice', avatarUrl: null },
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        mockFriendsService = {
            getFriendIds: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: FriendsService, useValue: mockFriendsService },
            ],
        }).compile();

        service = module.get<ChatService>(ChatService);
        prisma = module.get<MockPrismaService>(PrismaService);
    });

    // ============================
    // sendMessage
    // ============================

    describe('sendMessage', () => {
        it('should send a message to lobby successfully', async () => {
            prisma.message.create.mockResolvedValue(mockMessage);

            const result = await service.sendMessage(
                'user-1',
                'LOBBY' as any,
                'lobby',
                'Hello!',
            );

            expect(prisma.message.create).toHaveBeenCalledWith({
                data: {
                    senderId: 'user-1',
                    content: 'Hello!',
                    roomType: 'LOBBY',
                    roomId: 'lobby',
                },
                include: {
                    sender: {
                        select: { id: true, username: true, avatarUrl: true },
                    },
                },
            });
            expect(result.senderUsername).toBe('alice');
            expect(result.content).toBe('Hello!');
        });

        it('should send a message to battle room when user is participant', async () => {
            prisma.battleParticipant.findFirst.mockResolvedValue({
                id: 'bp-1',
                battleId: 'battle-1',
                userId: 'user-1',
            });
            prisma.message.create.mockResolvedValue({
                ...mockMessage,
                roomType: 'BATTLE',
                roomId: 'battle-1',
            });

            const result = await service.sendMessage(
                'user-1',
                'BATTLE' as any,
                'battle-1',
                'gl hf!',
            );

            expect(prisma.battleParticipant.findFirst).toHaveBeenCalledWith({
                where: { battleId: 'battle-1', userId: 'user-1' },
            });
            expect(result).toBeDefined();
        });

        it('should throw ForbiddenException when user is not battle participant', async () => {
            prisma.battleParticipant.findFirst.mockResolvedValue(null);

            await expect(
                service.sendMessage('user-1', 'BATTLE' as any, 'battle-1', 'Hi'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should send a message to DM conversation when user is participant', async () => {
            prisma.conversation.findUnique.mockResolvedValue(mockConversation);
            prisma.message.create.mockResolvedValue({
                ...mockMessage,
                roomType: 'DM',
                roomId: 'conv-1',
            });

            const result = await service.sendMessage(
                'user-1',
                'DM' as any,
                'conv-1',
                'Hey Bob!',
            );

            expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
                where: { id: 'conv-1' },
            });
            expect(result).toBeDefined();
        });

        it('should throw ForbiddenException when user is not DM participant', async () => {
            prisma.conversation.findUnique.mockResolvedValue({
                ...mockConversation,
                participantIds: ['user-3', 'user-4'],
            });

            await expect(
                service.sendMessage('user-1', 'DM' as any, 'conv-1', 'Hi'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException when DM conversation not found', async () => {
            prisma.conversation.findUnique.mockResolvedValue(null);

            await expect(
                service.sendMessage('user-1', 'DM' as any, 'nonexistent', 'Hi'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ============================
    // getMessages
    // ============================

    describe('getMessages', () => {
        it('should return messages with pagination (no cursor)', async () => {
            const messages = [
                { ...mockMessage, id: 'msg-2', createdAt: new Date('2026-04-15T10:01:00Z') },
                { ...mockMessage, id: 'msg-1', createdAt: new Date('2026-04-15T10:00:00Z') },
            ];
            prisma.message.findMany.mockResolvedValue(messages);

            const result = await service.getMessages('LOBBY' as any, 'lobby');

            expect(prisma.message.findMany).toHaveBeenCalledWith({
                where: { roomType: 'LOBBY', roomId: 'lobby' },
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: {
                    sender: {
                        select: { id: true, username: true, avatarUrl: true },
                    },
                },
            });
            // Messages should be reversed (oldest first)
            expect(result.messages[0].id).toBe('msg-1');
            expect(result.messages[1].id).toBe('msg-2');
            expect(result.nextCursor).toBeNull();
        });

        it('should return messages with cursor for pagination', async () => {
            const messages = Array.from({ length: 50 }, (_, i) => ({
                ...mockMessage,
                id: `msg-${i}`,
                createdAt: new Date(Date.now() - i * 1000),
            }));
            prisma.message.findMany.mockResolvedValue(messages);

            const result = await service.getMessages(
                'LOBBY' as any,
                'lobby',
                'msg-cursor',
                50,
            );

            expect(prisma.message.findMany).toHaveBeenCalledWith({
                where: { roomType: 'LOBBY', roomId: 'lobby' },
                orderBy: { createdAt: 'desc' },
                take: 50,
                skip: 1,
                cursor: { id: 'msg-cursor' },
                include: {
                    sender: {
                        select: { id: true, username: true, avatarUrl: true },
                    },
                },
            });
            // When we get exactly limit messages, there's a next cursor
            // nextCursor is messages[0].id from the desc-ordered array (the oldest fetched message)
            expect(result.nextCursor).toBe('msg-49');
        });

        it('should return empty array for room with no messages', async () => {
            prisma.message.findMany.mockResolvedValue([]);

            const result = await service.getMessages('LOBBY' as any, 'lobby');

            expect(result.messages).toEqual([]);
            expect(result.nextCursor).toBeNull();
        });
    });

    // ============================
    // createConversation
    // ============================

    describe('createConversation', () => {
        it('should create a DM conversation between friends', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            mockFriendsService.getFriendIds.mockResolvedValue(['user-2']);
            prisma.conversation.findFirst.mockResolvedValue(null);
            prisma.conversation.create.mockResolvedValue(mockConversation);
            prisma.user.findMany.mockResolvedValue([mockUser1, mockUser2]);
            prisma.message.findFirst.mockResolvedValue(null);

            const result = await service.createConversation('user-1', 'user-2');

            expect(prisma.conversation.create).toHaveBeenCalledWith({
                data: {
                    type: 'DM',
                    participantIds: ['user-1', 'user-2'],
                },
            });
            expect(result.id).toBe('conv-1');
            expect(result.participants).toHaveLength(2);
        });

        it('should return existing conversation if already exists', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            mockFriendsService.getFriendIds.mockResolvedValue(['user-2']);
            prisma.conversation.findFirst.mockResolvedValue(mockConversation);
            prisma.user.findMany.mockResolvedValue([mockUser1, mockUser2]);
            prisma.message.findFirst.mockResolvedValue(null);

            const result = await service.createConversation('user-1', 'user-2');

            expect(prisma.conversation.create).not.toHaveBeenCalled();
            expect(result.id).toBe('conv-1');
        });

        it('should throw BadRequestException when creating conversation with self', async () => {
            await expect(
                service.createConversation('user-1', 'user-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException when target user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.createConversation('user-1', 'user-999'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when users are not friends', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            mockFriendsService.getFriendIds.mockResolvedValue([]);

            await expect(
                service.createConversation('user-1', 'user-2'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ============================
    // getConversations
    // ============================

    describe('getConversations', () => {
        it('should return user conversations with last message', async () => {
            prisma.conversation.findMany.mockResolvedValue([mockConversation]);
            prisma.user.findMany.mockResolvedValue([mockUser1, mockUser2]);
            prisma.message.findFirst.mockResolvedValue({
                content: 'Last message',
                senderId: 'user-2',
                createdAt: new Date('2026-04-15T12:00:00Z'),
            });

            const result = await service.getConversations('user-1');

            expect(result).toHaveLength(1);
            expect(result[0].participants).toHaveLength(2);
            expect(result[0].lastMessage?.content).toBe('Last message');
        });

        it('should return empty array when user has no conversations', async () => {
            prisma.conversation.findMany.mockResolvedValue([]);

            const result = await service.getConversations('user-1');

            expect(result).toEqual([]);
        });
    });

    // ============================
    // getConversation
    // ============================

    describe('getConversation', () => {
        it('should return conversation details for participant', async () => {
            prisma.conversation.findUnique.mockResolvedValue(mockConversation);
            prisma.user.findMany.mockResolvedValue([mockUser1, mockUser2]);
            prisma.message.findFirst.mockResolvedValue(null);

            const result = await service.getConversation('conv-1', 'user-1');

            expect(result.id).toBe('conv-1');
            expect(result.participants).toHaveLength(2);
        });

        it('should throw NotFoundException when conversation not found', async () => {
            prisma.conversation.findUnique.mockResolvedValue(null);

            await expect(
                service.getConversation('nonexistent', 'user-1'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when user is not participant', async () => {
            prisma.conversation.findUnique.mockResolvedValue({
                ...mockConversation,
                participantIds: ['user-3', 'user-4'],
            });

            await expect(
                service.getConversation('conv-1', 'user-1'),
            ).rejects.toThrow(ForbiddenException);
        });
    });
});
