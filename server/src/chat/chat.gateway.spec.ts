import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { WsAuthGuard } from '../websockets/ws-auth.guard';
import { ChatService } from './chat.service';
import { JwtVerificationService } from '../auth/jwt-verification.service';

describe('ChatGateway', () => {
    let gateway: ChatGateway;
    let mockChatService: {
        sendMessage: jest.Mock;
        getMessages: jest.Mock;
        createConversation: jest.Mock;
        getConversations: jest.Mock;
        getConversation: jest.Mock;
        validateRoomAccess: jest.Mock;
    };
    let mockServer: {
        to: jest.Mock;
        emit: jest.Mock;
    };
    let mockJwtVerificationService: {
        verifyToken: jest.Mock;
        verifyAndGetUser: jest.Mock;
    };

    const mockUser = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@test.com',
        avatarUrl: null,
        mmr: 1000,
    };

    const createMockSocket = (userId?: string, socketId?: string): any => {
        const id =
            socketId ||
            `socket-${Math.random().toString(36).substr(2, 9)}`;
        const roomsSet = new Set<string>();

        return {
            id,
            handshake: {
                auth: userId ? { token: `valid-jwt-for-${userId}` } : {},
                query: {},
                headers: {},
            },
            data: userId ? { user: { ...mockUser, id: userId } } : {},
            join: jest.fn().mockImplementation((room: string) =>
                roomsSet.add(room),
            ),
            leave: jest.fn().mockImplementation((room: string) =>
                roomsSet.delete(room),
            ),
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
            disconnect: jest.fn(),
            rooms: roomsSet,
        };
    };

    beforeEach(async () => {
        mockChatService = {
            sendMessage: jest.fn(),
            getMessages: jest.fn(),
            createConversation: jest.fn(),
            getConversations: jest.fn(),
            getConversation: jest.fn(),
            validateRoomAccess: jest.fn().mockResolvedValue(undefined),
        };

        mockJwtVerificationService = {
            verifyToken: jest.fn(),
            verifyAndGetUser: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                { provide: ChatService, useValue: mockChatService },
                {
                    provide: JwtVerificationService,
                    useValue: mockJwtVerificationService,
                },
                {
                    provide: WsAuthGuard,
                    useValue: { canActivate: jest.fn().mockReturnValue(true) },
                },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);

        // Mock server
        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        };
        gateway.server = mockServer as any;
    });

    // ============================
    // Connection Handling
    // ============================

    describe('Connection Handling', () => {
        it('should authenticate client and auto-join lobby on connect', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(
                mockUser,
            );

            await gateway.handleConnection(client);

            expect(
                mockJwtVerificationService.verifyAndGetUser,
            ).toHaveBeenCalledWith('valid-jwt-for-user-1');
            expect(client.join).toHaveBeenCalledWith('lobby');
            expect(gateway.getConnectedClients().size).toBe(1);
        });

        it('should disconnect client without token', async () => {
            const client = createMockSocket();
            client.handshake.auth = {};

            await gateway.handleConnection(client);

            expect(client.disconnect).toHaveBeenCalled();
            expect(gateway.getConnectedClients().size).toBe(0);
        });

        it('should disconnect client with invalid token', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(
                null,
            );

            await gateway.handleConnection(client);

            expect(client.disconnect).toHaveBeenCalled();
        });
    });

    // ============================
    // Disconnect Handling
    // ============================

    describe('Disconnect Handling', () => {
        it('should clean up client tracking on disconnect', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(
                mockUser,
            );

            await gateway.handleConnection(client);
            expect(gateway.getConnectedClients().size).toBe(1);

            gateway.handleDisconnect(client);
            expect(gateway.getConnectedClients().size).toBe(0);
            expect(gateway.getSocketByUserId('user-1')).toBeUndefined();
        });
    });

    // ============================
    // chat.send
    // ============================

    describe('chat.send', () => {
        it('should broadcast message to room on successful send', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            const sentMessage = {
                id: 'msg-1',
                senderId: 'user-1',
                senderUsername: 'alice',
                senderAvatarUrl: null,
                content: 'Hello lobby!',
                roomType: 'LOBBY',
                roomId: 'lobby',
                createdAt: new Date(),
            };
            mockChatService.sendMessage.mockResolvedValue(sentMessage);

            const result = await gateway.handleSendMessage(client, {
                roomType: 'LOBBY' as any,
                roomId: 'lobby',
                content: 'Hello lobby!',
            });

            expect(mockChatService.sendMessage).toHaveBeenCalledWith(
                'user-1',
                'LOBBY',
                'lobby',
                'Hello lobby!',
            );
            expect(mockServer.to).toHaveBeenCalledWith('lobby');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'chat.message',
                sentMessage,
            );
            expect(result!.success).toBe(true);
        });

        it('should broadcast message to battle room', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            const sentMessage = {
                id: 'msg-2',
                senderId: 'user-1',
                senderUsername: 'alice',
                content: 'gl hf',
                roomType: 'BATTLE',
                roomId: 'battle-1',
                createdAt: new Date(),
            };
            mockChatService.sendMessage.mockResolvedValue(sentMessage);

            await gateway.handleSendMessage(client, {
                roomType: 'BATTLE' as any,
                roomId: 'battle-1',
                content: 'gl hf',
            });

            expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
        });

        it('should broadcast message to DM room', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            const sentMessage = {
                id: 'msg-3',
                senderId: 'user-1',
                senderUsername: 'alice',
                content: 'Hey Bob',
                roomType: 'DM',
                roomId: 'conv-1',
                createdAt: new Date(),
            };
            mockChatService.sendMessage.mockResolvedValue(sentMessage);

            await gateway.handleSendMessage(client, {
                roomType: 'DM' as any,
                roomId: 'conv-1',
                content: 'Hey Bob',
            });

            expect(mockServer.to).toHaveBeenCalledWith('dm:conv-1');
        });

        it('should return error for empty content', async () => {
            const client = createMockSocket('user-1', 'socket-1');

            await gateway.handleSendMessage(client, {
                roomType: 'LOBBY' as any,
                roomId: 'lobby',
                content: '',
            });

            expect(client.emit).toHaveBeenCalledWith('error', {
                message:
                    'Message content must be between 1 and 1000 characters',
            });
        });

        it('should return error for content exceeding 1000 chars', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            const longContent = 'a'.repeat(1001);

            await gateway.handleSendMessage(client, {
                roomType: 'LOBBY' as any,
                roomId: 'lobby',
                content: longContent,
            });

            expect(client.emit).toHaveBeenCalledWith('error', {
                message:
                    'Message content must be between 1 and 1000 characters',
            });
        });

        it('should return error when user is not authenticated', async () => {
            const client = createMockSocket();
            client.data = {};

            await gateway.handleSendMessage(client, {
                roomType: 'LOBBY' as any,
                roomId: 'lobby',
                content: 'Hello!',
            });

            expect(client.emit).toHaveBeenCalledWith('error', {
                message: 'Not authenticated',
            });
        });

        it('should handle service errors gracefully', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            mockChatService.sendMessage.mockRejectedValue(
                new Error('You are not a participant of this battle'),
            );

            const result = await gateway.handleSendMessage(client, {
                roomType: 'BATTLE' as any,
                roomId: 'battle-1',
                content: 'Hello!',
            });

            expect(result!.success).toBe(false);
            expect(client.emit).toHaveBeenCalledWith('error', {
                message: 'An error occurred while sending the message',
            });
        });
    });

    // ============================
    // chat.join_room
    // ============================

    describe('chat.join_room', () => {
        it('should join room and notify members', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            mockChatService.validateRoomAccess.mockResolvedValue(undefined);

            const result = await gateway.handleJoinRoom(client, {
                roomType: 'BATTLE' as any,
                roomId: 'battle-1',
            });

            expect(mockChatService.validateRoomAccess).toHaveBeenCalledWith(
                'user-1',
                'BATTLE',
                'battle-1',
            );
            expect(client.join).toHaveBeenCalledWith('battle:battle-1');
            expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'chat.user_joined',
                {
                    userId: 'user-1',
                    username: 'alice',
                    roomType: 'BATTLE',
                    roomId: 'battle-1',
                },
            );
            expect(result!.success).toBe(true);
        });

        it('should reject join when user lacks room access', async () => {
            const { ForbiddenException } = require('@nestjs/common');
            const client = createMockSocket('user-1', 'socket-1');
            mockChatService.validateRoomAccess.mockRejectedValue(
                new ForbiddenException('You are not a participant of this battle'),
            );

            const result = await gateway.handleJoinRoom(client, {
                roomType: 'BATTLE' as any,
                roomId: 'battle-1',
            });

            expect(client.join).not.toHaveBeenCalled();
            expect(result!.success).toBe(false);
            expect(client.emit).toHaveBeenCalledWith('error', {
                message: 'You are not a participant of this battle',
            });
        });

        it('should return error when not authenticated', async () => {
            const client = createMockSocket();
            client.data = {};

            await gateway.handleJoinRoom(client, {
                roomType: 'BATTLE' as any,
                roomId: 'battle-1',
            });

            expect(client.emit).toHaveBeenCalledWith('error', {
                message: 'Not authenticated',
            });
        });
    });

    // ============================
    // chat.leave_room
    // ============================

    describe('chat.leave_room', () => {
        it('should leave room and notify members', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            // Pre-populate the room so the leave check passes
            client.rooms.add('dm:conv-1');

            const result = await gateway.handleLeaveRoom(client, {
                roomType: 'DM' as any,
                roomId: 'conv-1',
            });

            expect(client.leave).toHaveBeenCalledWith('dm:conv-1');
            expect(mockServer.to).toHaveBeenCalledWith('dm:conv-1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'chat.user_left',
                {
                    userId: 'user-1',
                    username: 'alice',
                    roomType: 'DM',
                    roomId: 'conv-1',
                },
            );
            expect(result!.success).toBe(true);
        });

        it('should return success without notifying when not in room', async () => {
            const client = createMockSocket('user-1', 'socket-1');
            // Don't add the room — client is not in it

            const result = await gateway.handleLeaveRoom(client, {
                roomType: 'DM' as any,
                roomId: 'conv-1',
            });

            expect(client.leave).not.toHaveBeenCalled();
            expect(mockServer.to).not.toHaveBeenCalled();
            expect(result!.success).toBe(true);
        });

        it('should return error when not authenticated', async () => {
            const client = createMockSocket();
            client.data = {};

            await gateway.handleLeaveRoom(client, {
                roomType: 'LOBBY' as any,
                roomId: 'lobby',
            });

            expect(client.emit).toHaveBeenCalledWith('error', {
                message: 'Not authenticated',
            });
        });
    });

    // ============================
    // Client Tracking
    // ============================

    describe('Client Tracking', () => {
        it('should track multiple connected clients', async () => {
            const client1 = createMockSocket('user-1', 'socket-1');
            const client2 = createMockSocket('user-2', 'socket-2');
            mockJwtVerificationService.verifyAndGetUser
                .mockResolvedValueOnce({ ...mockUser, id: 'user-1' })
                .mockResolvedValueOnce({
                    ...mockUser,
                    id: 'user-2',
                    username: 'bob',
                });

            await gateway.handleConnection(client1);
            await gateway.handleConnection(client2);

            expect(gateway.getConnectedClients().size).toBe(2);
            expect(gateway.getSocketByUserId('user-1')).toBeDefined();
            expect(gateway.getSocketByUserId('user-2')).toBeDefined();
        });

        it('should return undefined for non-connected user', () => {
            expect(
                gateway.getSocketByUserId('nonexistent'),
            ).toBeUndefined();
        });
    });
});
