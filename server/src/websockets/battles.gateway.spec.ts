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
import { BattleStatus } from '@prisma/client';

describe('BattlesGateway', () => {
    let gateway: BattlesGateway;
    let prisma: MockPrismaService;
    let mockBattlesService: {
        getBattleDetails: jest.Mock;
        joinBattle: jest.Mock;
        submitSolution: jest.Mock;
        completeBattle: jest.Mock;
        createBattle: jest.Mock;
    };
    let mockServer: {
        to: jest.Mock;
        emit: jest.Mock;
        in: jest.Mock;
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
        };

        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            in: jest.fn().mockReturnThis(),
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
                WsAuthGuard,
            ],
        }).compile();

        gateway = module.get<BattlesGateway>(BattlesGateway);
        prisma = module.get<MockPrismaService>(PrismaService);

        // Inject mock server
        gateway.server = mockServer as any;
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('Gateway Initialization', () => {
        it('should initialize the server properly', () => {
            const server = {} as Server;
            gateway.afterInit(server);
            // afterInit should complete without errors
            expect(gateway).toBeDefined();
        });
    });

    describe('Connection Handling', () => {
        it('should accept connection with valid JWT token and attach user to socket', async () => {
            const socket = createMockSocket('user-1');
            prisma.user.findUnique.mockResolvedValue(mockUser);

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
            // User lookup fails for invalid token
            prisma.user.findUnique.mockResolvedValue(null);

            await gateway.handleConnection(socket);

            expect(socket.disconnect).toHaveBeenCalled();
        });

        it('should track connected clients', async () => {
            const socket = createMockSocket('user-1');
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await gateway.handleConnection(socket);

            expect(gateway.getConnectedClients().has(socket.id)).toBe(true);
        });
    });

    describe('Disconnection Handling', () => {
        it('should handle disconnect and remove client from tracking', async () => {
            const socket = createMockSocket('user-1');
            prisma.user.findUnique.mockResolvedValue(mockUser);

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
            prisma.user.findUnique.mockResolvedValue(mockUser);

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
            prisma.user.findUnique
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
            prisma.user.findUnique.mockResolvedValue(mockUser);

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
            prisma.user.findUnique.mockResolvedValue(mockUser);

            await gateway.handleConnection(socket);

            // Should auto-rejoin active battle rooms
            expect(socket.join).toHaveBeenCalledWith('battle:battle-1');
        });
    });
});
