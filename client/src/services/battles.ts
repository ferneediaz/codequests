import api from './api';
import type {
    BattleResponse,
    BattleRoundResponse,
    BattleRoyaleStandingsResponse,
    ClanWarsPreset,
    CreateBattleRequest,
    CreateClanWarsRequest,
    ProblemResponse,
    RoyalePreset,
    SubmissionResult,
} from '@/types/api';

export const battlesApi = {
    async getBattle(battleId: string): Promise<BattleResponse> {
        const { data } = await api.get<BattleResponse>(`/battles/${battleId}`);
        return data;
    },

    async getProblem(problemId: string): Promise<ProblemResponse> {
        const { data } = await api.get<ProblemResponse>(`/problems/${problemId}`);
        return data;
    },

    async getRoyalePresets(): Promise<RoyalePreset[]> {
        const { data } = await api.get<RoyalePreset[]>('/battles/royale/presets');
        return data;
    },

    async listRounds(battleId: string): Promise<BattleRoundResponse[]> {
        const { data } = await api.get<BattleRoundResponse[]>(
            `/battles/${battleId}/rounds`,
        );
        return data;
    },

    async getRound(battleId: string, roundNumber: number): Promise<BattleRoundResponse> {
        const { data } = await api.get<BattleRoundResponse>(
            `/battles/${battleId}/rounds/${roundNumber}`,
        );
        return data;
    },

    async getStandings(battleId: string): Promise<BattleRoyaleStandingsResponse> {
        const { data } = await api.get<BattleRoyaleStandingsResponse>(
            `/battles/${battleId}/standings`,
        );
        return data;
    },

    async getClanWarsPresets(): Promise<ClanWarsPreset[]> {
        const { data } = await api.get<ClanWarsPreset[]>(
            '/battles/clan-wars/presets',
        );
        return data;
    },

    async createInvite(payload: CreateBattleRequest): Promise<BattleResponse> {
        const { data } = await api.post<BattleResponse>('/battles/invite', payload);
        return data;
    },

    async createClanWars(payload: CreateClanWarsRequest): Promise<BattleResponse> {
        const { data } = await api.post<BattleResponse>(
            '/battles/clan-wars',
            payload,
        );
        return data;
    },

    async joinInvite(inviteCode: string, mode: 'battle' | 'clan-wars') {
        const path =
            mode === 'clan-wars'
                ? `/battles/clan-wars/invite/${inviteCode}/join`
                : `/battles/invite/${inviteCode}/join`;
        const { data } = await api.post<BattleResponse>(path);
        return data;
    },

    async getBattleByInvite(inviteCode: string): Promise<BattleResponse> {
        const { data } = await api.get<BattleResponse>(
            `/battles/invite/${inviteCode}`,
        );
        return data;
    },

    async submitCode(
        battleId: string,
        payload: { code: string; language: string; problemId?: string },
    ): Promise<SubmissionResult> {
        const { data } = await api.post<SubmissionResult>(
            `/battles/${battleId}/submit`,
            payload,
        );
        return data;
    },

    async executeProblem(
        problemId: string,
        payload: { code: string; language: string },
    ): Promise<SubmissionResult> {
        const { data } = await api.post<SubmissionResult>(
            `/problems/${problemId}/execute`,
            payload,
        );
        return data;
    },

    async completeBattle(battleId: string): Promise<void> {
        await api.post(`/battles/${battleId}/complete`);
    },

    async createRematch(battleId: string): Promise<BattleResponse> {
        const { data } = await api.post<BattleResponse>(`/battles/${battleId}/rematch`);
        return data;
    },
};
