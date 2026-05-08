import api from '@/services/api';
import type {
    ClanRankingRow,
    RankingsQuery,
    UserRankingRow,
} from '@/types/rankings';

function buildParams(q: RankingsQuery & { language?: string }) {
    const { period = 'alltime', language, limit, offset } = q;
    const params: Record<string, string | number> = { period };
    if (language) params.language = language;
    if (typeof limit === 'number') params.limit = limit;
    if (typeof offset === 'number') params.offset = offset;
    return params;
}

export async function getGlobalRankings(
    q: RankingsQuery = {},
): Promise<UserRankingRow[]> {
    const { data } = await api.get<UserRankingRow[]>('/rankings/global', {
        params: buildParams(q),
    });
    return data;
}

export async function getClanRankings(
    q: Omit<RankingsQuery, 'language'> = {},
): Promise<ClanRankingRow[]> {
    const { data } = await api.get<ClanRankingRow[]>('/rankings/clans', {
        params: buildParams(q),
    });
    return data;
}

export async function getFriendsRankings(
    q: RankingsQuery = {},
): Promise<UserRankingRow[]> {
    const { data } = await api.get<UserRankingRow[]>('/rankings/friends', {
        params: buildParams(q),
    });
    return data;
}
