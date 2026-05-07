import { Test, TestingModule } from '@nestjs/testing';
import { BattleMode, BattleStatus } from '@prisma/client';
import { RankingsService } from './rankings.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';
import {
  createMockPrismaService,
  MockPrismaService,
} from '../__mocks__/prisma.service';

const FIXED_NOW = new Date('2026-05-08T15:30:45Z'); // Friday
const EXPECTED_DAILY_SINCE = new Date('2026-05-08T00:00:00Z');
const EXPECTED_WEEKLY_SINCE = new Date('2026-05-04T00:00:00Z'); // Monday
const EXPECTED_MONTHLY_SINCE = new Date('2026-05-01T00:00:00Z');

describe('RankingsService', () => {
  let service: RankingsService;
  let prisma: MockPrismaService;
  let friends: { getFriendIds: jest.Mock };

  beforeEach(async () => {
    const mockPrisma = createMockPrismaService();
    friends = { getFriendIds: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FriendsService, useValue: friends },
      ],
    }).compile();

    service = module.get<RankingsService>(RankingsService);
    prisma = module.get<MockPrismaService>(PrismaService);
  });

  // ============================
  // periodToWindow
  // ============================

  describe('periodToWindow', () => {
    it('returns null for alltime', () => {
      expect(service.periodToWindow('alltime', FIXED_NOW)).toBeNull();
    });

    it('returns today UTC midnight for daily', () => {
      expect(service.periodToWindow('daily', FIXED_NOW)).toEqual(EXPECTED_DAILY_SINCE);
    });

    it('returns this UTC Monday for weekly', () => {
      expect(service.periodToWindow('weekly', FIXED_NOW)).toEqual(EXPECTED_WEEKLY_SINCE);
    });

    it('returns the 1st of the current UTC month for monthly', () => {
      expect(service.periodToWindow('monthly', FIXED_NOW)).toEqual(EXPECTED_MONTHLY_SINCE);
    });

    it('handles a Sunday correctly (weekly should be the prior Monday)', () => {
      const sunday = new Date('2026-05-10T12:00:00Z');
      expect(service.periodToWindow('weekly', sunday)).toEqual(
        new Date('2026-05-04T00:00:00Z'),
      );
    });

    it('handles a Monday correctly (weekly should be that same Monday at 00:00)', () => {
      const monday = new Date('2026-05-04T18:30:00Z');
      expect(service.periodToWindow('weekly', monday)).toEqual(
        new Date('2026-05-04T00:00:00Z'),
      );
    });
  });

  // ============================
  // getGlobalRankings — alltime fast path
  // ============================

  describe('getGlobalRankings — alltime', () => {
    it('sorts by user.mmr DESC and attaches tier and rank', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', username: 'alice', avatarUrl: null, mmr: 1700, clan: null },
        { id: 'u2', username: 'bob', avatarUrl: 'x.png', mmr: 1500, clan: { tag: 'ABC', name: 'ABCs' } },
        { id: 'u3', username: 'carol', avatarUrl: null, mmr: 1100, clan: null },
      ]);

      const out = await service.getGlobalRankings({ period: 'alltime' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { mmr: 'desc' },
          take: 50,
          skip: 0,
        }),
      );
      expect(out).toHaveLength(3);
      expect(out[0]).toMatchObject({ id: 'u1', rank: 1, mmrGained: 0, gamesPlayed: 0 });
      expect(out[0].tier.name).toBe('10x Dev');
      expect(out[1]).toMatchObject({ id: 'u2', rank: 2, clan: { tag: 'ABC', name: 'ABCs' } });
      expect(out[2]).toMatchObject({ id: 'u3', rank: 3 });
      expect(out[0].winsInLanguage).toBeUndefined();
    });

    it('respects offset when assigning rank', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u11', username: 'eleventh', avatarUrl: null, mmr: 1200, clan: null },
      ]);

      const out = await service.getGlobalRankings({ period: 'alltime', limit: 1, offset: 10 });

      expect(out[0].rank).toBe(11);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 1 }),
      );
    });

    it('caps limit at 100', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.getGlobalRankings({ period: 'alltime', limit: 500 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ============================
  // getGlobalRankings — period window
  // ============================

  describe('getGlobalRankings — period window', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_NOW);
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('queries with endedAt >= weekly window and aggregates wins/losses/mmrGained', async () => {
      // u1: two 1v1 wins (+15, +10), u2: one 1v1 loss (-15), u3: one team win (+8)
      prisma.battleParticipant.findMany.mockResolvedValue([
        {
          userId: 'u1', teamId: null, language: 'python', mmrChange: 15,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: 'u1', winningTeam: null },
        },
        {
          userId: 'u1', teamId: null, language: 'python', mmrChange: 10,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: 'u1', winningTeam: null },
        },
        {
          userId: 'u2', teamId: null, language: 'javascript', mmrChange: -15,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: 'u1', winningTeam: null },
        },
        {
          userId: 'u3', teamId: 'team-1', language: 'python', mmrChange: 8,
          battle: { mode: BattleMode.CLAN_WARS, winnerId: null, winningTeam: 'team-1' },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', username: 'alice', avatarUrl: null, mmr: 1700, clan: null },
        { id: 'u3', username: 'carol', avatarUrl: null, mmr: 1100, clan: null },
        { id: 'u2', username: 'bob', avatarUrl: null, mmr: 1500, clan: null },
      ]);

      const out = await service.getGlobalRankings({ period: 'weekly' });

      expect(prisma.battleParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            battle: expect.objectContaining({
              status: BattleStatus.COMPLETED,
              endedAt: { gte: EXPECTED_WEEKLY_SINCE },
            }),
          }),
        }),
      );
      // mmrGained DESC: u1 (+25), u3 (+8), u2 (-15)
      expect(out.map((r) => r.id)).toEqual(['u1', 'u3', 'u2']);
      expect(out[0]).toMatchObject({
        id: 'u1', rank: 1, mmrGained: 25, winsInPeriod: 2, lossesInPeriod: 0, gamesPlayed: 2,
      });
      expect(out[1]).toMatchObject({
        id: 'u3', rank: 2, mmrGained: 8, winsInPeriod: 1, lossesInPeriod: 0, gamesPlayed: 1,
      });
      expect(out[2]).toMatchObject({
        id: 'u2', rank: 3, mmrGained: -15, winsInPeriod: 0, lossesInPeriod: 1, gamesPlayed: 1,
      });
    });

    it('treats draws (winnerId=null, no winningTeam) as games with no W/L credit', async () => {
      prisma.battleParticipant.findMany.mockResolvedValue([
        {
          userId: 'u1', teamId: null, language: 'python', mmrChange: 0,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: null, winningTeam: null },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', username: 'alice', avatarUrl: null, mmr: 1500, clan: null },
      ]);

      const out = await service.getGlobalRankings({ period: 'daily' });
      expect(out[0]).toMatchObject({
        id: 'u1', winsInPeriod: 0, lossesInPeriod: 0, gamesPlayed: 1, mmrGained: 0,
      });
    });

    it('returns empty array when nobody played in window', async () => {
      prisma.battleParticipant.findMany.mockResolvedValue([]);
      const out = await service.getGlobalRankings({ period: 'daily' });
      expect(out).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // ============================
  // getGlobalRankings — language filter
  // ============================

  describe('getGlobalRankings — language filter', () => {
    it('passes case-insensitive language filter and sorts by winsInLanguage DESC', async () => {
      prisma.battleParticipant.findMany.mockResolvedValue([
        // u1: 1 python win
        {
          userId: 'u1', teamId: null, language: 'python', mmrChange: 12,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: 'u1', winningTeam: null },
        },
        // u2: 2 python wins (should rank above u1 even with lower mmrGained)
        {
          userId: 'u2', teamId: null, language: 'python', mmrChange: 5,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: 'u2', winningTeam: null },
        },
        {
          userId: 'u2', teamId: null, language: 'python', mmrChange: 5,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: 'u2', winningTeam: null },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u2', username: 'bob', avatarUrl: null, mmr: 1500, clan: null },
        { id: 'u1', username: 'alice', avatarUrl: null, mmr: 1700, clan: null },
      ]);

      const out = await service.getGlobalRankings({
        period: 'alltime',
        language: 'Python',
      });

      expect(prisma.battleParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            language: { equals: 'Python', mode: 'insensitive' },
          }),
        }),
      );
      expect(out.map((r) => r.id)).toEqual(['u2', 'u1']);
      expect(out[0].winsInLanguage).toBe(2);
      expect(out[1].winsInLanguage).toBe(1);
    });

    it('omits winsInLanguage when no language filter is set', async () => {
      prisma.battleParticipant.findMany.mockResolvedValue([
        {
          userId: 'u1', teamId: null, language: 'python', mmrChange: 10,
          battle: { mode: BattleMode.ONE_V_ONE, winnerId: 'u1', winningTeam: null },
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', username: 'alice', avatarUrl: null, mmr: 1500, clan: null },
      ]);

      const out = await service.getGlobalRankings({ period: 'monthly' });
      expect(out[0].winsInLanguage).toBeUndefined();
    });
  });

  // ============================
  // getClanRankings — alltime
  // ============================

  describe('getClanRankings — alltime', () => {
    it('sorts by clan.mmr DESC and attaches tier + memberCount', async () => {
      prisma.clan.findMany.mockResolvedValue([
        { id: 'c1', name: 'MIT Hackers', tag: 'MIT', mmr: 1800, _count: { members: 5 } },
        { id: 'c2', name: 'Harvard Coders', tag: 'HARV', mmr: 1300, _count: { members: 3 } },
      ]);

      const out = await service.getClanRankings({ period: 'alltime' });

      expect(prisma.clan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { mmr: 'desc' } }),
      );
      expect(out).toEqual([
        expect.objectContaining({
          id: 'c1', rank: 1, mmr: 1800, memberCount: 5,
          winsInPeriod: 0, lossesInPeriod: 0,
        }),
        expect.objectContaining({
          id: 'c2', rank: 2, mmr: 1300, memberCount: 3,
        }),
      ]);
      expect(out[0].tier.name).toBe('10x Dev');
    });
  });

  // ============================
  // getClanRankings — period window
  // ============================

  describe('getClanRankings — period window', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_NOW);
    });
    afterEach(() => jest.useRealTimers());

    it('counts CLAN_VS_CLAN wins via participant.user.clanId fallback', async () => {
      prisma.battle.findMany.mockResolvedValue([
        {
          winningTeam: 'team-1',
          teamOneClanId: null,
          teamTwoClanId: null,
          participants: [
            { teamId: 'team-1', user: { clanId: 'cA' } },
            { teamId: 'team-2', user: { clanId: 'cB' } },
          ],
        },
      ]);
      prisma.clan.findMany.mockResolvedValue([
        { id: 'cA', name: 'Alpha', tag: 'AAA', mmr: 1400, _count: { members: 3 } },
        { id: 'cB', name: 'Beta', tag: 'BBB', mmr: 1200, _count: { members: 2 } },
      ]);

      const out = await service.getClanRankings({ period: 'weekly' });
      expect(out[0]).toMatchObject({ id: 'cA', rank: 1, winsInPeriod: 1, lossesInPeriod: 0 });
      expect(out[1]).toMatchObject({ id: 'cB', rank: 2, winsInPeriod: 0, lossesInPeriod: 1 });
    });

    it('counts CLAN_WARS wins via teamOneClanId/teamTwoClanId', async () => {
      prisma.battle.findMany.mockResolvedValue([
        {
          winningTeam: 'team-2',
          teamOneClanId: 'cA',
          teamTwoClanId: 'cB',
          participants: [],
        },
        {
          winningTeam: 'team-2',
          teamOneClanId: 'cA',
          teamTwoClanId: 'cB',
          participants: [],
        },
      ]);
      prisma.clan.findMany.mockResolvedValue([
        { id: 'cA', name: 'Alpha', tag: 'AAA', mmr: 1400, _count: { members: 3 } },
        { id: 'cB', name: 'Beta', tag: 'BBB', mmr: 1200, _count: { members: 2 } },
      ]);

      const out = await service.getClanRankings({ period: 'monthly' });
      expect(out.map((r) => r.id)).toEqual(['cB', 'cA']);
      expect(out[0]).toMatchObject({ winsInPeriod: 2, lossesInPeriod: 0 });
      expect(out[1]).toMatchObject({ winsInPeriod: 0, lossesInPeriod: 2 });
    });

    it('skips temp-clan Clan Wars battles where one side has no clanId', async () => {
      prisma.battle.findMany.mockResolvedValue([
        {
          winningTeam: 'team-1',
          teamOneClanId: 'cA',
          teamTwoClanId: null, // temp clan
          participants: [],
        },
      ]);

      const out = await service.getClanRankings({ period: 'daily' });
      expect(out).toEqual([]);
      // shouldn't have hit prisma.clan.findMany since tally is empty.
      expect(prisma.clan.findMany).not.toHaveBeenCalled();
    });

    it('passes endedAt >= monthly window and excludes draws', async () => {
      prisma.battle.findMany.mockResolvedValue([]);
      await service.getClanRankings({ period: 'monthly' });
      expect(prisma.battle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mode: { in: [BattleMode.CLAN_VS_CLAN, BattleMode.CLAN_WARS] },
            status: BattleStatus.COMPLETED,
            endedAt: { gte: EXPECTED_MONTHLY_SINCE },
            winningTeam: { not: null },
          }),
        }),
      );
    });
  });

  // ============================
  // getFriendsRankings
  // ============================

  describe('getFriendsRankings', () => {
    it('always includes the viewer in the user filter and queries friends only', async () => {
      friends.getFriendIds.mockResolvedValue(['f1', 'f2']);
      prisma.user.findMany.mockResolvedValue([
        { id: 'me', username: 'me', avatarUrl: null, mmr: 1500, clan: null },
        { id: 'f1', username: 'friend1', avatarUrl: null, mmr: 1400, clan: null },
        { id: 'f2', username: 'friend2', avatarUrl: null, mmr: 1300, clan: null },
      ]);

      const out = await service.getFriendsRankings('me', { period: 'alltime' });

      expect(friends.getFriendIds).toHaveBeenCalledWith('me');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['me', 'f1', 'f2'] } },
        }),
      );
      expect(out).toHaveLength(3);
      expect(out[0].rank).toBe(1);
    });

    it('returns the viewer alone when they have no friends', async () => {
      friends.getFriendIds.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'me', username: 'me', avatarUrl: null, mmr: 1500, clan: null },
      ]);

      const out = await service.getFriendsRankings('me', { period: 'alltime' });
      expect(out.map((r) => r.id)).toEqual(['me']);
    });

    it('restricts the period-window participant query to viewer + friends', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_NOW);
      friends.getFriendIds.mockResolvedValue(['f1']);
      prisma.battleParticipant.findMany.mockResolvedValue([]);

      await service.getFriendsRankings('me', { period: 'weekly' });

      expect(prisma.battleParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: { in: ['me', 'f1'] },
          }),
        }),
      );
      jest.useRealTimers();
    });
  });
});
