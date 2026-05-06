import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, HttpException } from '@nestjs/common';
import { WsAuthGuard } from '../websockets/ws-auth.guard';
import { JwtVerificationService } from '../auth/jwt-verification.service';
import { ChatService } from './chat.service';
import { ChatRoomType } from '@prisma/client';

interface AuthenticatedSocket extends Socket {
    data: {
        user?: {
            id: string;
            username: string;
            [key: string]: any;
        };
    };
}

interface SendMessagePayload {
    roomType: ChatRoomType;
    roomId: string;
    content: string;
}

interface JoinRoomPayload {
    roomType: ChatRoomType;
    roomId: string;
}

interface LeaveRoomPayload {
    roomType: ChatRoomType;
    roomId: string;
}

@WebSocketGateway({
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
    },
    namespace: '/chat',
})
export class ChatGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(ChatGateway.name);

    // Track connected clients
    private connectedClients = new Map<string, AuthenticatedSocket>();
    private userSocketMap = new Map<string, Set<string>>(); // userId -> Set<socketId>

    // Rate limiting: userId -> array of message timestamps
    private messageRateLimit = new Map<string, number[]>();
    private readonly RATE_LIMIT_WINDOW = 10_000; // 10 seconds
    private readonly RATE_LIMIT_MAX = 10; // max messages per window

    constructor(
        private readonly jwtVerificationService: JwtVerificationService,
        private readonly chatService: ChatService,
    ) {}

    afterInit() {
        this.logger.log('Chat Gateway initialized');
    }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            const token = client.handshake?.auth?.token;

            if (!token) {
                this.logger.warn(
                    `Client ${client.id} connected without token, disconnecting`,
                );
                client.disconnect();
                return;
            }

            const user =
                await this.jwtVerificationService.verifyAndGetUser(token);

            if (!user) {
                this.logger.warn(
                    `Client ${client.id} failed authentication, disconnecting`,
                );
                client.disconnect();
                return;
            }

            // Attach user data to socket
            client.data.user = user;

            // Track client
            this.connectedClients.set(client.id, client);
            const socketIds = this.userSocketMap.get(user.id) ?? new Set<string>();
            socketIds.add(client.id);
            this.userSocketMap.set(user.id, socketIds);

            // Auto-join lobby room
            client.join('lobby');

            this.logger.log(
                `Client ${client.id} (${user.username}) connected to chat`,
            );
        } catch (error: unknown) {
            this.logger.error(
                `Error during chat connection: ${error instanceof Error ? error.message : error}`,
            );
            client.disconnect();
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        const userId = client.data?.user?.id;

        this.connectedClients.delete(client.id);
        if (userId) {
            const socketIds = this.userSocketMap.get(userId);
            if (socketIds) {
                socketIds.delete(client.id);
                if (socketIds.size === 0) {
                    this.userSocketMap.delete(userId);
                }
            }
        }

        this.logger.log(`Client ${client.id} disconnected from chat`);
    }

    @SubscribeMessage('chat.send')
    @UseGuards(WsAuthGuard)
    async handleSendMessage(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: SendMessagePayload,
    ) {
        try {
            const userId = client.data.user?.id;
            if (!userId) {
                client.emit('error', { message: 'Not authenticated' });
                return;
            }

            const { roomType, roomId, content } = payload;

            if (!content || content.length === 0 || content.length > 1000) {
                client.emit('error', {
                    message:
                        'Message content must be between 1 and 1000 characters',
                });
                return;
            }

            // Rate limiting
            if (this.isRateLimited(userId)) {
                client.emit('error', {
                    message: 'Rate limit exceeded. Please slow down.',
                });
                return;
            }

            const message = await this.chatService.sendMessage(
                userId,
                roomType,
                roomId,
                content,
            );

            // Build the room name for Socket.IO
            const roomName = this.getRoomName(roomType, roomId);

            // Broadcast message to the room
            this.server.to(roomName).emit('chat.message', message);
            if (roomType === ChatRoomType.DM) {
                await this.emitUnreadChanges(roomId, userId);
            }

            return { success: true, message };
        } catch (error: unknown) {
            this.logger.error(`Error sending message: ${error instanceof Error ? error.message : error}`);
            const clientMessage = error instanceof HttpException
                ? error.message
                : 'An error occurred while sending the message';
            client.emit('error', { message: clientMessage });
            return { success: false, error: clientMessage };
        }
    }

    @SubscribeMessage('chat.join_room')
    @UseGuards(WsAuthGuard)
    async handleJoinRoom(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: JoinRoomPayload,
    ) {
        try {
            const userId = client.data.user?.id;
            const username = client.data.user?.username;
            if (!userId) {
                client.emit('error', { message: 'Not authenticated' });
                return;
            }

            const { roomType, roomId } = payload;
            const roomName = this.getRoomName(roomType, roomId);

            // Validate room access before allowing join
            await this.chatService.validateRoomAccess(userId, roomType, roomId);

            // Join the Socket.IO room
            client.join(roomName);

            // Notify room members
            this.server.to(roomName).emit('chat.user_joined', {
                userId,
                username,
                roomType,
                roomId,
            });

            this.logger.log(
                `Client ${client.id} (${username}) joined room ${roomName}`,
            );

            return { success: true };
        } catch (error: unknown) {
            this.logger.error(`Error joining room: ${error instanceof Error ? error.message : error}`);
            const clientMessage = error instanceof HttpException
                ? error.message
                : 'An error occurred while joining the room';
            client.emit('error', { message: clientMessage });
            return { success: false, error: clientMessage };
        }
    }

    @SubscribeMessage('chat.leave_room')
    @UseGuards(WsAuthGuard)
    async handleLeaveRoom(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: LeaveRoomPayload,
    ) {
        try {
            const userId = client.data.user?.id;
            const username = client.data.user?.username;
            if (!userId) {
                client.emit('error', { message: 'Not authenticated' });
                return;
            }

            const { roomType, roomId } = payload;
            const roomName = this.getRoomName(roomType, roomId);

            // Only leave and notify if actually in the room
            if (!client.rooms.has(roomName)) {
                return { success: true };
            }

            // Leave the Socket.IO room
            client.leave(roomName);

            // Notify room members
            this.server.to(roomName).emit('chat.user_left', {
                userId,
                username,
                roomType,
                roomId,
            });

            this.logger.log(
                `Client ${client.id} (${username}) left room ${roomName}`,
            );

            return { success: true };
        } catch (error: unknown) {
            this.logger.error(`Error leaving room: ${error instanceof Error ? error.message : error}`);
            const clientMessage = error instanceof HttpException
                ? error.message
                : 'An error occurred while leaving the room';
            client.emit('error', { message: clientMessage });
            return { success: false, error: clientMessage };
        }
    }

    /**
     * Build a Socket.IO room name from room type and ID.
     */
    private getRoomName(roomType: ChatRoomType, roomId: string): string {
        switch (roomType) {
            case ChatRoomType.LOBBY:
                return 'lobby';
            case ChatRoomType.BATTLE:
                return `battle:${roomId}`;
            case ChatRoomType.DM:
                return `dm:${roomId}`;
            case ChatRoomType.CLAN:
                return `clan:${roomId}`;
        }
    }

    private async emitUnreadChanges(conversationId: string, senderId: string) {
        const participantIds = await this.chatService.getDmParticipantIds(conversationId);
        await Promise.all(
            participantIds
                .filter((userId) => userId !== senderId)
                .map(async (userId) => {
                    const counts = await this.chatService.getUnreadCounts(userId);
                    this.emitToUser(userId, 'chat.unread_changed', counts);
                }),
        );
    }

    private emitToUser(userId: string, event: string, payload: unknown) {
        const socketIds = this.userSocketMap.get(userId);
        if (!socketIds) return;
        for (const socketId of socketIds) {
            const socket = this.connectedClients.get(socketId);
            socket?.emit(event, payload);
        }
    }

    // Helper methods for external access
    getConnectedClients() {
        return this.connectedClients;
    }

    getSocketByUserId(userId: string): AuthenticatedSocket | undefined {
        const socketIds = this.userSocketMap.get(userId);
        if (socketIds) {
            for (const socketId of socketIds) {
                const socket = this.connectedClients.get(socketId);
                if (socket) return socket;
            }
        }
        return undefined;
    }

    /**
     * Check if a user is rate-limited for sending messages.
     */
    private isRateLimited(userId: string): boolean {
        const now = Date.now();
        const timestamps = this.messageRateLimit.get(userId) ?? [];
        const recent = timestamps.filter(t => now - t < this.RATE_LIMIT_WINDOW);
        recent.push(now);
        this.messageRateLimit.set(userId, recent);
        return recent.length > this.RATE_LIMIT_MAX;
    }
}
