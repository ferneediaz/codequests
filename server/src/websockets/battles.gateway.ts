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
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { WsAuthGuard } from './ws-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { BattlesService } from '../battles/battles.service';
import { JwtVerificationService } from '../auth/jwt-verification.service';
import { FriendsService } from '../friends/friends.service';
import { BattleRoundEndReason, BattleStatus, SkillType } from '@prisma/client';

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
    delivered?: boolean;
}

interface SubmissionData {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
    submittedAt: Date;
}

interface UseSkillPayload {
    battleId: string;
    targetUserId: string;
    skillType: SkillType;
}

interface ReadyPayload {
    battleId: string;
}

interface InviteUserPayload {
    battleId: string;
    targetUsername: string;
}

// Name of the Socket.IO room used to broadcast lobby presence deltas. Only
// clients currently viewing the lobby join this room (via lobby.subscribe),
// so presence events don't fan out to every connected socket.
const LOBBY_PRESENCE_ROOM = 'lobby:presence';

// Duration in seconds for each skill effect (0 = instant)
// TIME_STEAL deducts this many seconds from the target's remaining time.
const TIME_STEAL_SECONDS = 300; // 5 minutes
const SKILL_DURATIONS: Record<SkillType, number> = {
    FREEZE: 10,
    SCRAMBLE: 15,
    BLIND: 0, // Deprecated — kept for enum compatibility, not surfaced in UI
    TIME_STEAL: 0,
    FOG_OF_WAR: 20,
};

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/battles',
})
export class BattlesGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(BattlesGateway.name);

    // Track connected clients: socketId -> socket
    private connectedClients = new Map<string, AuthenticatedSocket>();

    // Track user to socket mapping: userId -> socketId
    private userSocketMap = new Map<string, string>();

    constructor(
        private readonly prisma: PrismaService,
        // Residual cycle: BattlesService now reaches the gateway via
        // BattleEventsPort (RealtimeModule), but the gateway still calls
        // back into BattlesService for socket commands (useSkill, readyUp,
        // invites). Keep the forwardRef.
        @Inject(forwardRef(() => BattlesService))
        private readonly battlesService: BattlesService,
        private readonly jwtVerificationService: JwtVerificationService,
        // Same residual cycle as above for FriendsService — used here for
        // friend-presence broadcasts on (dis)connect.
        @Inject(forwardRef(() => FriendsService))
        private readonly friendsService: FriendsService,
    ) { }

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized');
    }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            const token = client.handshake.auth?.token;

            if (!token) {
                this.logger.warn(`Connection rejected: No token provided (${client.id})`);
                client.disconnect();
                return;
            }

            const user = await this.jwtVerificationService.verifyAndGetUser(token);

            if (!user) {
                this.logger.warn(`Connection rejected: Invalid token or user not found (${client.id})`);
                client.disconnect();
                return;
            }

            // Attach user to socket
            client.data.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                mmr: user.mmr,
            };

            // Track the connection
            this.connectedClients.set(client.id, client);
            this.userSocketMap.set(user.id, client.id);

            this.logger.log(`Client connected: ${client.id} (User: ${user.username})`);

            // Notify friends about online status
            await this.notifyFriendsPresence(user.id, user.username, true);

            // Notify lobby subscribers about online status
            await this.broadcastLobbyPresence(user.id, true);

            // Auto-rejoin active battle rooms on reconnection
            await this.rejoinActiveBattles(client);

        } catch (error) {
            this.logger.error(`Connection error: ${(error as Error).message}`);
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

            // Notify friends about offline status
            await this.notifyFriendsPresence(user.id, user.username, false);

            // Notify lobby subscribers about offline status
            await this.broadcastLobbyPresence(user.id, false);
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
    @UseGuards(WsAuthGuard)
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
            this.logger.error(`Error joining battle room: ${(error as Error).message}`);
            client.emit('error', { message: (error as Error).message });
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Handle leaving a battle room
     */
    @UseGuards(WsAuthGuard)
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
     * Handle skill usage in a battle
     */
    @UseGuards(WsAuthGuard)
    @SubscribeMessage('skill.use')
    async handleUseSkill(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: UseSkillPayload,
    ): Promise<RoomResult> {
        const user = client.data.user;

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { battleId, targetUserId, skillType } = payload;

        try {
            const skillUse = await this.battlesService.useSkill(
                battleId,
                user.id,
                targetUserId,
                skillType,
            );

            // Emit skill effect to the target user
            const targetSocket = this.getSocketByUserId(targetUserId);
            if (targetSocket) {
                targetSocket.emit('skill.effect', {
                    skillType,
                    fromUserId: user.id,
                    duration: SKILL_DURATIONS[skillType],
                });
            }

            // Broadcast skill usage to the battle room
            this.server.to(`battle:${battleId}`).emit('skill.used', {
                userId: user.id,
                skillType,
                targetUserId,
            });

            // Special handling for TIME_STEAL — broadcast new startedAt so
            // every participant's Timer recomputes.
            if (skillType === SkillType.TIME_STEAL && skillUse?.updatedStartedAt) {
                this.server.to(`battle:${battleId}`).emit('battle.time_updated', {
                    battleId,
                    startedAt: skillUse.updatedStartedAt,
                    stolenSeconds: TIME_STEAL_SECONDS,
                    targetUserId,
                    fromUserId: user.id,
                });
            }

            return { success: true };
        } catch (error) {
            client.emit('error', { message: (error as Error).message });
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Handle player ready up
     */
    @UseGuards(WsAuthGuard)
    @SubscribeMessage('battle.ready')
    async handleReady(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: ReadyPayload,
    ): Promise<RoomResult> {
        const user = client.data.user;

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { battleId } = payload;

        try {
            const result = await this.battlesService.readyUp(battleId, user.id);

            // Broadcast ready status to room
            this.server.to(`battle:${battleId}`).emit('battle.player_ready', {
                userId: user.id,
                username: user.username,
                isReady: true,
            });

            // If all players are ready and battle started
            if (result.started) {
                this.emitBattleStarted(battleId, result.battle);
            }

            return { success: true };
        } catch (error) {
            client.emit('error', { message: (error as Error).message });
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Handle player unready
     */
    @UseGuards(WsAuthGuard)
    @SubscribeMessage('battle.unready')
    async handleUnready(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: ReadyPayload,
    ): Promise<RoomResult> {
        const user = client.data.user;

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { battleId } = payload;

        try {
            await this.battlesService.unready(battleId, user.id);

            // Broadcast unready status to room
            this.server.to(`battle:${battleId}`).emit('battle.player_ready', {
                userId: user.id,
                username: user.username,
                isReady: false,
            });

            return { success: true };
        } catch (error) {
            client.emit('error', { message: (error as Error).message });
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Handle in-app invite to a user by username
     */
    @UseGuards(WsAuthGuard)
    @SubscribeMessage('battle.invite_user')
    async handleInviteUser(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() payload: InviteUserPayload,
    ): Promise<RoomResult> {
        const user = client.data.user;

        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { battleId, targetUsername } = payload;

        try {
            const inviteData = await this.battlesService.inviteUserToBattle(
                battleId,
                user.id,
                targetUsername,
            );

            // Send invite notification to the target user if online
            const targetSocket = this.getSocketByUserId(inviteData.targetUserId);
            const delivered = !!targetSocket;
            if (targetSocket) {
                targetSocket.emit('battle.invite_received', {
                    battleId: inviteData.battleId,
                    inviterUsername: inviteData.inviterUsername,
                    inviterAvatarUrl: inviteData.inviterAvatarUrl,
                    battleMode: inviteData.battleMode,
                    inviteCode: inviteData.inviteCode,
                });
            }

            return { success: true, delivered };
        } catch (error) {
            client.emit('error', { message: (error as Error).message });
            return { success: false, error: (error as Error).message };
        }
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

    // ========================================
    // Battle Royale emits
    // ========================================

    /**
     * Emit when a BR round starts (IN_PROGRESS). Fired once per round.
     */
    emitRoyaleRoundStart(
        battleId: string,
        data: {
            battleId: string;
            roundNumber: number;
            totalRounds: number;
            problemId: string | null;
            timeLimitSeconds: number;
            eliminateCount: number;
            remainingUserIds: string[];
            startedAt: Date;
        },
    ) {
        this.server.to(`battle:${battleId}`).emit('battle.round_start', data);
    }

    /**
     * Emit when a BR round ends (COMPLETED).
     */
    emitRoyaleRoundEnd(
        battleId: string,
        data: {
            battleId: string;
            roundNumber: number;
            endedReason: BattleRoundEndReason;
            eliminatedUserIds: string[];
            standings: any[];
        },
    ) {
        this.server.to(`battle:${battleId}`).emit('battle.round_end', data);
    }

    /**
     * Emit one event per eliminated user at round end.
     */
    emitRoyaleElimination(
        battleId: string,
        data: {
            battleId: string;
            userId: string;
            roundNumber: number;
            placement: number;
        },
    ) {
        this.server.to(`battle:${battleId}`).emit('battle.elimination', data);
    }

    /**
     * Emit standings updates during an in-progress round (after each
     * submission).
     */
    emitRoyaleStandings(
        battleId: string,
        data: {
            battleId: string;
            roundNumber: number;
            standings: any[];
        },
    ) {
        this.server.to(`battle:${battleId}`).emit('battle.royale_standings', data);
    }

    // ========================================
    // Clan Wars emits
    // ========================================

    /**
     * Emit when a Clan Wars round starts (IN_PROGRESS). Fired once per round.
     */
    emitClanWarsRoundStart(
        battleId: string,
        data: {
            battleId: string;
            roundNumber: number;
            totalRounds: number;
            problemId: string | null;
            timeLimitSeconds: number;
            startedAt: Date;
            participantUserIds: string[];
        },
    ) {
        this.server.to(`battle:${battleId}`).emit('clan_wars.round_start', data);
    }

    /**
     * Emit when a Clan Wars round ends (COMPLETED).
     */
    emitClanWarsRoundEnd(
        battleId: string,
        data: {
            battleId: string;
            roundNumber: number;
            endedReason: BattleRoundEndReason;
            roundWinner: 'team-1' | 'team-2' | null;
            teams: any[];
        },
    ) {
        this.server.to(`battle:${battleId}`).emit('clan_wars.round_end', data);
    }

    /**
     * Emit team standings updates during an in-progress round (after each
     * submission).
     */
    emitClanWarsTeamStandings(
        battleId: string,
        data: {
            battleId: string;
            roundNumber: number;
            teams: any[];
        },
    ) {
        this.server
            .to(`battle:${battleId}`)
            .emit('clan_wars.team_standings', data);
    }

    /**
     * Emit when a Clan Wars round just ended and the battle enters
     * intermission. The next round will NOT start automatically — every
     * participant must explicitly ready up.
     */
    emitClanWarsRoundIntermission(
        battleId: string,
        data: {
            battleId: string;
            justEndedRound: number;
            nextRoundNumber: number;
            readyUserIds: string[];
        },
    ) {
        this.server
            .to(`battle:${battleId}`)
            .emit('clan_wars.round_intermission', data);
    }

    /**
     * Emit when a participant (un)readies up for the next round during
     * intermission. Includes the full list of currently-ready userIds and an
     * `allReady` flag indicating whether the next round has fired.
     */
    emitClanWarsPlayerReadyNextRound(
        battleId: string,
        data: {
            battleId: string;
            userId: string;
            nextRoundNumber: number;
            readyUserIds: string[];
            allReady: boolean;
        },
    ) {
        this.server
            .to(`battle:${battleId}`)
            .emit('clan_wars.player_ready_next_round', data);
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
     * Emit match found event to matched players
     */
    emitMatchFound(
        userId: string,
        data: { battleId: string; opponentId: string },
    ) {
        const socket = this.getSocketByUserId(userId);
        if (socket) {
            socket.emit('matchmaking.match_found', {
                battleId: data.battleId,
                opponentId: data.opponentId,
                matchedAt: new Date(),
            });
        }
    }

    /**
     * Emit season ended event to all connected clients
     */
    emitSeasonEnded(data: {
        endedSeason: { id: string; name: string; number: number };
        newSeason: { id: string; name: string; number: number };
    }) {
        this.server.emit('season.ended', {
            endedSeason: data.endedSeason,
            newSeason: data.newSeason,
            message: `${data.endedSeason.name} has ended! ${data.newSeason.name} has begun. All MMR has been reset to 1000.`,
            timestamp: new Date(),
        });
    }

    /**
     * Check if a user is currently online
     */
    isOnline(userId: string): boolean {
        return this.userSocketMap.has(userId);
    }

    /**
     * Filter a list of user IDs to only those currently online
     */
    getOnlineUsers(userIds: string[]): string[] {
        return userIds.filter((id) => this.userSocketMap.has(id));
    }

    /**
     * Emit an event to all online members of a clan (by member IDs)
     */
    emitToClanMembers(memberIds: string[], event: string, data: any) {
        for (const memberId of memberIds) {
            const socket = this.getSocketByUserId(memberId);
            if (socket) {
                socket.emit(event, data);
            }
        }
    }

    /**
     * Handle lobby presence subscription. Authenticated clients join a
     * dedicated `lobby:presence` room so they receive presence deltas for
     * everyone on the platform — not just their friends.
     */
    @UseGuards(WsAuthGuard)
    @SubscribeMessage('lobby.subscribe')
    async handleLobbySubscribe(
        @ConnectedSocket() client: AuthenticatedSocket,
    ): Promise<RoomResult> {
        const user = client.data.user;
        if (!user) {
            return { success: false, error: 'Not authenticated' };
        }
        client.join(LOBBY_PRESENCE_ROOM);
        return { success: true };
    }

    /**
     * Handle lobby presence unsubscription. Clients call this when they
     * navigate away from the lobby page so presence fan-out shrinks.
     */
    @UseGuards(WsAuthGuard)
    @SubscribeMessage('lobby.unsubscribe')
    async handleLobbyUnsubscribe(
        @ConnectedSocket() client: AuthenticatedSocket,
    ): Promise<RoomResult> {
        client.leave(LOBBY_PRESENCE_ROOM);
        return { success: true };
    }

    /**
     * Emit a presence delta to every client currently subscribed to the
     * lobby presence room. Looks up the user row to enrich the payload with
     * clan + avatar so the lobby UI can render a full row without a second
     * round-trip. Offline events only need the userId; we still enrich when
     * available for consistency.
     */
    private async broadcastLobbyPresence(userId: string, online: boolean) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                    mmr: true,
                    clan: {
                        select: { id: true, name: true, tag: true, mmr: true },
                    },
                },
            });
            if (!user) return;

            this.server.to(LOBBY_PRESENCE_ROOM).emit('lobby.presence_delta', {
                type: online ? 'online' : 'offline',
                user,
            });
        } catch (error) {
            this.logger.error(
                `Error broadcasting lobby presence: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Emit a freshly created friend request to the addressee if they are
     * online, so their notification center lights up immediately without a
     * manual refresh. Safe to call for offline users — they'll see the
     * request via REST hydration on next app load.
     */
    emitFriendRequestReceived(
        addresseeId: string,
        data: {
            friendshipId: string;
            requesterId: string;
            requesterUsername: string;
            requesterAvatarUrl?: string | null;
            requesterMmr: number;
            createdAt: Date | string;
        },
    ): boolean {
        const socket = this.getSocketByUserId(addresseeId);
        if (!socket) return false;
        socket.emit('friend.request_received', data);
        return true;
    }

    /**
     * Notify the original requester that their outgoing request was
     * accepted. The recipient gets to see the new friendship show up in
     * their friends list without polling.
     */
    emitFriendRequestAccepted(
        requesterId: string,
        data: {
            friendshipId: string;
            friendId: string;
            friendUsername: string;
            friendAvatarUrl?: string | null;
            friendMmr: number;
        },
    ): boolean {
        const socket = this.getSocketByUserId(requesterId);
        if (!socket) return false;
        socket.emit('friend.request_accepted', data);
        return true;
    }

    /**
     * Notify the original requester that their outgoing request was
     * declined. Emitted quietly — clients surface this as a toast rather
     * than a persistent notification.
     */
    emitFriendRequestDeclined(
        requesterId: string,
        data: {
            friendshipId: string;
            addresseeId: string;
            addresseeUsername: string;
        },
    ): boolean {
        const socket = this.getSocketByUserId(requesterId);
        if (!socket) return false;
        socket.emit('friend.request_declined', data);
        return true;
    }

    /**
     * Generic per-user emit for problem-submission lifecycle events. Returns
     * `false` (silently) when the recipient is offline — they'll see the
     * notification on next REST hydration.
     */
    emitSubmissionEvent(userId: string, event: string, data: unknown): boolean {
        const socket = this.getSocketByUserId(userId);
        if (!socket) return false;
        socket.emit(event, data);
        return true;
    }

    /**
     * Notify a user's friends about their online/offline status
     */
    private async notifyFriendsPresence(userId: string, username: string, online: boolean) {
        try {
            const friendIds = await this.friendsService.getFriendIds(userId);
            const event = online ? 'presence.online' : 'presence.offline';

            for (const friendId of friendIds) {
                const friendSocket = this.getSocketByUserId(friendId);
                if (friendSocket) {
                    friendSocket.emit(event, { userId, username });
                }
            }
        } catch (error) {
            this.logger.error(`Error notifying friends presence: ${(error as Error).message}`);
        }
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
            this.logger.error(`Error auto-rejoining battles: ${(error as Error).message}`);
        }
    }
}
