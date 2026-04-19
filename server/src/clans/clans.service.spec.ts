import { Test, TestingModule } from '@nestjs/testing';
import { ClansService } from './clans.service';
import { PrismaService } from '../prisma/prisma.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ClansService', () => {
    let service: ClansService;
    let prisma: MockPrismaService;

    const mockClan = {
        id: 'clan-1',
        name: 'Code Warriors',
        tag: 'CW',
        ownerId: 'user-1',
        mmr: 1200,
        wins: 10,
        losses: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClansService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<ClansService>(ClansService);
        prisma = module.get<MockPrismaService>(PrismaService);
    });

    describe('getBattleHistory', () => {
        it('should return clan battle history with win/loss record', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: mockClan.id,
                name: mockClan.name,
                tag: mockClan.tag,
                wins: mockClan.wins,
                losses: mockClan.losses,
                mmr: mockClan.mmr,
            });

            const mockBattles = [
                {
                    id: 'battle-1',
                    mode: 'CLAN_VS_CLAN',
                    winningTeam: 'team-1',
                    teamSize: 3,
                    endedAt: new Date('2026-04-18T12:00:00Z'),
                    createdAt: new Date('2026-04-18T11:30:00Z'),
                    participants: [
                        {
                            userId: 'user-1',
                            teamId: 'team-1',
                            pointsEarned: 15,
                            user: {
                                id: 'user-1',
                                username: 'alice',
                                avatarUrl: null,
                                mmr: 1200,
                                clanId: 'clan-1',
                                clan: { id: 'clan-1', name: 'Code Warriors', tag: 'CW' },
                            },
                        },
                        {
                            userId: 'user-2',
                            teamId: 'team-2',
                            pointsEarned: 7,
                            user: {
                                id: 'user-2',
                                username: 'bob',
                                avatarUrl: null,
                                mmr: 1100,
                                clanId: 'clan-2',
                                clan: { id: 'clan-2', name: 'Bug Hunters', tag: 'BH' },
                            },
                        },
                    ],
                },
                {
                    id: 'battle-2',
                    mode: 'CLAN_VS_CLAN',
                    winningTeam: 'team-2',
                    teamSize: 2,
                    endedAt: new Date('2026-04-17T15:00:00Z'),
                    createdAt: new Date('2026-04-17T14:30:00Z'),
                    participants: [
                        {
                            userId: 'user-1',
                            teamId: 'team-1',
                            pointsEarned: 5,
                            user: {
                                id: 'user-1',
                                username: 'alice',
                                avatarUrl: null,
                                mmr: 1200,
                                clanId: 'clan-1',
                                clan: { id: 'clan-1', name: 'Code Warriors', tag: 'CW' },
                            },
                        },
                        {
                            userId: 'user-3',
                            teamId: 'team-2',
                            pointsEarned: 12,
                            user: {
                                id: 'user-3',
                                username: 'charlie',
                                avatarUrl: null,
                                mmr: 1300,
                                clanId: 'clan-3',
                                clan: { id: 'clan-3', name: 'Script Kiddos', tag: 'SK' },
                            },
                        },
                    ],
                },
            ];

            prisma.battle.findMany.mockResolvedValue(mockBattles);
            prisma.battle.count.mockResolvedValue(2);

            const result = await service.getBattleHistory('clan-1');

            expect(result.clan.wins).toBe(10);
            expect(result.clan.losses).toBe(3);
            expect(result.clan.mmr).toBe(1200);
            expect(result.data).toHaveLength(2);
            expect(result.meta.total).toBe(2);
            expect(result.meta.page).toBe(1);
        });

        it('should correctly determine win/loss/draw for each battle', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                name: 'Code Warriors',
                tag: 'CW',
                wins: 2,
                losses: 1,
                mmr: 1050,
            });

            const battles = [
                {
                    id: 'b-win',
                    mode: 'CLAN_VS_CLAN',
                    winningTeam: 'team-1',
                    teamSize: 2,
                    endedAt: new Date(),
                    createdAt: new Date(),
                    participants: [
                        {
                            userId: 'u1',
                            teamId: 'team-1',
                            pointsEarned: 10,
                            user: { id: 'u1', username: 'a', avatarUrl: null, mmr: 1000, clanId: 'clan-1', clan: { id: 'clan-1', name: 'CW', tag: 'CW' } },
                        },
                        {
                            userId: 'u2',
                            teamId: 'team-2',
                            pointsEarned: 5,
                            user: { id: 'u2', username: 'b', avatarUrl: null, mmr: 1000, clanId: 'clan-2', clan: { id: 'clan-2', name: 'BH', tag: 'BH' } },
                        },
                    ],
                },
                {
                    id: 'b-loss',
                    mode: 'CLAN_VS_CLAN',
                    winningTeam: 'team-2',
                    teamSize: 2,
                    endedAt: new Date(),
                    createdAt: new Date(),
                    participants: [
                        {
                            userId: 'u1',
                            teamId: 'team-1',
                            pointsEarned: 3,
                            user: { id: 'u1', username: 'a', avatarUrl: null, mmr: 1000, clanId: 'clan-1', clan: { id: 'clan-1', name: 'CW', tag: 'CW' } },
                        },
                        {
                            userId: 'u3',
                            teamId: 'team-2',
                            pointsEarned: 8,
                            user: { id: 'u3', username: 'c', avatarUrl: null, mmr: 1000, clanId: 'clan-3', clan: { id: 'clan-3', name: 'SK', tag: 'SK' } },
                        },
                    ],
                },
                {
                    id: 'b-draw',
                    mode: 'CLAN_VS_CLAN',
                    winningTeam: null,
                    teamSize: 2,
                    endedAt: new Date(),
                    createdAt: new Date(),
                    participants: [
                        {
                            userId: 'u1',
                            teamId: 'team-1',
                            pointsEarned: 5,
                            user: { id: 'u1', username: 'a', avatarUrl: null, mmr: 1000, clanId: 'clan-1', clan: { id: 'clan-1', name: 'CW', tag: 'CW' } },
                        },
                        {
                            userId: 'u4',
                            teamId: 'team-2',
                            pointsEarned: 5,
                            user: { id: 'u4', username: 'd', avatarUrl: null, mmr: 1000, clanId: 'clan-4', clan: { id: 'clan-4', name: 'DT', tag: 'DT' } },
                        },
                    ],
                },
            ];

            prisma.battle.findMany.mockResolvedValue(battles);
            prisma.battle.count.mockResolvedValue(3);

            const result = await service.getBattleHistory('clan-1');

            expect(result.data[0].clanResult).toBe('win');
            expect(result.data[1].clanResult).toBe('loss');
            expect(result.data[2].clanResult).toBe('draw');
        });

        it('should throw NotFoundException if clan does not exist', async () => {
            prisma.clan.findUnique.mockResolvedValue(null);

            await expect(
                service.getBattleHistory('nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should paginate results correctly', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                name: 'Code Warriors',
                tag: 'CW',
                wins: 25,
                losses: 10,
                mmr: 1350,
            });

            prisma.battle.findMany.mockResolvedValue([]);
            prisma.battle.count.mockResolvedValue(50);

            const result = await service.getBattleHistory('clan-1', 3, 10);

            expect(prisma.battle.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 20,
                    take: 10,
                }),
            );
            expect(result.meta).toEqual({
                total: 50,
                page: 3,
                limit: 10,
                totalPages: 5,
            });
        });

        it('should return empty data when clan has no battles', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                name: 'Code Warriors',
                tag: 'CW',
                wins: 0,
                losses: 0,
                mmr: 1000,
            });

            prisma.battle.findMany.mockResolvedValue([]);
            prisma.battle.count.mockResolvedValue(0);

            const result = await service.getBattleHistory('clan-1');

            expect(result.clan.wins).toBe(0);
            expect(result.clan.losses).toBe(0);
            expect(result.data).toHaveLength(0);
            expect(result.meta.total).toBe(0);
            expect(result.meta.totalPages).toBe(0);
        });
    });
});
