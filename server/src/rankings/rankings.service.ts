import { Injectable } from '@nestjs/common';
import { BattleMode, BattleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';
import {
  getRankTier,
  getClanRankTier,
  RankTier,
} from '../common/utils/rank-tiers';

export type RankingsPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

export const RANKINGS_PERIODS: readonly RankingsPeriod[] = [
  'daily',
  'weekly',
  'monthly',
  'alltime',
] as const;

export interface UserRankingRow {
  rank: number;
  id: string;
  username: string;
  avatarUrl: string | null;
  mmr: number;
  tier: RankTier;
  clan: { tag: string; name: string } | null;
  mmrGained: number;
  winsInPeriod: number;
  lossesInPeriod: number;
  gamesPlayed: number;
  winsInLanguage?: number;
}

export interface ClanRankingRow {
  rank: number;
  id: string;
  name: string;
  tag: string;
  mmr: number;
  tier: RankTier;
  memberCount: number;
  winsInPeriod: number;
  lossesInPeriod: number;
}

interface UserRankingOpts {
  period: RankingsPeriod;
  language?: string | null;
  limit?: number;
  offset?: number;
}

interface PeriodAggregate {
  mmrGained: number;
  wins: number;
  losses: number;
  games: number;
  winsInLang: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

// Same shape as the helper in users.service.ts. Inlined here rather than
// extracted to common — the duplication is small and the rankings module is
// otherwise self-contained.
function winLossForCompletedBattle(
  mode: BattleMode,
  userId: string,
  teamId: string | null,
  battle: { winnerId: string | null; winningTeam: string | null },
): 'W' | 'L' | null {
  if (
    mode === BattleMode.GROUP ||
    mode === BattleMode.CLAN_VS_CLAN ||
    mode === BattleMode.CLAN_WARS
  ) {
    if (!battle.winningTeam) return null;
    if (!teamId) return 'L';
    return teamId === battle.winningTeam ? 'W' : 'L';
  }
  if (!battle.winnerId) return null;
  return battle.winnerId === userId ? 'W' : 'L';
}

function clampLimit(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  /**
   * UTC calendar boundaries for time-windowed leaderboards:
   *   daily   → today at 00:00:00Z
   *   weekly  → ISO Monday at 00:00:00Z
   *   monthly → 1st of current month at 00:00:00Z
   *   alltime → null (no filter)
   *
   * Public so the spec can pin `now` and assert boundary behavior.
   */
  periodToWindow(period: RankingsPeriod, now: Date = new Date()): Date | null {
    if (period === 'alltime') return null;
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    if (period === 'daily') return new Date(Date.UTC(y, m, d));
    if (period === 'monthly') return new Date(Date.UTC(y, m, 1));
    // weekly = ISO Monday. getUTCDay() returns 0=Sun..6=Sat,
    // so daysSinceMonday = (day + 6) % 7.
    const daysSinceMonday = (now.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(y, m, d - daysSinceMonday));
  }

  async getGlobalRankings(opts: UserRankingOpts): Promise<UserRankingRow[]> {
    return this.computeUserRankings(opts, null);
  }

  async getFriendsRankings(
    viewerId: string,
    opts: UserRankingOpts,
  ): Promise<UserRankingRow[]> {
    const friendIds = await this.friends.getFriendIds(viewerId);
    // Always include the viewer so they see their own position relative to friends.
    const userIds = Array.from(new Set([viewerId, ...friendIds]));
    return this.computeUserRankings(opts, userIds);
  }

  async getClanRankings(opts: {
    period: RankingsPeriod;
    limit?: number;
    offset?: number;
  }): Promise<ClanRankingRow[]> {
    const limit = clampLimit(opts.limit);
    const offset = opts.offset ?? 0;
    const since = this.periodToWindow(opts.period);

    if (since === null) {
      const clans = await this.prisma.clan.findMany({
        take: limit,
        skip: offset,
        orderBy: { mmr: 'desc' },
        select: {
          id: true,
          name: true,
          tag: true,
          mmr: true,
          _count: { select: { members: true } },
        },
      });
      return clans.map((c, i) => ({
        rank: offset + i + 1,
        id: c.id,
        name: c.name,
        tag: c.tag,
        mmr: c.mmr,
        tier: getClanRankTier(c.mmr),
        memberCount: c._count.members,
        winsInPeriod: 0,
        lossesInPeriod: 0,
      }));
    }

    // Period path — tally clan wins/losses from completed clan-mode battles in window.
    // Resolution rule for team→clan:
    //   1. CLAN_WARS battles store explicit teamOneClanId/teamTwoClanId on the
    //      Battle row; null means "temp clan" and intentionally skips clan stats.
    //   2. Legacy CLAN_VS_CLAN battles don't have those columns — fall back to
    //      a participant's user.clanId on the matching teamId. This mirrors
    //      BattlesService.completeBattle and ClansService.getClanResult.
    const battles = await this.prisma.battle.findMany({
      where: {
        mode: { in: [BattleMode.CLAN_VS_CLAN, BattleMode.CLAN_WARS] },
        status: BattleStatus.COMPLETED,
        endedAt: { gte: since },
        winningTeam: { not: null },
      },
      select: {
        winningTeam: true,
        teamOneClanId: true,
        teamTwoClanId: true,
        participants: {
          select: {
            teamId: true,
            user: { select: { clanId: true } },
          },
        },
      },
    });

    const tally = new Map<string, { wins: number; losses: number }>();
    for (const b of battles) {
      const team1ClanId =
        b.teamOneClanId ??
        b.participants.find((p) => p.teamId === 'team-1')?.user.clanId ??
        null;
      const team2ClanId =
        b.teamTwoClanId ??
        b.participants.find((p) => p.teamId === 'team-2')?.user.clanId ??
        null;
      if (!team1ClanId || !team2ClanId) continue;
      const winnerClanId =
        b.winningTeam === 'team-1' ? team1ClanId : team2ClanId;
      const loserClanId =
        b.winningTeam === 'team-1' ? team2ClanId : team1ClanId;
      const w = tally.get(winnerClanId) ?? { wins: 0, losses: 0 };
      w.wins += 1;
      tally.set(winnerClanId, w);
      const l = tally.get(loserClanId) ?? { wins: 0, losses: 0 };
      l.losses += 1;
      tally.set(loserClanId, l);
    }

    if (tally.size === 0) return [];

    const clanIds = [...tally.keys()];
    const clans = await this.prisma.clan.findMany({
      where: { id: { in: clanIds } },
      select: {
        id: true,
        name: true,
        tag: true,
        mmr: true,
        _count: { select: { members: true } },
      },
    });
    const clanById = new Map(clans.map((c) => [c.id, c]));

    const sorted = clanIds
      .map((id) => {
        const c = clanById.get(id);
        if (!c) return null;
        const t = tally.get(id)!;
        return { c, wins: t.wins, losses: t.losses };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.wins - a.wins || b.c.mmr - a.c.mmr);

    const page = sorted.slice(offset, offset + limit);
    return page.map((r, i) => ({
      rank: offset + i + 1,
      id: r.c.id,
      name: r.c.name,
      tag: r.c.tag,
      mmr: r.c.mmr,
      tier: getClanRankTier(r.c.mmr),
      memberCount: r.c._count.members,
      winsInPeriod: r.wins,
      lossesInPeriod: r.losses,
    }));
  }

  private async computeUserRankings(
    opts: UserRankingOpts,
    restrictUserIds: string[] | null,
  ): Promise<UserRankingRow[]> {
    const limit = clampLimit(opts.limit);
    const offset = opts.offset ?? 0;
    const language = opts.language?.trim() || null;
    const since = this.periodToWindow(opts.period);

    if (restrictUserIds !== null && restrictUserIds.length === 0) return [];

    // Fast path: alltime + no language filter. Sort directly by user.mmr,
    // mirroring the existing /users leaderboard.
    if (since === null && !language) {
      const users = await this.prisma.user.findMany({
        where: restrictUserIds ? { id: { in: restrictUserIds } } : undefined,
        take: limit,
        skip: offset,
        orderBy: { mmr: 'desc' },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          mmr: true,
          clan: { select: { tag: true, name: true } },
        },
      });
      return users.map((u, i) => ({
        rank: offset + i + 1,
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        mmr: u.mmr,
        tier: getRankTier(u.mmr),
        clan: u.clan,
        mmrGained: 0,
        winsInPeriod: 0,
        lossesInPeriod: 0,
        gamesPlayed: 0,
      }));
    }

    // Aggregate in JS. groupBy can't do conditional W/L counts derived from
    // (mode, teamId, winnerId, winningTeam) plus a per-language win count, so
    // pulling the raw participation rows once and reducing is simpler and is
    // a single round-trip. Volume in a 30-day window is bounded.
    const rows = await this.prisma.battleParticipant.findMany({
      where: {
        battle: {
          status: BattleStatus.COMPLETED,
          ...(since ? { endedAt: { gte: since } } : {}),
        },
        ...(language
          ? { language: { equals: language, mode: 'insensitive' } }
          : {}),
        ...(restrictUserIds ? { userId: { in: restrictUserIds } } : {}),
      },
      select: {
        userId: true,
        teamId: true,
        language: true,
        mmrChange: true,
        battle: {
          select: { mode: true, winnerId: true, winningTeam: true },
        },
      },
    });

    const byUser = new Map<string, PeriodAggregate>();
    for (const r of rows) {
      const acc = byUser.get(r.userId) ?? {
        mmrGained: 0,
        wins: 0,
        losses: 0,
        games: 0,
        winsInLang: 0,
      };
      acc.mmrGained += r.mmrChange ?? 0;
      acc.games += 1;
      const w = winLossForCompletedBattle(
        r.battle.mode,
        r.userId,
        r.teamId,
        r.battle,
      );
      if (w === 'W') {
        acc.wins += 1;
        if (language) acc.winsInLang += 1;
      } else if (w === 'L') {
        acc.losses += 1;
      }
      byUser.set(r.userId, acc);
    }

    if (byUser.size === 0) return [];

    const sortedIds = [...byUser.entries()]
      .sort(([, a], [, b]) => {
        if (language) {
          if (b.winsInLang !== a.winsInLang) return b.winsInLang - a.winsInLang;
          return b.mmrGained - a.mmrGained;
        }
        if (b.mmrGained !== a.mmrGained) return b.mmrGained - a.mmrGained;
        return b.wins - a.wins;
      })
      .map(([id]) => id);

    const pageIds = sortedIds.slice(offset, offset + limit);
    if (pageIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        mmr: true,
        clan: { select: { tag: true, name: true } },
      },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return pageIds
      .map((id, i) => {
        const u = userById.get(id);
        if (!u) return null;
        const a = byUser.get(id)!;
        const row: UserRankingRow = {
          rank: offset + i + 1,
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          mmr: u.mmr,
          tier: getRankTier(u.mmr),
          clan: u.clan,
          mmrGained: a.mmrGained,
          winsInPeriod: a.wins,
          lossesInPeriod: a.losses,
          gamesPlayed: a.games,
        };
        if (language) row.winsInLanguage = a.winsInLang;
        return row;
      })
      .filter((r): r is UserRankingRow => r !== null);
  }
}
