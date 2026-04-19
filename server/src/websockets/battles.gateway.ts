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
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BattlesService } from '../battles/battles.service';
import { BattleStatus } from '@prisma/client';

interface AuthenticatedSocket extends Socket {
    data: {
        user?: {
            id: string;
            username: string;
            [key: string]: any;
        };
    };
}

interface JoinRoomPayload {
    battleId: string;
}

interface LeaveRoomPayload {
    battleId: string;
}

interface RoomResult {
    success: boolean;
    error?: string;
}

interface SubmissionData {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
    submittedAt: Date;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/battles',
})
export class BattlesGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(BattlesGateway.name);
    
    // Track connected clients: socketId -> socket
    private connectedClients = new Map<string, AuthenticatedSocket>();
    
    // Track user to socket mapping: odp -> socketId
    private userSocketMap = new Map<string, string>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly battlesService: BattlesService,
    ) {}

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized');
    }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            // Extract token from handshake
            const token = client.handshake.auth?.token;
            
            if (!token) {
                this.logger.warn(`Connection rejected: No token provided (${client.id})`);
                client.disconnect();
                return;
            }

            // For now, extract user ID from token (simplified - in production, validate JWT)
            // Token format: "valid-jwt-for-{userId}" for testing
            const userIdMatch = token.match(/valid-jwt-for-(.+)/);
            if (!userIdMatch) {
                this.logger.warn(`Connection rejected: Invalid token format (${client.id})`);
                client.disconnect();
                return;
            }

            const userId = userIdMatch[1];
            
            // Verify user exists in database
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                this.logger.warn(`Connection rejected: User not found (${client.id})`);
                client.disconnect();
                return;
            }

            // Attach user to socket
            client.data.user = {
                id: user.id,
                username: user.username,
                mmr: user.mmr,
            };

            // Track the connection
            this.connectedClients.set(client.id, client);
            this.userSocketMap.set(user.id, client.id);

            this.logger.log(`Client connected: ${client.id} (User: ${user.username})`);

            // Auto-rejoin active battle rooms on reconnection
            await this.rejoinActiveBattles(client);

        } catch (error) {
            this.logger.error(`Connection error: ${error.message}`);
            client.disconnect();
        }
    }

    async handleDisconnect(client: AuthenticatedSocket) {
        const user = client.data.user;
        
        // Notify battle rooms about disconnection
        if (user) {
            // Get all rooms the client was in (excluding the socket's own room)
            const battleRooms = Array.from(client.rooms || []).filter(
                room => room.startsWith('battle:')
            );

            for (const room of battleRooms) {
                this.server.to(room).emit('battle.player_disconnected', {
                    userId: user.id,
                    username: user.username,
                    disconnectedAt: new Date(),
                });
            }

            // Remove from user mapping
            this.userSocketMap.delete(user.id);
        }

        // Remove from connected clients
        this.connectedClients.delete(client.id);
        
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    /**
     * Get all connected client socket IDs
     */
    getConnectedClients(): Map<string, AuthenticatedSocket> {
        return this.connectedClients;
    }

    /**
     * Get socket by user ID
     */
    getSocketByUserId(userId: string): AuthenticatedSocket | undefined {
        const socketId = this.userSocketMap.get(userId);
        if (socketId) {
            return this.connectedClients.get(socketId);
        }
        return undefined;
    }

    /**
     * Handle joining a battle room
     */
    @SubscribeMessage('battle.join')
    async handleJoinBattleRoom(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: JoinRoomPayload,
    ): Promise<RoomResult> {
        const { battleId } = payload;
        const user = client.data.user;

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            // Verify the user is a participant in this battle
            const battle = await this.battlesService.getBattleDetails(battleId);
            
            const isParticipant = battle.participants.some(
                (p: any) => p.userId === user.id
            );

            if (!isParticipant) {
                client.emit('error', { message: 'You are not a participant in this battle' });
                return { success: false, error: 'You are not a participant in this battle' };
            }

            // Join the battle room
            const roomName = `battle:${battleId}`;
            client.join(roomName);

            // Broadcast to room that player joined
            this.server.to(roomName).emit('battle.player_joined', {
                userId: user.id,
                username: user.username,
                battleId,
                joinedAt: new Date(),
            });

            this.logger.log(`User ${user.username} joined battle room: ${battleId}`);

            return { success: true };
        } catch (error) {
            this.logger.error(`Error joining battle room: ${error.message}`);
            client.emit('error', { message: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle leaving a battle room
     */
    @SubscribeMessage('battle.leave')
    async handleLeaveBattleRoom(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: LeaveRoomPayload,
    ): Promise<RoomResult> {
        const { battleId } = payload;
        const user = client.data.user;

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        const roomName = `battle:${battleId}`;

        // Broadcast to room that player left
        this.server.to(roomName).emit('battle.player_left', {
            userId: user.id,
            username: user.username,
            battleId,
            leftAt: new Date(),
        });

        // Leave the room
        client.leave(roomName);

        this.logger.log(`User ${user.username} left battle room: ${battleId}`);

        return { success: true };
    }

    /**
     * Emit battle started event to room
     */
    emitBattleStarted(battleId: string, battle: any) {
        this.server.to(`battle:${battleId}`).emit('battle.started', {
            battleId,
            status: battle.status,
            startedAt: battle.startedAt,
            problem: battle.problem,
            participants: battle.participants,
        });
    }

    /**
     * Emit battle submission event to room
     */
    emitBattleSubmission(battleId: string, data: SubmissionData) {
        this.server.to(`battle:${battleId}`).emit('battle.submission', {
            userId: data.userId,
            username: data.username,
            testsPassed: data.testsPassed,
            totalTests: data.totalTests,
            submittedAt: data.submittedAt,
        });
    }

    /**
     * Emit battle completed event to room
     */
    emitBattleCompleted(battleId: string, battle: any) {
        this.server.to(`battle:${battleId}`).emit('battle.completed', {
            battleId,
            status: battle.status,
            winnerId: battle.winnerId,
            endedAt: battle.endedAt,
            participants: battle.participants.map((p: any) => ({
                userId: p.userId,
                username: p.user?.username,
                testsPassed: p.testsPassed,
                totalTests: p.totalTests,
                mmrChange: p.mmrChange,
            })),
        });
    }

    /**
     * Emit battle status update to room
     */
    emitBattleStatusUpdate(battleId: string, status: BattleStatus) {
        this.server.to(`battle:${battleId}`).emit('battle.status_update', {
            battleId,
            status,
            updatedAt: new Date(),
        });
    }

    /**
     * Auto-rejoin active battle rooms on reconnection
     */
    private async rejoinActiveBattles(client: AuthenticatedSocket) {
        const user = client.data.user;
        if (!user) return;

        try {
            // Find active battles the user is participating in
            const activeParticipations = await this.prisma.battleParticipant.findMany({
                where: {
                    userId: user.id,
                    battle: {
                        status: BattleStatus.IN_PROGRESS,
                    },
                },
                include: {
                    battle: true,
                },
            });

            // Auto-join the battle rooms
            for (const participation of activeParticipations) {
                const roomName = `battle:${participation.battleId}`;
                client.join(roomName);
                this.logger.log(`Auto-rejoined user ${user.username} to battle room: ${participation.battleId}`);
            }
        } catch (error) {
            this.logger.error(`Error auto-rejoining battles: ${error.message}`);
        }
    }
}
