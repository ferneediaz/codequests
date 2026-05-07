import { describe, it, expect, vi, beforeEach } from 'vitest';
import { achievementsApi } from './achievements';
import api from './api';

vi.mock('./api', () => ({
    default: {
        get: vi.fn(),
    },
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

describe('achievementsApi', () => {
    beforeEach(() => {
        mockedApi.get.mockReset();
    });

    it('listMine GETs /achievements/me and unwraps `data`', async () => {
        const sample = [
            {
                id: 'first_blood',
                title: 'First Blood',
                description: 'Win your first battle.',
                icon: 'Swords',
                category: 'wins',
                tier: 'bronze',
                sortOrder: 10,
                unlocked: true,
                unlockedAt: '2026-05-01T12:00:00Z',
            },
        ];
        mockedApi.get.mockResolvedValueOnce({ data: sample });

        const result = await achievementsApi.listMine();
        expect(mockedApi.get).toHaveBeenCalledWith('/achievements/me');
        expect(result).toEqual(sample);
    });

    it('listForUser interpolates the userId into the URL', async () => {
        mockedApi.get.mockResolvedValueOnce({ data: [] });
        await achievementsApi.listForUser('user-42');
        expect(mockedApi.get).toHaveBeenCalledWith('/achievements/user-42');
    });
});
