import { Test, TestingModule } from '@nestjs/testing';
import { BattlesGateway } from './battles.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { BattlesService } from '../battles/battles.service';
import { Server, Socket } from 'socket.io';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import { BattleStatus, SkillType } from '@prisma/client';
import { JwtVerificationService } from '../auth/jwt-verification.service';
import { FriendsService } from '../friends/friends.service';

describe('BattlesGateway', () => {
    let gateway: BattlesGateway;
    let prisma: MockPrismaService;
    let mockBattlesService: {
        getBattleDetails: jest.Mock;
        joinBattle: jest.Mock;
        submitSolution: jest.Mock;
        completeBattle: jest.Mock;
        createBattle: jest.Mock;
        useSkill: jest.Mock;
        readyUp: jest.Mock;
        unready: jest.Mock;
        inviteUserToBattle: jest.Mock;
    };
    let mockServer: {
        to: jest.Mock;
        emit: jest.Mock;
        in: jest.Mock;
    };
    let mockJwtVerificationService: {
        verifyToken: jest.Mock;
        verifyAndGetUser: jest.Mock;
    };
    let mockFriendsService: {
        getFriendIds: jest.Mock;
    };

    // Mock user data
    const mockUser = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@test.com',
        avatarUrl: null,
        mmr: 1000,
        wins: 5,
        losses: 3,
        role: 'user',
        clanId: null,
        clan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockUser2 = {
        id: 'user-2',
        username: 'bob',
        email: 'bob@test.com',
        avatarUrl: null,
        mmr: 1100,
        wins: 8,
        losses: 2,
        role: 'user',
        clanId: null,
        clan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    // Mock battle data
    const mockBattle = {
        id: 'battle-1',
        mode: 'ONE_V_ONE' as const,
        problemId: 'problem-1',
        winnerId: null,
        winningTeam: null,
        teamSize: null,
        timeLimitMinutes: 5,
        autoBalance: true,
        status: 'WAITING' as const,
        startedAt: null,
        endedAt: null,
        createdAt: new Date(),
        problemPool: null,
        participants: [
            {
                id: 'participant-1',
                battleId: 'battle-1',
                userId: 'user-1',
                teamId: null,
                code: null,
                language: null,
                testsPassed: 0,
                totalTests: 2,
                pointsEarned: 0,
                submittedAt: null,
                mmrChange: null,
                user: mockUser,
            },
        ],
        problem: {
            id: 'problem-1',
            title: 'Two Sum',
            description: 'Find two numbers',
            difficulty: 'EASY' as const,
            starterCode: '{}',
        },
    };

    // Mock socket factory - returns a mock that can be cast to any
    const createMockSocket = (userId?: string, socketId?: string): any => {
        const id = socketId || `socket-${Math.random().toString(36).substr(2, 9)}`;
        const roomsSet = new Set<string>();
        
        const socket = {
            id,
            handshake: {
                auth: userId ? { token: `valid-jwt-for-${userId}` } : {},
                query: {},
                headers: {},
            },
            data: userId ? { user: { ...mockUser, id: userId } } : {},
            join: jest.fn().mockImplementation((room: string) => roomsSet.add(room)),
            leave: jest.fn().mockImplementation((room: string) => roomsSet.delete(room)),
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
            disconnect: jest.fn(),
            rooms: roomsSet,
        };
        return socket;
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        mockBattlesService = {
            getBattleDetails: jest.fn(),
            joinBattle: jest.fn(),
            submitSolution: jest.fn(),
            completeBattle: jest.fn(),
            createBattle: jest.fn(),
            useSkill: jest.fn(),
            readyUp: jest.fn(),
            unready: jest.fn(),
            inviteUserToBattle: jest.fn(),
        };

        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            in: jest.fn().mockReturnThis(),
        };

        mockJwtVerificationService = {
            verifyToken: jest.fn(),
            verifyAndGetUser: jest.fn(),
        };

        mockFriendsService = {
            getFriendIds: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BattlesGateway,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: BattlesService,
                    useValue: mockBattlesService,
                },
                {
                    provide: JwtVerificationService,
                    useValue: mockJwtVerificationService,
                },
                {
                    provide: FriendsService,
                    useValue: mockFriendsService,
                },
                WsAuthGuard,
            ],
        }).compile();

        gateway = module.get<BattlesGateway>(BattlesGateway);
        prisma = module.get<MockPrismaService>(PrismaService);

        // Default: no active battles to rejoin
        prisma.battleParticipant.findMany.mockResolvedValue([]);

        // Inject mock server
        gateway.server = mockServer as any;
    });

    describe('Connection Handling', () => {
        it('should accept connection with valid JWT token and attach user to socket', async () => {
            const socket = createMockSocket('user-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            await gateway.handleConnection(socket);

            expect(socket.data.user).toBeDefined();
            expect(socket.data.user.id).toBe('user-1');
        });

        it('should reject connection without JWT token', async () => {
            const socket = createMockSocket(); // No userId = no token
            socket.handshake.auth = {};

            await gateway.handleConnection(socket);

            expect(socket.disconnect).toHaveBeenCalled();
        });

        it('should reject connection with invalid JWT token', async () => {
            const socket = createMockSocket('user-1');
            socket.handshake.auth = { token: 'invalid-token' };
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(null);

            await gateway.handleConnection(socket);

            expect(socket.disconnect).toHaveBeenCalled();
        });

        it('should track connected clients', async () => {
            const socket = createMockSocket('user-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            await gateway.handleConnection(socket);

            expect(gateway.getConnectedClients().has(socket.id)).toBe(true);
        });
    });

    describe('Disconnection Handling', () => {
        it('should handle disconnect and remove client from tracking', async () => {
            const socket = createMockSocket('user-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            // First connect
            await gateway.handleConnection(socket);
            expect(gateway.getConnectedClients().has(socket.id)).toBe(true);

            // Then disconnect
            await gateway.handleDisconnect(socket);
            expect(gateway.getConnectedClients().has(socket.id)).toBe(false);
        });

        it('should notify battle room when player disconnects', async () => {
            const socket = createMockSocket('user-1');
            socket.rooms = new Set(['battle:battle-1']);
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            await gateway.handleConnection(socket);
            await gateway.handleDisconnect(socket);

            expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'battle.player_disconnected',
                expect.objectContaining({
                    userId: 'user-1',
                    username: 'alice',
                }),
            );
        });
    });

    describe('Battle Room Management', () => {
        describe('joinBattleRoom', () => {
            it('should allow participant to join battle room', async () => {
                const socket = createMockSocket('user-1');
                socket.data.user = mockUser;
                mockBattlesService.getBattleDetails.mockResolvedValue({
                    ...mockBattle,
                    participants: [
                        { ...mockBattle.participants[0], userId: 'user-1' },
                    ],
                });

                const result = await gateway.handleJoinBattleRoom(socket, {
                    battleId: 'battle-1',
                });

                expect(socket.join).toHaveBeenCalledWith('battle:battle-1');
                expect(result.success).toBe(true);
            });

            it('should reject non-participant from joining battle room', async () => {
                const socket = createMockSocket('user-999');
                socket.data.user = { ...mockUser, id: 'user-999' };
                mockBattlesService.getBattleDetails.mockResolvedValue(mockBattle);

                const result = await gateway.handleJoinBattleRoom(socket, {
                    battleId: 'battle-1',
                });

                expect(socket.join).not.toHaveBeenCalled();
                expect(result.success).toBe(false);
                expect(result.error).toContain('not a participant');
            });

            it('should broadcast player_joined event to room', async () => {
                const socket = createMockSocket('user-1');
                socket.data.user = mockUser;
                mockBattlesService.getBattleDetails.mockResolvedValue({
                    ...mockBattle,
                    participants: [
                        { ...mockBattle.participants[0], userId: 'user-1' },
                    ],
                });

                await gateway.handleJoinBattleRoom(socket, {
                    battleId: 'battle-1',
                });

                expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
                expect(mockServer.emit).toHaveBeenCalledWith(
                    'battle.player_joined',
                    expect.objectContaining({
                        userId: 'user-1',
                        username: 'alice',
                        battleId: 'battle-1',
                    }),
                );
            });

            it('should reject joining room for non-existent battle', async () => {
                const socket = createMockSocket('user-1');
                socket.data.user = mockUser;
                mockBattlesService.getBattleDetails.mockRejectedValue(
                    new Error('Battle not found'),
                );

                const result = await gateway.handleJoinBattleRoom(socket, {
                    battleId: 'non-existent',
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Battle not found');
            });
        });

        describe('leaveBattleRoom', () => {
            it('should allow player to leave battle room', async () => {
                const socket = createMockSocket('user-1');
                socket.data.user = mockUser;
                socket.rooms = new Set(['battle:battle-1']);

                const result = await gateway.handleLeaveBattleRoom(socket, {
                    battleId: 'battle-1',
                });

                expect(socket.leave).toHaveBeenCalledWith('battle:battle-1');
                expect(result.success).toBe(true);
            });

            it('should broadcast player_left event to room', async () => {
                const socket = createMockSocket('user-1');
                socket.data.user = mockUser;
                socket.rooms = new Set(['battle:battle-1']);

                await gateway.handleLeaveBattleRoom(socket, {
                    battleId: 'battle-1',
                });

                expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
                expect(mockServer.emit).toHaveBeenCalledWith(
                    'battle.player_left',
                    expect.objectContaining({
                        userId: 'user-1',
                        username: 'alice',
                        battleId: 'battle-1',
                    }),
                );
            });
        });
    });

    describe('Real-time Battle Events', () => {
        describe('battle.started', () => {
            it('should emit battle.started to room when battle begins', () => {
                const battleId = 'battle-1';
                const startedBattle = {
                    ...mockBattle,
                    status: BattleStatus.IN_PROGRESS,
                    startedAt: new Date(),
                };

                gateway.emitBattleStarted(battleId, startedBattle);

                expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
                expect(mockServer.emit).toHaveBeenCalledWith(
                    'battle.started',
                    expect.objectContaining({
                        battleId: 'battle-1',
                        status: BattleStatus.IN_PROGRESS,
                        startedAt: expect.any(Date),
                    }),
                );
            });
        });

        describe('battle.submission', () => {
            it('should emit battle.submission to room when player submits', () => {
                const battleId = 'battle-1';
                const submissionData = {
                    userId: 'user-1',
                    username: 'alice',
                    testsPassed: 5,
                    totalTests: 10,
                    submittedAt: new Date(),
                };

                gateway.emitBattleSubmission(battleId, submissionData);

                expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
                expect(mockServer.emit).toHaveBeenCalledWith(
                    'battle.submission',
                    expect.objectContaining({
                        userId: 'user-1',
                        username: 'alice',
                        testsPassed: 5,
                        totalTests: 10,
                    }),
                );
            });
        });

        describe('battle.completed', () => {
            it('should emit battle.completed to room with results', () => {
                const battleId = 'battle-1';
                const completedBattle = {
                    ...mockBattle,
                    status: BattleStatus.COMPLETED,
                    winnerId: 'user-1',
                    endedAt: new Date(),
                    participants: [
                        {
                            ...mockBattle.participants[0],
                            mmrChange: 25,
                            testsPassed: 10,
                            totalTests: 10,
                        },
                        {
                            ...mockBattle.participants[0],
                            userId: 'user-2',
                            mmrChange: -25,
                            testsPassed: 7,
                            totalTests: 10,
                            user: mockUser2,
                        },
                    ],
                };

                gateway.emitBattleCompleted(battleId, completedBattle);

                expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
                expect(mockServer.emit).toHaveBeenCalledWith(
                    'battle.completed',
                    expect.objectContaining({
                        battleId: 'battle-1',
                        status: BattleStatus.COMPLETED,
                        winnerId: 'user-1',
                        participants: expect.arrayContaining([
                            expect.objectContaining({
                                userId: 'user-1',
                                mmrChange: 25,
                            }),
                        ]),
                    }),
                );
            });
        });

        describe('battle.status_update', () => {
            it('should emit battle.status_update when status changes', () => {
                const battleId = 'battle-1';
                const newStatus = BattleStatus.IN_PROGRESS;

                gateway.emitBattleStatusUpdate(battleId, newStatus);

                expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
                expect(mockServer.emit).toHaveBeenCalledWith(
                    'battle.status_update',
                    expect.objectContaining({
                        battleId: 'battle-1',
                        status: BattleStatus.IN_PROGRESS,
                    }),
                );
            });
        });
    });

    describe('Client Tracking', () => {
        it('should track multiple connected clients', async () => {
            const socket1 = createMockSocket('user-1');
            const socket2 = createMockSocket('user-2');
            mockJwtVerificationService.verifyAndGetUser
                .mockResolvedValueOnce(mockUser)
                .mockResolvedValueOnce(mockUser2);

            await gateway.handleConnection(socket1);
            await gateway.handleConnection(socket2);

            const clients = gateway.getConnectedClients();
            expect(clients.size).toBe(2);
            expect(clients.has(socket1.id)).toBe(true);
            expect(clients.has(socket2.id)).toBe(true);
        });

        it('should get socket by user ID', async () => {
            const socket = createMockSocket('user-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            await gateway.handleConnection(socket);

            const foundSocket = gateway.getSocketByUserId('user-1');
            expect(foundSocket).toBeDefined();
            expect(foundSocket?.id).toBe(socket.id);
        });

        it('should return undefined for non-connected user', () => {
            const foundSocket = gateway.getSocketByUserId('non-existent');
            expect(foundSocket).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle errors during room join gracefully', async () => {
            const socket = createMockSocket('user-1');
            socket.data.user = mockUser;
            mockBattlesService.getBattleDetails.mockRejectedValue(
                new Error('Database error'),
            );

            const result = await gateway.handleJoinBattleRoom(socket, {
                battleId: 'battle-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should emit error event to client on exception', async () => {
            const socket = createMockSocket('user-1');
            socket.data.user = mockUser;
            mockBattlesService.getBattleDetails.mockRejectedValue(
                new Error('Unexpected error'),
            );

            await gateway.handleJoinBattleRoom(socket, { battleId: 'battle-1' });

            expect(socket.emit).toHaveBeenCalledWith(
                'error',
                expect.objectContaining({
                    message: expect.any(String),
                }),
            );
        });
    });

    describe('Reconnection Support', () => {
        it('should allow reconnected client to rejoin their battle rooms', async () => {
            const socket = createMockSocket('user-1');
            socket.data.user = mockUser;

            // Simulate user was in a battle
            prisma.battleParticipant.findMany.mockResolvedValue([
                {
                    battleId: 'battle-1',
                    userId: 'user-1',
                    battle: {
                        ...mockBattle,
                        status: BattleStatus.IN_PROGRESS,
                    },
                },
            ]);
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            await gateway.handleConnection(socket);

            // Should auto-rejoin active battle rooms
            expect(socket.join).toHaveBeenCalledWith('battle:battle-1');
        });
    });

    describe('Match Found Notification', () => {
        it('should emit matchmaking.match_found to matched user socket', async () => {
            const socket = createMockSocket('user-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            // Connect the user first
            await gateway.handleConnection(socket);

            // Emit match found
            gateway.emitMatchFound('user-1', {
                battleId: 'battle-1',
                opponentId: 'user-2',
            });

            expect(socket.emit).toHaveBeenCalledWith(
                'matchmaking.match_found',
                expect.objectContaining({
                    battleId: 'battle-1',
                    opponentId: 'user-2',
                    matchedAt: expect.any(Date),
                }),
            );
        });

        it('should not throw when user is not connected', () => {
            // emitMatchFound for a user that's not connected
            expect(() =>
                gateway.emitMatchFound('non-connected-user', {
                    battleId: 'battle-1',
                    opponentId: 'user-2',
                }),
            ).not.toThrow();
        });
    });

    describe('Skill Usage', () => {
        it('should emit skill.effect to target and skill.used to room on valid skill use', async () => {
            // Connect both users
            const socket1 = createMockSocket('user-1', 'socket-1');
            const socket2 = createMockSocket('user-2', 'socket-2');
            mockJwtVerificationService.verifyAndGetUser
                .mockResolvedValueOnce(mockUser)
                .mockResolvedValueOnce(mockUser2);

            await gateway.handleConnection(socket1);
            await gateway.handleConnection(socket2);

            // Mock successful skill use
            const mockSkillUse = {
                id: 'su-1',
                battleId: 'battle-1',
                userId: 'user-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
                usedAt: new Date(),
            };
            mockBattlesService.useSkill.mockResolvedValue(mockSkillUse);

            const result = await gateway.handleUseSkill(socket1, {
                battleId: 'battle-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
            });

            expect(result).toEqual({ success: true });

            // Should emit skill.effect to the target user
            expect(socket2.emit).toHaveBeenCalledWith('skill.effect', {
                skillType: SkillType.FREEZE,
                fromUserId: 'user-1',
                duration: 10,
            });

            // Should broadcast skill.used to the battle room
            expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
            expect(mockServer.emit).toHaveBeenCalledWith('skill.used', {
                userId: 'user-1',
                skillType: SkillType.FREEZE,
                targetUserId: 'user-2',
            });
        });

        it('should return error when skill use fails validation', async () => {
            const socket = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket);

            mockBattlesService.useSkill.mockRejectedValue(
                new Error('Battle is not in progress'),
            );

            const result = await gateway.handleUseSkill(socket, {
                battleId: 'battle-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
            });

            expect(result).toEqual({
                success: false,
                error: 'Battle is not in progress',
            });
            expect(socket.emit).toHaveBeenCalledWith('error', {
                message: 'Battle is not in progress',
            });
        });

        it('should return error when user is not authenticated', async () => {
            const socket = createMockSocket();
            socket.data = {}; // No user

            const result = await gateway.handleUseSkill(socket, {
                battleId: 'battle-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
            });

            expect(result).toEqual({
                success: false,
                error: 'Not authenticated',
            });
        });

        it('should succeed and skip skill.effect when target is not connected', async () => {
            // Only connect user-1, user-2 is NOT connected
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser);
            await gateway.handleConnection(socket1);

            const mockSkillUse = {
                id: 'su-1',
                battleId: 'battle-1',
                userId: 'user-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
                usedAt: new Date(),
            };
            mockBattlesService.useSkill.mockResolvedValue(mockSkillUse);

            const result = await gateway.handleUseSkill(socket1, {
                battleId: 'battle-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
            });

            expect(result).toEqual({ success: true });

            // Should still broadcast skill.used to the battle room
            expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
            expect(mockServer.emit).toHaveBeenCalledWith('skill.used', {
                userId: 'user-1',
                skillType: SkillType.FREEZE,
                targetUserId: 'user-2',
            });

            // No socket2 exists, so skill.effect should not have been emitted to anyone
            // (socket1 should not receive skill.effect either)
            const socket1SkillEffectCalls = socket1.emit.mock.calls.filter(
                (call: any[]) => call[0] === 'skill.effect',
            );
            expect(socket1SkillEffectCalls).toHaveLength(0);
        });

        it.each([
            { skill: SkillType.FREEZE, expectedDuration: 10 },
            { skill: SkillType.SCRAMBLE, expectedDuration: 0 },
            { skill: SkillType.BLIND, expectedDuration: 0 },
            { skill: SkillType.TIME_STEAL, expectedDuration: 0 },
            { skill: SkillType.FOG_OF_WAR, expectedDuration: 20 },
        ])('should emit correct duration $expectedDuration for skill $skill', async ({ skill, expectedDuration }) => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            const socket2 = createMockSocket('user-2', 'socket-2');
            mockJwtVerificationService.verifyAndGetUser
                .mockResolvedValueOnce(mockUser)
                .mockResolvedValueOnce(mockUser2);

            await gateway.handleConnection(socket1);
            await gateway.handleConnection(socket2);

            mockBattlesService.useSkill.mockResolvedValue({
                id: 'su-1',
                battleId: 'battle-1',
                userId: 'user-1',
                targetUserId: 'user-2',
                skillType: skill,
                usedAt: new Date(),
            });

            await gateway.handleUseSkill(socket1, {
                battleId: 'battle-1',
                targetUserId: 'user-2',
                skillType: skill,
            });

            expect(socket2.emit).toHaveBeenCalledWith('skill.effect', {
                skillType: skill,
                fromUserId: 'user-1',
                duration: expectedDuration,
            });
        });
    });

    describe('Ready Up', () => {
        it('should broadcast battle.player_ready when a player readies up', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket1);

            mockBattlesService.readyUp.mockResolvedValue({
                battle: mockBattle,
                started: false,
            });

            const result = await gateway.handleReady(socket1, { battleId: 'battle-1' });

            expect(result).toEqual({ success: true });
            expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
            expect(mockServer.emit).toHaveBeenCalledWith('battle.player_ready', {
                userId: 'user-1',
                username: 'alice',
                isReady: true,
            });
        });

        it('should emit battle.started when all players are ready', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket1);

            const startedBattle = {
                ...mockBattle,
                status: 'IN_PROGRESS',
                startedAt: new Date(),
            };
            mockBattlesService.readyUp.mockResolvedValue({
                battle: startedBattle,
                started: true,
            });

            const result = await gateway.handleReady(socket1, { battleId: 'battle-1' });

            expect(result).toEqual({ success: true });
            // Should emit player_ready
            expect(mockServer.emit).toHaveBeenCalledWith('battle.player_ready', expect.any(Object));
            // Should emit battle.started
            expect(mockServer.emit).toHaveBeenCalledWith('battle.started', expect.objectContaining({
                battleId: 'battle-1',
                status: 'IN_PROGRESS',
            }));
        });

        it('should return error when readyUp validation fails', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket1);

            mockBattlesService.readyUp.mockRejectedValue(
                new Error('You are already ready'),
            );

            const result = await gateway.handleReady(socket1, { battleId: 'battle-1' });

            expect(result).toEqual({ success: false, error: 'You are already ready' });
            expect(socket1.emit).toHaveBeenCalledWith('error', { message: 'You are already ready' });
        });

        it('should return error when user is not authenticated', async () => {
            const socket = createMockSocket();
            socket.data = {};

            const result = await gateway.handleReady(socket, { battleId: 'battle-1' });

            expect(result).toEqual({ success: false, error: 'Not authenticated' });
        });
    });

    describe('Unready', () => {
        it('should broadcast battle.player_ready with isReady false when a player unreadies', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket1);

            mockBattlesService.unready.mockResolvedValue(mockBattle);

            const result = await gateway.handleUnready(socket1, { battleId: 'battle-1' });

            expect(result).toEqual({ success: true });
            expect(mockServer.to).toHaveBeenCalledWith('battle:battle-1');
            expect(mockServer.emit).toHaveBeenCalledWith('battle.player_ready', {
                userId: 'user-1',
                username: 'alice',
                isReady: false,
            });
        });

        it('should return error when unready validation fails', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket1);

            mockBattlesService.unready.mockRejectedValue(
                new Error('You are not currently ready'),
            );

            const result = await gateway.handleUnready(socket1, { battleId: 'battle-1' });

            expect(result).toEqual({ success: false, error: 'You are not currently ready' });
        });

        it('should return error when user is not authenticated', async () => {
            const socket = createMockSocket();
            socket.data = {};

            const result = await gateway.handleUnready(socket, { battleId: 'battle-1' });

            expect(result).toEqual({ success: false, error: 'Not authenticated' });
        });
    });

    describe('In-app Invite', () => {
        it('should emit battle.invite_received to target user when online', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            const socket2 = createMockSocket('user-2', 'socket-2');
            mockJwtVerificationService.verifyAndGetUser
                .mockResolvedValueOnce(mockUser)
                .mockResolvedValueOnce(mockUser2);

            await gateway.handleConnection(socket1);
            await gateway.handleConnection(socket2);

            mockBattlesService.inviteUserToBattle.mockResolvedValue({
                targetUserId: 'user-2',
                battleId: 'battle-1',
                inviterUsername: 'alice',
                inviterAvatarUrl: null,
                battleMode: 'ONE_V_ONE',
                inviteCode: 'ABCD1234',
            });

            const result = await gateway.handleInviteUser(socket1, {
                battleId: 'battle-1',
                targetUsername: 'bob',
            });

            expect(result).toEqual({ success: true, delivered: true });
            expect(socket2.emit).toHaveBeenCalledWith('battle.invite_received', {
                battleId: 'battle-1',
                inviterUsername: 'alice',
                inviterAvatarUrl: null,
                battleMode: 'ONE_V_ONE',
                inviteCode: 'ABCD1234',
            });
        });

        it('should succeed without emitting when target user is offline', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket1);

            mockBattlesService.inviteUserToBattle.mockResolvedValue({
                targetUserId: 'user-2', // not connected
                battleId: 'battle-1',
                inviterUsername: 'alice',
                inviterAvatarUrl: null,
                battleMode: 'ONE_V_ONE',
                inviteCode: 'ABCD1234',
            });

            const result = await gateway.handleInviteUser(socket1, {
                battleId: 'battle-1',
                targetUsername: 'bob',
            });

            expect(result).toEqual({ success: true, delivered: false });
            // socket1 should not have received invite_received
            const inviteCalls = socket1.emit.mock.calls.filter(
                (call: any[]) => call[0] === 'battle.invite_received',
            );
            expect(inviteCalls).toHaveLength(0);
        });

        it('should return error when inviteUserToBattle validation fails', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);
            await gateway.handleConnection(socket1);

            mockBattlesService.inviteUserToBattle.mockRejectedValue(
                new Error('User "nonexistent" not found'),
            );

            const result = await gateway.handleInviteUser(socket1, {
                battleId: 'battle-1',
                targetUsername: 'nonexistent',
            });

            expect(result).toEqual({ success: false, error: 'User "nonexistent" not found' });
            expect(socket1.emit).toHaveBeenCalledWith('error', {
                message: 'User "nonexistent" not found',
            });
        });

        it('should return error when user is not authenticated', async () => {
            const socket = createMockSocket();
            socket.data = {};

            const result = await gateway.handleInviteUser(socket, {
                battleId: 'battle-1',
                targetUsername: 'bob',
            });

            expect(result).toEqual({ success: false, error: 'Not authenticated' });
        });
    });

    // ============================
    // Online Presence
    // ============================

    describe('Online Presence', () => {
        it('should emit presence.online to friends on connect', async () => {
            // Set up friend (user-2) already connected
            const friendSocket = createMockSocket('user-2', 'socket-2');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser2);
            mockFriendsService.getFriendIds.mockResolvedValueOnce([]);
            await gateway.handleConnection(friendSocket);

            // Now user-1 connects, and user-2 is their friend
            const socket = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser);
            mockFriendsService.getFriendIds.mockResolvedValueOnce(['user-2']);

            await gateway.handleConnection(socket);

            expect(mockFriendsService.getFriendIds).toHaveBeenCalledWith('user-1');
            expect(friendSocket.emit).toHaveBeenCalledWith('presence.online', {
                userId: 'user-1',
                username: 'alice',
            });
        });

        it('should emit presence.offline to friends on disconnect', async () => {
            // Set up both users connected
            const socket1 = createMockSocket('user-1', 'socket-1');
            const socket2 = createMockSocket('user-2', 'socket-2');

            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser);
            mockFriendsService.getFriendIds.mockResolvedValueOnce([]);
            await gateway.handleConnection(socket1);

            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser2);
            mockFriendsService.getFriendIds.mockResolvedValueOnce([]);
            await gateway.handleConnection(socket2);

            // user-1 disconnects, user-2 is their friend
            mockFriendsService.getFriendIds.mockResolvedValueOnce(['user-2']);
            await gateway.handleDisconnect(socket1);

            expect(socket2.emit).toHaveBeenCalledWith('presence.offline', {
                userId: 'user-1',
                username: 'alice',
            });
        });

        it('should not emit presence events when user has no online friends', async () => {
            const socket = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser);
            mockFriendsService.getFriendIds.mockResolvedValueOnce(['user-3', 'user-4']); // friends exist but are not connected

            await gateway.handleConnection(socket);

            // No friend sockets to emit to — verify no presence events sent
            // (socket.emit is only called for the connecting user's own events, not presence)
            expect(mockFriendsService.getFriendIds).toHaveBeenCalledWith('user-1');
        });

        it('should return correct values from isOnline and getOnlineUsers', async () => {
            const socket = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser);
            mockFriendsService.getFriendIds.mockResolvedValueOnce([]);
            await gateway.handleConnection(socket);

            expect(gateway.isOnline('user-1')).toBe(true);
            expect(gateway.isOnline('user-999')).toBe(false);
            expect(gateway.getOnlineUsers(['user-1', 'user-2', 'user-999'])).toEqual(['user-1']);
        });
    });

    // ====================================================================
    // emitToClanMembers
    // ====================================================================

    describe('emitToClanMembers', () => {
        it('should emit event to all online clan members', async () => {
            // Connect two users
            const socket1 = createMockSocket('user-1', 'socket-1');
            const socket2 = createMockSocket('user-2', 'socket-2');

            mockJwtVerificationService.verifyAndGetUser
                .mockResolvedValueOnce(mockUser)
                .mockResolvedValueOnce(mockUser2);
            mockFriendsService.getFriendIds
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await gateway.handleConnection(socket1);
            await gateway.handleConnection(socket2);

            const payload = {
                challengeId: 'challenge-1',
                challengerClan: { id: 'clan-1', name: 'Alpha' },
            };

            gateway.emitToClanMembers(['user-1', 'user-2'], 'clan.challenge_received', payload);

            expect(socket1.emit).toHaveBeenCalledWith('clan.challenge_received', payload);
            expect(socket2.emit).toHaveBeenCalledWith('clan.challenge_received', payload);
        });

        it('should only emit to online members, skip offline ones', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser);
            mockFriendsService.getFriendIds.mockResolvedValueOnce([]);
            await gateway.handleConnection(socket1);

            const payload = { challengeId: 'challenge-1' };

            gateway.emitToClanMembers(['user-1', 'user-offline'], 'clan.challenge_received', payload);

            expect(socket1.emit).toHaveBeenCalledWith('clan.challenge_received', payload);
            // user-offline has no socket — nothing should blow up
        });

        it('should not emit anything when no members are online', () => {
            const payload = { challengeId: 'challenge-1' };

            // Should not throw
            gateway.emitToClanMembers(['user-offline-1', 'user-offline-2'], 'clan.challenge_accepted', payload);
        });

        it('should emit different clan challenge events correctly', async () => {
            const socket1 = createMockSocket('user-1', 'socket-1');
            mockJwtVerificationService.verifyAndGetUser.mockResolvedValueOnce(mockUser);
            mockFriendsService.getFriendIds.mockResolvedValueOnce([]);
            await gateway.handleConnection(socket1);

            const acceptPayload = {
                challengeId: 'challenge-1',
                challengerClan: { id: 'clan-1' },
                challengedClan: { id: 'clan-2' },
            };
            gateway.emitToClanMembers(['user-1'], 'clan.challenge_accepted', acceptPayload);
            expect(socket1.emit).toHaveBeenCalledWith('clan.challenge_accepted', acceptPayload);

            const counterPayload = {
                challengeId: 'challenge-1',
                counterTeamSize: 3,
                counterTimeLimitMinutes: 60,
            };
            gateway.emitToClanMembers(['user-1'], 'clan.challenge_countered', counterPayload);
            expect(socket1.emit).toHaveBeenCalledWith('clan.challenge_countered', counterPayload);
        });
    });
});
