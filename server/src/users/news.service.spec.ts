import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
    BattleMode,
    BattleStatus,
    ClanChallengeStatus,
    FriendshipStatus,
} from '@prisma/client';
import { NewsService } from './news.service';
import { PrismaService } from '../prisma/prisma.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';

// Fixed "now" — all relative timestamps in fixtures below are anchored to
// this value so the "computed EXPIRED" branch is deterministic.
const NOW = new Date('2026-04-23T12:00:00.000Z');

function hoursAgo(h: number): Date {
    return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}
function hoursFromNow(h: number): Date {
    return new Date(NOW.getTime() + h * 60 * 60 * 1000);
}

const clanA = { id: 'clan-a', name: 'Alpha', tag: 'ALP' };
const clanB = { id: 'clan-b', name: 'Bravo', tag: 'BRV' };

const viewer = {
    id: 'viewer-1',
    username: 'viewer',
    avatarUrl: null,
};
const friendOne = {
    id: 'friend-1',
    username: 'alice',
    avatarUrl: null,
};
const stranger = {
    id: 'stranger-1',
    username: 'bob',
    avatarUrl: null,
};

describe('NewsService', () => {
    let service: NewsService;
    let prisma: MockPrismaService;

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW);

        const mockPrisma = createMockPrismaService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NewsService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<NewsService>(NewsService);
        prisma = module.get<MockPrismaService>(PrismaService);

        // By default: viewer exists, has one friend, no news rows. Specific
        // tests override these mocks.
        prisma.user.findUnique.mockResolvedValue({ id: viewer.id });
        prisma.friendship.findMany.mockResolvedValue([
            {
                requesterId: viewer.id,
                addresseeId: friendOne.id,
            },
        ]);
        prisma.clanChallenge.findMany.mockResolvedValue([]);
        prisma.battle.findMany.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('throws when viewer does not exist', async () => {
        prisma.user.findUnique.mockResolvedValueOnce(null);
        await expect(
            service.getNews('ghost-user'),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    describe('clan challenge mapping', () => {
        it('maps PENDING challenge to a CLAN_CHALLENGE_SENT event (neutral, not shame)', async () => {
            prisma.clanChallenge.findMany.mockResolvedValue([
                {
                    id: 'ch-1',
                    status: ClanChallengeStatus.PENDING,
                    createdAt: hoursAgo(3),
                    updatedAt: hoursAgo(3),
                    respondedAt: null,
                    expiresAt: hoursFromNow(10),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'clan',
            });

            expect(items).toHaveLength(1);
            expect(items[0]).toMatchObject({
                type: 'CLAN_CHALLENGE_SENT',
                severity: 'neutral',
                isShame: false,
                category: 'clan',
            });
            expect(items[0].text).toContain('Alpha');
            expect(items[0].text).toContain('Bravo');
            expect(items[0].text.toLowerCase()).toContain('challenged');
        });

        it('maps ACCEPTED to both SENT and ACCEPTED items at correct timestamps', async () => {
            prisma.clanChallenge.findMany.mockResolvedValue([
                {
                    id: 'ch-2',
                    status: ClanChallengeStatus.ACCEPTED,
                    createdAt: hoursAgo(5),
                    updatedAt: hoursAgo(1),
                    respondedAt: hoursAgo(1),
                    expiresAt: hoursFromNow(19),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'clan',
            });

            const types = items.map((i) => i.type);
            expect(types).toEqual(
                expect.arrayContaining([
                    'CLAN_CHALLENGE_SENT',
                    'CLAN_CHALLENGE_ACCEPTED',
                ]),
            );
            const accepted = items.find(
                (i) => i.type === 'CLAN_CHALLENGE_ACCEPTED',
            );
            expect(accepted?.severity).toBe('positive');
            expect(accepted?.isShame).toBe(false);
        });

        it('marks DECLINED as negative + shame', async () => {
            prisma.clanChallenge.findMany.mockResolvedValue([
                {
                    id: 'ch-3',
                    status: ClanChallengeStatus.DECLINED,
                    createdAt: hoursAgo(4),
                    updatedAt: hoursAgo(1),
                    respondedAt: hoursAgo(1),
                    expiresAt: hoursFromNow(20),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'clan',
            });
            const declined = items.find(
                (i) => i.type === 'CLAN_CHALLENGE_DECLINED',
            );
            expect(declined).toBeDefined();
            expect(declined?.isShame).toBe(true);
            expect(declined?.severity).toBe('negative');
            expect(declined?.text.toLowerCase()).toContain('declined');
        });

        it('computes EXPIRED when a PENDING row has passed its expiresAt', async () => {
            prisma.clanChallenge.findMany.mockResolvedValue([
                {
                    id: 'ch-4',
                    status: ClanChallengeStatus.PENDING,
                    createdAt: hoursAgo(30),
                    updatedAt: hoursAgo(30),
                    respondedAt: null,
                    expiresAt: hoursAgo(6),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'clan',
            });

            const expired = items.find(
                (i) => i.type === 'CLAN_CHALLENGE_EXPIRED',
            );
            expect(expired).toBeDefined();
            expect(expired?.isShame).toBe(true);
            expect(expired?.severity).toBe('negative');
            // Expired timestamp should be the row's expiresAt, not now.
            expect(expired?.timestamp).toBe(hoursAgo(6).toISOString());
        });

        it('marks COUNTERED as warning, not shame', async () => {
            prisma.clanChallenge.findMany.mockResolvedValue([
                {
                    id: 'ch-5',
                    status: ClanChallengeStatus.COUNTERED,
                    createdAt: hoursAgo(6),
                    updatedAt: hoursAgo(1),
                    respondedAt: hoursAgo(1),
                    expiresAt: hoursFromNow(20),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'clan',
            });
            const countered = items.find(
                (i) => i.type === 'CLAN_CHALLENGE_COUNTERED',
            );
            expect(countered).toBeDefined();
            expect(countered?.severity).toBe('warning');
            expect(countered?.isShame).toBe(false);
        });
    });

    describe('friend battle results', () => {
        it('includes a battle only when a friend participated', async () => {
            prisma.friendship.findMany.mockResolvedValue([
                { requesterId: viewer.id, addresseeId: friendOne.id },
            ]);

            prisma.battle.findMany.mockResolvedValue([
                {
                    id: 'battle-1',
                    mode: BattleMode.ONE_V_ONE,
                    status: BattleStatus.COMPLETED,
                    winnerId: friendOne.id,
                    winningTeam: null,
                    endedAt: hoursAgo(1),
                    createdAt: hoursAgo(2),
                    participants: [
                        {
                            userId: friendOne.id,
                            teamId: null,
                            user: friendOne,
                        },
                        {
                            userId: stranger.id,
                            teamId: null,
                            user: stranger,
                        },
                    ],
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'friends',
            });

            expect(items).toHaveLength(1);
            expect(items[0]).toMatchObject({
                type: 'FRIEND_BATTLE_RESULT',
                category: 'friends',
                isShame: false,
            });
            expect(items[0].text).toContain('alice');
            expect(items[0].text).toContain('bob');
            expect(items[0].text.toLowerCase()).toContain('defeated');
        });

        it('skips friend battles entirely when viewer has no friends', async () => {
            prisma.friendship.findMany.mockResolvedValue([]);
            prisma.battle.findMany.mockResolvedValue([
                {
                    id: 'battle-1',
                    mode: BattleMode.ONE_V_ONE,
                    status: BattleStatus.COMPLETED,
                    winnerId: stranger.id,
                    winningTeam: null,
                    endedAt: hoursAgo(1),
                    createdAt: hoursAgo(2),
                    participants: [
                        {
                            userId: stranger.id,
                            teamId: null,
                            user: stranger,
                        },
                    ],
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'friends',
            });
            expect(items).toEqual([]);
            // Should not have even queried battles, since friend set is empty
            expect(prisma.battle.findMany).not.toHaveBeenCalled();
        });

        it('renders a draw event for battles with no winner', async () => {
            prisma.battle.findMany.mockResolvedValue([
                {
                    id: 'battle-2',
                    mode: BattleMode.ONE_V_ONE,
                    status: BattleStatus.COMPLETED,
                    winnerId: null,
                    winningTeam: null,
                    endedAt: hoursAgo(1),
                    createdAt: hoursAgo(2),
                    participants: [
                        { userId: friendOne.id, teamId: null, user: friendOne },
                        { userId: stranger.id, teamId: null, user: stranger },
                    ],
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'friends',
            });

            expect(items).toHaveLength(1);
            expect(items[0].isDraw).toBe(true);
            expect(items[0].severity).toBe('neutral');
            expect(items[0].text.toLowerCase()).toContain('drew');
        });
    });

    describe('merge, filter and pagination', () => {
        it('sorts merged items by timestamp desc', async () => {
            prisma.clanChallenge.findMany.mockResolvedValue([
                {
                    id: 'ch-10',
                    status: ClanChallengeStatus.PENDING,
                    createdAt: hoursAgo(10),
                    updatedAt: hoursAgo(10),
                    respondedAt: null,
                    expiresAt: hoursFromNow(14),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
            ]);
            prisma.battle.findMany.mockResolvedValue([
                {
                    id: 'battle-new',
                    mode: BattleMode.ONE_V_ONE,
                    status: BattleStatus.COMPLETED,
                    winnerId: friendOne.id,
                    winningTeam: null,
                    endedAt: hoursAgo(2),
                    createdAt: hoursAgo(3),
                    participants: [
                        { userId: friendOne.id, teamId: null, user: friendOne },
                        { userId: stranger.id, teamId: null, user: stranger },
                    ],
                },
            ]);

            const { items } = await service.getNews(viewer.id);

            expect(items.length).toBeGreaterThanOrEqual(2);
            const timestamps = items.map((i) =>
                new Date(i.timestamp).getTime(),
            );
            const sorted = [...timestamps].sort((a, b) => b - a);
            expect(timestamps).toEqual(sorted);
        });

        it('restricts results to shame items when filter=shame', async () => {
            prisma.clanChallenge.findMany.mockResolvedValue([
                {
                    id: 'ch-a',
                    status: ClanChallengeStatus.PENDING, // -> SENT only (not shame)
                    createdAt: hoursAgo(2),
                    updatedAt: hoursAgo(2),
                    respondedAt: null,
                    expiresAt: hoursFromNow(20),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
                {
                    id: 'ch-b',
                    status: ClanChallengeStatus.DECLINED, // -> SENT + DECLINED (shame)
                    createdAt: hoursAgo(5),
                    updatedAt: hoursAgo(1),
                    respondedAt: hoursAgo(1),
                    expiresAt: hoursFromNow(19),
                    challengerClan: clanA,
                    challengedClan: clanB,
                },
            ]);

            const { items } = await service.getNews(viewer.id, {
                filter: 'shame',
            });

            expect(items.length).toBeGreaterThan(0);
            expect(items.every((i) => i.isShame)).toBe(true);
        });

        it('emits nextCursor when more items exist than limit', async () => {
            const rows = Array.from({ length: 20 }, (_, i) => ({
                id: `ch-${i}`,
                status: ClanChallengeStatus.PENDING,
                createdAt: hoursAgo(i + 1),
                updatedAt: hoursAgo(i + 1),
                respondedAt: null,
                expiresAt: hoursFromNow(20),
                challengerClan: clanA,
                challengedClan: clanB,
            }));
            prisma.clanChallenge.findMany.mockResolvedValue(rows);

            const { items, nextCursor } = await service.getNews(viewer.id, {
                limit: 5,
                filter: 'clan',
            });

            expect(items).toHaveLength(5);
            expect(nextCursor).not.toBeNull();
        });

        it('skips challenge source when filter=friends (no prisma call)', async () => {
            await service.getNews(viewer.id, { filter: 'friends' });
            expect(prisma.clanChallenge.findMany).not.toHaveBeenCalled();
        });

        it('skips battle source when filter=clan (no prisma call)', async () => {
            await service.getNews(viewer.id, { filter: 'clan' });
            expect(prisma.battle.findMany).not.toHaveBeenCalled();
            expect(prisma.friendship.findMany).not.toHaveBeenCalled();
        });
    });

    it('resolves friend set via accepted friendships (both directions)', async () => {
        prisma.friendship.findMany.mockResolvedValue([
            { requesterId: viewer.id, addresseeId: friendOne.id },
            { requesterId: 'other-friend', addresseeId: viewer.id },
        ]);
        prisma.battle.findMany.mockResolvedValue([]);

        await service.getNews(viewer.id, { filter: 'friends' });

        expect(prisma.friendship.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: FriendshipStatus.ACCEPTED,
                }),
            }),
        );
        // battle.findMany should be called with the viewer + both friends in
        // the `userId IN (...)` clause so the viewer sees matches involving
        // themselves too.
        expect(prisma.battle.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    participants: expect.objectContaining({
                        some: {
                            userId: {
                                in: expect.arrayContaining([
                                    viewer.id,
                                    friendOne.id,
                                    'other-friend',
                                ]),
                            },
                        },
                    }),
                }),
            }),
        );
    });
});
