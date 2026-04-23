import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { PrismaService } from '../prisma/prisma.service';
import { BattlesGateway } from '../websockets/battles.gateway';
import { BattlesService } from '../battles/battles.service';
import { FriendsService } from '../friends/friends.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import { BattleMode } from '@prisma/client';

// Lightweight mock of a Socket.IO socket used by the gateway's connectedClients
// map. Only the fields LobbyService actually reads are populated.
type MockSocket = {
    id: string;
    data: { user: { id: string; username: string } };
    emit: jest.Mock;
};

function makeSocket(userId: string, username = userId): MockSocket {
    return {
        id: `sock-${userId}`,
        data: { user: { id: userId, username } },
        emit: jest.fn(),
    };
}

describe('LobbyService', () => {
    let service: LobbyService;
    let prisma: MockPrismaService;
    let battlesGateway: {
        getConnectedClients: jest.Mock;
        isOnline: jest.Mock;
        getSocketByUserId: jest.Mock;
    };
    let battlesService: {
        createBattle: jest.Mock;
        inviteUserToBattle: jest.Mock;
    };
    let friendsService: { sendRequest: jest.Mock };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        battlesGateway = {
            getConnectedClients: jest.fn(() => new Map<string, MockSocket>()),
            isOnline: jest.fn(),
            getSocketByUserId: jest.fn(),
        };
        battlesService = {
            createBattle: jest.fn(),
            inviteUserToBattle: jest.fn(),
        };
        friendsService = {
            sendRequest: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LobbyService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: BattlesGateway, useValue: battlesGateway },
                { provide: BattlesService, useValue: battlesService },
                { provide: FriendsService, useValue: friendsService },
            ],
        }).compile();

        service = module.get<LobbyService>(LobbyService);
        prisma = module.get<MockPrismaService>(PrismaService);
    });

    describe('getSnapshot', () => {
        it('returns empty snapshot when no one is online', async () => {
            battlesGateway.getConnectedClients.mockReturnValue(
                new Map<string, MockSocket>(),
            );

            const result = await service.getSnapshot('user-1');

            expect(result).toEqual({ users: [], clans: [], onlineCount: 0 });
            expect(prisma.user.findMany).not.toHaveBeenCalled();
        });

        it('returns online users (excluding self) with friendship hints and clans', async () => {
            const connections = new Map<string, MockSocket>();
            connections.set('s-1', makeSocket('user-1', 'alice'));
            connections.set('s-2', makeSocket('user-2', 'bob'));
            connections.set('s-3', makeSocket('user-3', 'charlie'));
            battlesGateway.getConnectedClients.mockReturnValue(connections);

            prisma.user.findMany.mockResolvedValueOnce([
                {
                    id: 'user-1',
                    username: 'alice',
                    avatarUrl: null,
                    mmr: 1400,
                    clan: { id: 'clan-a', name: 'Ants', tag: 'ANT', mmr: 1300 },
                },
                {
                    id: 'user-2',
                    username: 'bob',
                    avatarUrl: null,
                    mmr: 1200,
                    clan: { id: 'clan-a', name: 'Ants', tag: 'ANT', mmr: 1300 },
                },
                {
                    id: 'user-3',
                    username: 'charlie',
                    avatarUrl: null,
                    mmr: 1100,
                    clan: null,
                },
            ]);
            prisma.friendship.findMany.mockResolvedValueOnce([
                {
                    id: 'f-1',
                    requesterId: 'user-1',
                    addresseeId: 'user-2',
                    status: 'ACCEPTED',
                },
                {
                    id: 'f-2',
                    requesterId: 'user-3',
                    addresseeId: 'user-1',
                    status: 'PENDING',
                },
            ]);
            prisma.user.groupBy.mockResolvedValueOnce([
                { clanId: 'clan-a', _count: { _all: 2 } },
            ]);
            prisma.clan.findMany.mockResolvedValueOnce([
                {
                    id: 'clan-a',
                    name: 'Ants',
                    tag: 'ANT',
                    mmr: 1300,
                    _count: { members: 5 },
                },
            ]);

            const result = await service.getSnapshot('user-1');

            expect(result.onlineCount).toBe(3);
            expect(result.users).toHaveLength(2);
            const byId = Object.fromEntries(result.users.map((u) => [u.id, u]));
            expect(byId['user-2'].friendship).toBe('ACCEPTED');
            expect(byId['user-3'].friendship).toBe('PENDING_IN');
            expect(byId['user-3'].friendshipId).toBe('f-2');
            expect(result.clans).toEqual([
                {
                    id: 'clan-a',
                    name: 'Ants',
                    tag: 'ANT',
                    mmr: 1300,
                    memberCount: 5,
                    onlineCount: 2,
                },
            ]);
        });

        it('marks PENDING_OUT when self is the requester', async () => {
            const connections = new Map<string, MockSocket>();
            connections.set('s-1', makeSocket('user-1'));
            connections.set('s-2', makeSocket('user-2'));
            battlesGateway.getConnectedClients.mockReturnValue(connections);

            prisma.user.findMany.mockResolvedValueOnce([
                {
                    id: 'user-1',
                    username: 'alice',
                    avatarUrl: null,
                    mmr: 1000,
                    clan: null,
                },
                {
                    id: 'user-2',
                    username: 'bob',
                    avatarUrl: null,
                    mmr: 1100,
                    clan: null,
                },
            ]);
            prisma.friendship.findMany.mockResolvedValueOnce([
                {
                    id: 'f-1',
                    requesterId: 'user-1',
                    addresseeId: 'user-2',
                    status: 'PENDING',
                },
            ]);
            prisma.user.groupBy.mockResolvedValueOnce([]);

            const result = await service.getSnapshot('user-1');
            expect(result.users).toHaveLength(1);
            expect(result.users[0].friendship).toBe('PENDING_OUT');
        });
    });

    describe('sendFriendRequestById', () => {
        it('rejects self-requests', async () => {
            await expect(
                service.sendFriendRequestById('user-1', 'user-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws when target user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValueOnce(null);
            await expect(
                service.sendFriendRequestById('user-1', 'ghost'),
            ).rejects.toThrow(NotFoundException);
        });

        it('delegates to FriendsService.sendRequest with the resolved username', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({ username: 'bob' });
            friendsService.sendRequest.mockResolvedValueOnce({ id: 'f-new' });

            const result = await service.sendFriendRequestById(
                'user-1',
                'user-2',
            );
            expect(friendsService.sendRequest).toHaveBeenCalledWith(
                'user-1',
                'bob',
            );
            expect(result).toEqual({ id: 'f-new' });
        });
    });

    describe('challengeUser', () => {
        it('rejects challenging self', async () => {
            await expect(
                service.challengeUser('user-1', 'user-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws when the target does not exist', async () => {
            prisma.user.findUnique.mockResolvedValueOnce(null);
            await expect(
                service.challengeUser('user-1', 'ghost'),
            ).rejects.toThrow(NotFoundException);
        });

        it('throws when the target is offline', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'user-2',
                username: 'bob',
            });
            battlesGateway.isOnline.mockReturnValueOnce(false);

            await expect(
                service.challengeUser('user-1', 'user-2'),
            ).rejects.toThrow(BadRequestException);
        });

        it('creates a 1v1 battle, delivers the invite, and returns metadata', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'user-2',
                username: 'bob',
            });
            battlesGateway.isOnline.mockReturnValueOnce(true);
            battlesService.createBattle.mockResolvedValueOnce({
                id: 'battle-1',
                inviteCode: 'ABC123',
            });
            battlesService.inviteUserToBattle.mockResolvedValueOnce({
                targetUserId: 'user-2',
                battleId: 'battle-1',
                inviterUsername: 'alice',
                inviterAvatarUrl: null,
                battleMode: BattleMode.ONE_V_ONE,
                inviteCode: 'ABC123',
            });
            const targetSocket = makeSocket('user-2', 'bob');
            battlesGateway.getSocketByUserId.mockReturnValueOnce(targetSocket);

            const result = await service.challengeUser('user-1', 'user-2', 10);

            expect(battlesService.createBattle).toHaveBeenCalledWith('user-1', {
                mode: BattleMode.ONE_V_ONE,
                withInviteCode: true,
                timeLimitMinutes: 10,
            });
            expect(battlesService.inviteUserToBattle).toHaveBeenCalledWith(
                'battle-1',
                'user-1',
                'bob',
            );
            expect(targetSocket.emit).toHaveBeenCalledWith(
                'battle.invite_received',
                expect.objectContaining({
                    battleId: 'battle-1',
                    inviterUsername: 'alice',
                    inviteCode: 'ABC123',
                }),
            );
            expect(result).toEqual({
                battleId: 'battle-1',
                inviteCode: 'ABC123',
                delivered: true,
            });
        });

        it('reports delivered=false when the target has no live socket', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'user-2',
                username: 'bob',
            });
            battlesGateway.isOnline.mockReturnValueOnce(true);
            battlesService.createBattle.mockResolvedValueOnce({
                id: 'battle-1',
                inviteCode: 'ABC123',
            });
            battlesService.inviteUserToBattle.mockResolvedValueOnce({
                targetUserId: 'user-2',
                battleId: 'battle-1',
                inviterUsername: 'alice',
                inviterAvatarUrl: null,
                battleMode: BattleMode.ONE_V_ONE,
                inviteCode: 'ABC123',
            });
            battlesGateway.getSocketByUserId.mockReturnValueOnce(undefined);

            const result = await service.challengeUser('user-1', 'user-2');
            expect(result.delivered).toBe(false);
        });
    });
});
