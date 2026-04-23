import { Injectable, NotFoundException } from '@nestjs/common';
import {
    BattleMode,
    BattleStatus,
    ClanChallengeStatus,
    FriendshipStatus,
    Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
    NewsItemCategory,
    NewsItemDto,
    NewsItemSeverity,
    NewsItemType,
    NewsResponseDto,
} from './dto/news-response.dto';

/**
 * Supported filter values accepted by the news endpoint.
 *
 * `shame` cuts across categories — it's any item marked `isShame` (declined
 * / expired clan challenges) regardless of clan/friend scope.
 */
export type NewsFilter = 'all' | 'clan' | 'friends' | 'shame';

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

/**
 * When fetching candidate rows for a page we pull a few extra rows from each
 * source to compensate for filtering/merging, then trim to `limit`.
 */
const SOURCE_OVERFETCH = 2;

type ClanRef = { id: string; name: string; tag: string };
type UserRef = { id: string; username: string; avatarUrl: string | null };

@Injectable()
export class NewsService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Get merged, time-sorted news feed for a viewer.
     *
     * - Clan challenge events are visible to everyone.
     * - Friend battle result events are only included when at least one
     *   participant is in the viewer's accepted-friends set.
     */
    async getNews(
        viewerId: string,
        opts: { limit?: number; before?: string; filter?: NewsFilter } = {},
    ): Promise<NewsResponseDto> {
        const user = await this.prisma.user.findUnique({
            where: { id: viewerId },
            select: { id: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${viewerId} not found`);
        }

        const limit = Math.min(
            MAX_LIMIT,
            Math.max(1, Math.floor(opts.limit ?? DEFAULT_LIMIT)),
        );
        const filter: NewsFilter = opts.filter ?? 'all';
        const before = parseBefore(opts.before);

        const fetchCount = limit + SOURCE_OVERFETCH;

        const [challengeItems, friendItems] = await Promise.all([
            filter === 'friends'
                ? Promise.resolve<NewsItemDto[]>([])
                : this.fetchClanChallengeItems(before, fetchCount),
            filter === 'clan'
                ? Promise.resolve<NewsItemDto[]>([])
                : this.fetchFriendBattleItems(viewerId, before, fetchCount),
        ]);

        let merged = [...challengeItems, ...friendItems].sort(
            (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
        );

        if (filter === 'shame') {
            merged = merged.filter((item) => item.isShame);
        }

        const page = merged.slice(0, limit);
        const nextCursor =
            merged.length > limit ? page[page.length - 1].timestamp : null;

        return { items: page, nextCursor };
    }

    /**
     * Build news items from the `ClanChallenge` table.
     *
     * One row can produce multiple events across its lifecycle:
     * - CREATED -> CLAN_CHALLENGE_SENT (timestamp = createdAt)
     * - ACCEPTED / DECLINED / COUNTERED / (computed) EXPIRED -> one item at
     *   the appropriate time.
     *
     * We cap ordering by `createdAt` because that's always populated; final
     * merge is by the event's own timestamp.
     */
    private async fetchClanChallengeItems(
        before: Date | null,
        take: number,
    ): Promise<NewsItemDto[]> {
        // Use createdAt as a loose cursor. Because an ACCEPTED item can have
        // a timestamp later than its createdAt, we intentionally pull a few
        // extra rows; the merge step handles final sort + truncation.
        const challenges = await this.prisma.clanChallenge.findMany({
            where: before
                ? {
                      OR: [
                          { createdAt: { lt: before } },
                          { respondedAt: { lt: before } },
                          { expiresAt: { lt: before } },
                      ],
                  }
                : undefined,
            include: {
                challengerClan: {
                    select: { id: true, name: true, tag: true },
                },
                challengedClan: {
                    select: { id: true, name: true, tag: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: take * 2,
        });

        const now = new Date();
        const items: NewsItemDto[] = [];

        for (const c of challenges) {
            const challenger: ClanRef = c.challengerClan;
            const challenged: ClanRef = c.challengedClan;

            items.push(
                buildChallengeItem({
                    id: `${c.id}:sent`,
                    type: 'CLAN_CHALLENGE_SENT',
                    timestamp: c.createdAt,
                    challenger,
                    challenged,
                }),
            );

            if (
                c.status === ClanChallengeStatus.ACCEPTED &&
                c.respondedAt
            ) {
                items.push(
                    buildChallengeItem({
                        id: `${c.id}:accepted`,
                        type: 'CLAN_CHALLENGE_ACCEPTED',
                        timestamp: c.respondedAt,
                        challenger,
                        challenged,
                    }),
                );
            } else if (
                c.status === ClanChallengeStatus.DECLINED &&
                c.respondedAt
            ) {
                items.push(
                    buildChallengeItem({
                        id: `${c.id}:declined`,
                        type: 'CLAN_CHALLENGE_DECLINED',
                        timestamp: c.respondedAt,
                        challenger,
                        challenged,
                    }),
                );
            } else if (c.status === ClanChallengeStatus.COUNTERED) {
                items.push(
                    buildChallengeItem({
                        id: `${c.id}:countered`,
                        type: 'CLAN_CHALLENGE_COUNTERED',
                        timestamp: c.respondedAt ?? c.updatedAt,
                        challenger,
                        challenged,
                    }),
                );
            }

            // Computed EXPIRED: pending/countered past their expiresAt. The
            // DB status is still PENDING/COUNTERED in this case because
            // there's no background job flipping rows to EXPIRED.
            if (
                (c.status === ClanChallengeStatus.PENDING ||
                    c.status === ClanChallengeStatus.COUNTERED) &&
                c.expiresAt < now
            ) {
                items.push(
                    buildChallengeItem({
                        id: `${c.id}:expired`,
                        type: 'CLAN_CHALLENGE_EXPIRED',
                        timestamp: c.expiresAt,
                        challenger,
                        challenged,
                    }),
                );
            } else if (
                c.status === ClanChallengeStatus.EXPIRED &&
                c.expiresAt
            ) {
                items.push(
                    buildChallengeItem({
                        id: `${c.id}:expired`,
                        type: 'CLAN_CHALLENGE_EXPIRED',
                        timestamp: c.expiresAt,
                        challenger,
                        challenged,
                    }),
                );
            }
        }

        // Drop items that aren't strictly before the cursor (we may have
        // over-fetched by createdAt but the real item timestamp falls after
        // the cursor for lifecycle events).
        return before
            ? items.filter((i) => new Date(i.timestamp) < before)
            : items;
    }

    /**
     * Build friend-scoped battle result items.
     *
     * Only COMPLETED battles where at least one participant is in the
     * viewer's accepted-friends set (or the viewer themselves) are
     * included. Draws and single-participant dropouts both produce valid
     * items (the UI differentiates them via `isDraw`).
     */
    private async fetchFriendBattleItems(
        viewerId: string,
        before: Date | null,
        take: number,
    ): Promise<NewsItemDto[]> {
        const friendIds = await this.getFriendIds(viewerId);
        if (friendIds.length === 0) {
            return [];
        }

        // Viewer + friends — we surface results where anyone in this set
        // participated so the viewer sees their own matches too.
        const relevantIds = Array.from(new Set([viewerId, ...friendIds]));

        const endedFilter: Prisma.BattleWhereInput = before
            ? { endedAt: { lt: before } }
            : {};

        const battles = await this.prisma.battle.findMany({
            where: {
                status: BattleStatus.COMPLETED,
                endedAt: { not: null },
                ...endedFilter,
                participants: {
                    some: { userId: { in: relevantIds } },
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
            orderBy: { endedAt: 'desc' },
            take,
        });

        return battles
            .map((battle) => buildFriendBattleItem(battle))
            .filter((item): item is NewsItemDto => item !== null);
    }

    private async getFriendIds(userId: string): Promise<string[]> {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                status: FriendshipStatus.ACCEPTED,
                OR: [{ requesterId: userId }, { addresseeId: userId }],
            },
            select: { requesterId: true, addresseeId: true },
        });

        return friendships.map((f) =>
            f.requesterId === userId ? f.addresseeId : f.requesterId,
        );
    }
}

/**
 * Map a challenge event type to its display text + severity/category.
 *
 * Centralised so the test suite can pin each mapping precisely.
 */
function buildChallengeItem(params: {
    id: string;
    type: Exclude<NewsItemType, 'FRIEND_BATTLE_RESULT'>;
    timestamp: Date;
    challenger: ClanRef;
    challenged: ClanRef;
}): NewsItemDto {
    const { id, type, timestamp, challenger, challenged } = params;
    const meta = CHALLENGE_META[type];

    const text = meta.text(challenger, challenged);

    return {
        id,
        type,
        severity: meta.severity,
        category: 'clan',
        isShame: meta.isShame,
        timestamp: timestamp.toISOString(),
        text,
        challengerClan: challenger,
        challengedClan: challenged,
    };
}

const CHALLENGE_META: Record<
    Exclude<NewsItemType, 'FRIEND_BATTLE_RESULT'>,
    {
        severity: NewsItemSeverity;
        isShame: boolean;
        text: (a: ClanRef, b: ClanRef) => string;
    }
> = {
    CLAN_CHALLENGE_SENT: {
        severity: 'neutral',
        isShame: false,
        text: (a, b) => `${clanLabel(a)} challenged ${clanLabel(b)}`,
    },
    CLAN_CHALLENGE_ACCEPTED: {
        severity: 'positive',
        isShame: false,
        text: (a, b) =>
            `${clanLabel(b)} accepted ${clanLabel(a)}'s challenge`,
    },
    CLAN_CHALLENGE_DECLINED: {
        severity: 'negative',
        isShame: true,
        text: (a, b) =>
            `${clanLabel(b)} declined ${clanLabel(a)}'s challenge`,
    },
    CLAN_CHALLENGE_COUNTERED: {
        severity: 'warning',
        isShame: false,
        text: (a, b) =>
            `${clanLabel(b)} countered ${clanLabel(a)}'s challenge`,
    },
    CLAN_CHALLENGE_EXPIRED: {
        severity: 'negative',
        isShame: true,
        text: (a, b) =>
            `${clanLabel(b)} let ${clanLabel(a)}'s challenge expire`,
    },
};

function clanLabel(clan: ClanRef): string {
    return clan.tag ? `[${clan.tag}] ${clan.name}` : clan.name;
}

type BattleWithParticipants = {
    id: string;
    mode: BattleMode;
    winnerId: string | null;
    winningTeam: string | null;
    endedAt: Date | null;
    createdAt: Date;
    participants: Array<{
        userId: string;
        teamId: string | null;
        user: UserRef;
    }>;
};

function buildFriendBattleItem(
    battle: BattleWithParticipants,
): NewsItemDto | null {
    const ts = battle.endedAt ?? battle.createdAt;
    if (!ts) return null;

    const participants: UserRef[] = battle.participants.map((p) => p.user);
    if (participants.length === 0) return null;

    const category: NewsItemCategory = 'friends';

    let winner: UserRef | null = null;
    let loser: UserRef | null = null;
    let isDraw = false;
    let text: string;

    if (battle.winnerId) {
        winner =
            battle.participants.find((p) => p.userId === battle.winnerId)
                ?.user ?? null;
        const others = battle.participants.filter(
            (p) => p.userId !== battle.winnerId,
        );
        loser = others[0]?.user ?? null;
        if (winner && loser) {
            text = `${winner.username} defeated ${loser.username}`;
        } else if (winner) {
            text = `${winner.username} won a ${battleModeLabel(battle.mode)} battle`;
        } else {
            return null;
        }
    } else if (battle.winningTeam) {
        // Team battles: most relevant when a clan-vs-clan or team match
        // involves friends. Describe by team identifier.
        const winners = battle.participants
            .filter((p) => p.teamId === battle.winningTeam)
            .map((p) => p.user.username);
        const losers = battle.participants
            .filter((p) => p.teamId && p.teamId !== battle.winningTeam)
            .map((p) => p.user.username);
        if (winners.length === 0) return null;
        text = `${winners.join(', ')} defeated ${losers.join(', ') || 'opponents'}`;
    } else {
        isDraw = true;
        if (participants.length >= 2) {
            text = `${participants[0].username} and ${participants[1].username} drew`;
        } else {
            text = `${participants[0].username} ended a match in a draw`;
        }
    }

    return {
        id: `battle:${battle.id}`,
        type: 'FRIEND_BATTLE_RESULT',
        severity: isDraw ? 'neutral' : 'positive',
        category,
        isShame: false,
        timestamp: ts.toISOString(),
        text,
        battleId: battle.id,
        battleMode: battle.mode,
        participants,
        winner,
        loser,
        isDraw,
    };
}

function battleModeLabel(mode: BattleMode): string {
    switch (mode) {
        case BattleMode.ONE_V_ONE:
            return '1v1';
        case BattleMode.BATTLE_ROYALE:
            return 'Battle Royale';
        case BattleMode.CLAN_VS_CLAN:
            return 'Clan vs Clan';
        case BattleMode.GROUP:
            return 'Group';
        case BattleMode.CLAN_WARS:
            return 'Clan Wars';
        default:
            return String(mode);
    }
}

function parseBefore(value?: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}
