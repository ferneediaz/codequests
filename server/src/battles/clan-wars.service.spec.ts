import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import {
    BattleMode,
    BattleRoundEndReason,
    BattleRoundStatus,
    BattleStatus,
    ClanWarsFormat,
} from '@prisma/client';

import { ClanWarsService } from './clan-wars.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeasonsService } from '../seasons/seasons.service';
import { ProblemsService } from '../problems/problems.service';
import { BATTLE_EVENTS_PORT } from '../realtime/ports/battle-events.port';
import { CreateClanWarsBattleDto } from './dto/create-clan-wars-battle.dto';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';

// ============================================
// Test helpers
// ============================================

const makeConfig = (
    overrides: Partial<CreateClanWarsBattleDto> = {},
): CreateClanWarsBattleDto =>
    ({
        clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
        teamSize: 3,
        rounds: [
            { timeLimitSeconds: 300 },
            { timeLimitSeconds: 300 },
            { timeLimitSeconds: 300 },
        ],
        ...overrides,
    }) as CreateClanWarsBattleDto;

const participant = (overrides: any = {}) => ({
    id: `p-${overrides.userId ?? 'u'}`,
    battleId: overrides.battleId ?? 'battle-cw',
    userId: overrides.userId ?? 'u1',
    teamId: overrides.teamId ?? 'team-1',
    code: null,
    language: null,
    testsPassed: 0,
    totalTests: 0,
    submittedAt: null,
    pointsEarned: 0,
    isReady: overrides.isReady ?? false,
    isEliminated: false,
    placement: null,
    eliminatedInRound: null,
    mmrChange: null,
    user: {
        id: overrides.userId ?? 'u1',
        username: overrides.username ?? `user-${overrides.userId ?? 'u1'}`,
        avatarUrl: null,
        mmr: overrides.mmr ?? 1000,
        subscriptionTier: overrides.subscriptionTier ?? 'PRO',
        trialEndsAt: null,
        clan: overrides.clan ?? null,
    },
    ...overrides,
});

describe('ClanWarsService', () => {
    let service: ClanWarsService;
    let prisma: MockPrismaService;
    let subs: jest.Mocked<SubscriptionsService>;
    let seasons: jest.Mocked<SeasonsService>;
    let scheduler: {
        addTimeout: jest.Mock;
        deleteTimeout: jest.Mock;
        doesExist: jest.Mock;
    };
    let gateway: {
        emitClanWarsRoundStart: jest.Mock;
        emitClanWarsRoundEnd: jest.Mock;
        emitClanWarsTeamStandings: jest.Mock;
        emitClanWarsRoundIntermission: jest.Mock;
        emitClanWarsPlayerReadyNextRound: jest.Mock;
        emitBattleCompleted: jest.Mock;
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();
        const mockCodeExec = { executeCode: jest.fn() };
        const mockSubs = {
            canPlay: jest.fn().mockResolvedValue(true),
            incrementGamesPlayed: jest.fn().mockResolvedValue(undefined),
        };
        const mockSeasons = {
            getActiveSeason: jest.fn().mockResolvedValue({ id: 'season-1' }),
            updatePeakMmr: jest.fn().mockResolvedValue(undefined),
            incrementSeasonStats: jest.fn().mockResolvedValue(undefined),
        };
        const mockProblems = { findRandom: jest.fn() };
        scheduler = {
            addTimeout: jest.fn(),
            deleteTimeout: jest.fn(),
            doesExist: jest.fn().mockReturnValue(false),
        };
        gateway = {
            emitClanWarsRoundStart: jest.fn(),
            emitClanWarsRoundEnd: jest.fn(),
            emitClanWarsTeamStandings: jest.fn(),
            emitClanWarsRoundIntermission: jest.fn(),
            emitClanWarsPlayerReadyNextRound: jest.fn(),
            emitBattleCompleted: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClanWarsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CodeExecutionService, useValue: mockCodeExec },
                { provide: SubscriptionsService, useValue: mockSubs },
                { provide: SeasonsService, useValue: mockSeasons },
                { provide: ProblemsService, useValue: mockProblems },
                { provide: SchedulerRegistry, useValue: scheduler },
                { provide: BATTLE_EVENTS_PORT, useValue: gateway },
            ],
        }).compile();

        service = module.get<ClanWarsService>(ClanWarsService);
        prisma = module.get<MockPrismaService>(PrismaService);
        subs = module.get(SubscriptionsService);
        seasons = module.get(SeasonsService);

        // By default, transactions simply delegate to the mock prisma.
        prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    });

    // ========================================
    // Presets
    // ========================================

    describe('getPresets', () => {
        it('returns at least one preset per format', () => {
            const presets = service.getPresets();
            expect(presets.length).toBeGreaterThanOrEqual(2);
            expect(
                presets.some(
                    (p) => p.clanWarsFormat === ClanWarsFormat.SAME_PROBLEM,
                ),
            ).toBe(true);
            expect(
                presets.some(
                    (p) => p.clanWarsFormat === ClanWarsFormat.SCORE_ATTACK,
                ),
            ).toBe(true);
        });
    });

    // ========================================
    // validateConfig
    // ========================================

    describe('validateConfig', () => {
        it('accepts a valid 3v3 / 3-round SAME_PROBLEM config', () => {
            expect(() => service.validateConfig(makeConfig())).not.toThrow();
        });

        it('accepts a single-round config (unlike Battle Royale)', () => {
            expect(() =>
                service.validateConfig(
                    makeConfig({ rounds: [{ timeLimitSeconds: 600 }] }),
                ),
            ).not.toThrow();
        });

        it('rejects missing clanWarsFormat', () => {
            expect(() =>
                service.validateConfig(
                    makeConfig({ clanWarsFormat: undefined as any }),
                ),
            ).toThrow(/clanWarsFormat/);
        });

        it('rejects teamSize < 1', () => {
            expect(() =>
                service.validateConfig(makeConfig({ teamSize: 0 })),
            ).toThrow(/teamSize/);
        });

        it('rejects teamSize > 10', () => {
            expect(() =>
                service.validateConfig(makeConfig({ teamSize: 11 })),
            ).toThrow(/teamSize/);
        });

        it('rejects empty rounds', () => {
            expect(() =>
                service.validateConfig(makeConfig({ rounds: [] })),
            ).toThrow(/rounds/);
        });

        it('rejects round timeLimit below minimum', () => {
            expect(() =>
                service.validateConfig(
                    makeConfig({ rounds: [{ timeLimitSeconds: 5 }] }),
                ),
            ).toThrow(/timeLimitSeconds/);
        });

        it('rejects round timeLimit above maximum', () => {
            expect(() =>
                service.validateConfig(
                    makeConfig({ rounds: [{ timeLimitSeconds: 99999 }] }),
                ),
            ).toThrow(/timeLimitSeconds/);
        });

        it('accepts SCORE_ATTACK configs (no elimination constraint)', () => {
            expect(() =>
                service.validateConfig(
                    makeConfig({
                        clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
                        rounds: [
                            { timeLimitSeconds: 600 },
                            { timeLimitSeconds: 600 },
                        ],
                    }),
                ),
            ).not.toThrow();
        });
    });

    // ========================================
    // createClanWarsBattle
    // ========================================

    describe('createClanWarsBattle', () => {
        beforeEach(() => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'u1',
                clanId: null,
                clan: null,
            });
            prisma.problem.count.mockResolvedValue(100);
            prisma.battle.create.mockResolvedValue({ id: 'battle-cw' });
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-cw',
                participants: [],
                rounds: [],
            });
            prisma.battle.findFirst.mockResolvedValue(null);
        });

        it('rejects when the subscription gate returns false', async () => {
            subs.canPlay.mockResolvedValueOnce(false);
            await expect(
                service.createClanWarsBattle('u1', makeConfig()),
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('validates the config before hitting the DB', async () => {
            await expect(
                service.createClanWarsBattle(
                    'u1',
                    makeConfig({ rounds: [] }),
                ),
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.battle.create).not.toHaveBeenCalled();
        });

        it('rejects when team-1 is an official clan the creator is not in', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'u1',
                clanId: 'clan-other',
                clan: null,
            });
            await expect(
                service.createClanWarsBattle(
                    'u1',
                    makeConfig({
                        teamOne: { clanId: 'clan-official' },
                    }),
                ),
            ).rejects.toThrow(/team-1 clan/);
        });

        it('rejects when team-1 and team-2 are the same official clan', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'u1',
                clanId: 'clan-x',
                clan: null,
            });
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-x',
                name: 'X',
                tag: 'X',
            });
            await expect(
                service.createClanWarsBattle(
                    'u1',
                    makeConfig({
                        teamOne: { clanId: 'clan-x' },
                        teamTwo: { clanId: 'clan-x' },
                    }),
                ),
            ).rejects.toThrow(/same clan/);
        });

        it('seeds team-1 with the creator and sets teamOneCaptainId', async () => {
            await service.createClanWarsBattle('u1', makeConfig());

            const call = prisma.battle.create.mock.calls[0][0];
            expect(call.data.mode).toBe(BattleMode.CLAN_WARS);
            expect(call.data.teamOneCaptainId).toBe('u1');
            expect(call.data.teamTwoCaptainId).toBeNull();
            expect(call.data.participants.create).toMatchObject({
                userId: 'u1',
                teamId: 'team-1',
            });
            // Clan Wars materialises one BattleRound per configured round with
            // eliminateCount: 0 (not relevant for CW but the column is NOT NULL).
            const createdRounds = call.data.rounds.create;
            expect(createdRounds).toHaveLength(3);
            for (const r of createdRounds) {
                expect(r.eliminateCount).toBe(0);
                expect(r.status).toBe(BattleRoundStatus.PENDING);
            }
        });

        it('prefills team-1 clanId + label when creator is an official clan member', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'u1',
                clanId: 'clan-hydra',
                clan: { id: 'clan-hydra', name: 'Hydra', tag: 'HYD' },
            });
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-hydra',
                name: 'Hydra',
                tag: 'HYD',
            });
            await service.createClanWarsBattle(
                'u1',
                makeConfig({ teamOne: { clanId: 'clan-hydra' } }),
            );
            const call = prisma.battle.create.mock.calls[0][0];
            expect(call.data.teamOneClanId).toBe('clan-hydra');
            expect(call.data.teamOneName).toBe('Hydra');
            expect(call.data.teamOneTag).toBe('HYD');
        });

        it('generates an invite code by default', async () => {
            await service.createClanWarsBattle('u1', makeConfig());
            const call = prisma.battle.create.mock.calls[0][0];
            expect(call.data.inviteCode).toEqual(expect.any(String));
            expect(call.data.inviteCode.length).toBeGreaterThan(0);
        });

        it('skips invite code generation when withInviteCode: false', async () => {
            await service.createClanWarsBattle(
                'u1',
                makeConfig({ withInviteCode: false }),
            );
            const call = prisma.battle.create.mock.calls[0][0];
            expect(call.data.inviteCode).toBeNull();
        });
    });

    // ========================================
    // joinClanWarsBattle
    // ========================================

    describe('joinClanWarsBattle', () => {
        const makeBattle = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            status: BattleStatus.WAITING,
            teamSize: 3,
            inviteCode: null,
            teamOneClanId: null,
            teamTwoClanId: null,
            teamOneCaptainId: 'u1',
            teamTwoCaptainId: null,
            teamTwoName: null,
            teamTwoTag: null,
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
            ],
            ...overrides,
        });

        beforeEach(() => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'u2',
                clanId: null,
            });
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
        });

        it('rejects joining when team slot is full', async () => {
            // Both the preflight read and the tx read now see the full team.
            const full = makeBattle({
                participants: [
                    participant({ userId: 'u1', teamId: 'team-1' }),
                    participant({ userId: 'u2', teamId: 'team-1' }),
                    participant({ userId: 'u3', teamId: 'team-1' }),
                ],
            });
            prisma.battle.findUnique.mockResolvedValue(full);
            prisma.user.findUnique.mockResolvedValue({
                id: 'u4',
                clanId: null,
            });
            await expect(
                service.joinClanWarsBattle('u4', 'battle-cw', {
                    team: 'team-1',
                }),
            ).rejects.toThrow(/full/);
        });

        it('rejects joining an official-clan side when the user is not a clan member', async () => {
            const official = makeBattle({ teamTwoClanId: 'clan-bravo' });
            prisma.battle.findUnique.mockResolvedValue(official);
            prisma.user.findUnique.mockResolvedValue({
                id: 'u2',
                clanId: 'clan-alpha',
            });
            await expect(
                service.joinClanWarsBattle('u2', 'battle-cw', {
                    team: 'team-2',
                }),
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('assigns captain + team-2 labels to the first team-2 joiner', async () => {
            const lobby = makeBattle({
                teamTwoCaptainId: null,
                teamTwoName: null,
            });
            // Both preflight read + in-tx read see the same lobby; the final
            // getClanWarsDetails read can return a minimal shape.
            prisma.battle.findUnique
                .mockResolvedValueOnce(lobby) // preflight
                .mockResolvedValueOnce(lobby) // in-tx re-read
                .mockResolvedValue({
                    id: 'battle-cw',
                    participants: [],
                    rounds: [],
                });
            prisma.user.findUnique.mockResolvedValue({
                id: 'u2',
                clanId: null,
            });
            prisma.battleParticipant.create.mockResolvedValue({});

            await service.joinClanWarsBattle('u2', 'battle-cw', {
                team: 'team-2',
                teamMeta: { name: 'Hornets', tag: 'HRN' },
            });

            const updateCall = prisma.battle.update.mock.calls.find(
                (c: any[]) => c[0]?.data?.teamTwoCaptainId === 'u2',
            );
            expect(updateCall).toBeDefined();
            expect(updateCall[0].data.teamTwoName).toBe('Hornets');
            expect(updateCall[0].data.teamTwoTag).toBe('HRN');
        });

        it('is TOCTOU-safe: re-reads the battle inside the tx so concurrent joiners cannot exceed the cap', async () => {
            // Simulate the classic TOCTOU: the preflight read sees 2/3 team-1
            // slots used, but by the time the tx executes another joiner has
            // already filled the final slot. The in-tx re-read must see 3/3
            // and reject the would-be 4th joiner.
            const preflight = makeBattle({
                participants: [
                    participant({ userId: 'u1', teamId: 'team-1' }),
                    participant({ userId: 'u2', teamId: 'team-1' }),
                ],
            });
            const inTx = makeBattle({
                participants: [
                    participant({ userId: 'u1', teamId: 'team-1' }),
                    participant({ userId: 'u2', teamId: 'team-1' }),
                    participant({ userId: 'u-race', teamId: 'team-1' }),
                ],
            });
            prisma.battle.findUnique
                .mockResolvedValueOnce(preflight)
                .mockResolvedValueOnce(inTx);
            prisma.user.findUnique.mockResolvedValue({
                id: 'u3',
                clanId: null,
            });

            await expect(
                service.joinClanWarsBattle('u3', 'battle-cw', {
                    team: 'team-1',
                }),
            ).rejects.toThrow(/full/);

            // Must NOT have inserted a 4th participant.
            expect(prisma.battleParticipant.create).not.toHaveBeenCalled();
        });

        it('rejects joining a battle with an invite code without viaInvite flag', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(
                makeBattle({ inviteCode: 'ABCDEFGH' }),
            );
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'u2',
                clanId: null,
            });
            await expect(
                service.joinClanWarsBattle('u2', 'battle-cw', {
                    team: 'team-2',
                }),
            ).rejects.toThrow(/invite code/);
        });

        it('rejects re-joining when the user is already in the battle', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(makeBattle());
            prisma.user.findUnique.mockResolvedValueOnce({
                id: 'u1',
                clanId: null,
            });
            await expect(
                service.joinClanWarsBattle('u1', 'battle-cw', {
                    team: 'team-1',
                }),
            ).rejects.toThrow(/already/);
        });
    });

    // ========================================
    // startClanWars
    // ========================================

    describe('startClanWars', () => {
        const makeFullLobby = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            status: BattleStatus.WAITING,
            teamSize: 2,
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
                participant({ userId: 'u2', teamId: 'team-1' }),
                participant({ userId: 'u3', teamId: 'team-2' }),
                participant({ userId: 'u4', teamId: 'team-2' }),
            ],
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    timeLimitSeconds: 60,
                    status: BattleRoundStatus.PENDING,
                    problemId: null,
                    battleId: 'battle-cw',
                },
            ],
            enabledSkills: [],
            clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
            currentRound: 0,
            ...overrides,
        });

        it('rejects when team-1 or team-2 is not full', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(
                makeFullLobby({
                    participants: [
                        participant({ userId: 'u1', teamId: 'team-1' }),
                        participant({ userId: 'u2', teamId: 'team-2' }),
                    ],
                }),
            );
            await expect(service.startClanWars('battle-cw')).rejects.toThrow(
                /Both teams must be full/,
            );
        });

        it('rejects when battle is not in CLAN_WARS mode', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(
                makeFullLobby({ mode: BattleMode.BATTLE_ROYALE }),
            );
            await expect(service.startClanWars('battle-cw')).rejects.toThrow(
                /Clan Wars/,
            );
        });

        it('rejects when battle is not in WAITING state', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(
                makeFullLobby({ status: BattleStatus.IN_PROGRESS }),
            );
            await expect(service.startClanWars('battle-cw')).rejects.toThrow(
                /waiting state/,
            );
        });
    });

    // ========================================
    // Intermission lifecycle
    // ========================================

    describe('enterIntermission', () => {
        it('resets every participant\'s isReady, flips isInIntermission, emits round_intermission', async () => {
            await service.enterIntermission('battle-cw', 1, 2);
            expect(prisma.battleParticipant.updateMany).toHaveBeenCalledWith({
                where: { battleId: 'battle-cw' },
                data: { isReady: false },
            });
            expect(prisma.battle.update).toHaveBeenCalledWith({
                where: { id: 'battle-cw' },
                data: { isInIntermission: true },
            });
            expect(gateway.emitClanWarsRoundIntermission).toHaveBeenCalledWith(
                'battle-cw',
                expect.objectContaining({
                    battleId: 'battle-cw',
                    justEndedRound: 1,
                    nextRoundNumber: 2,
                    readyUserIds: [],
                }),
            );
        });
    });

    describe('readyForNextRound', () => {
        const makeIntermission = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            status: BattleStatus.IN_PROGRESS,
            isInIntermission: true,
            currentRound: 1,
            teamSize: 2,
            participants: [
                participant({ userId: 'u1', teamId: 'team-1', isReady: false }),
                participant({ userId: 'u2', teamId: 'team-2', isReady: false }),
            ],
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    status: BattleRoundStatus.COMPLETED,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
                {
                    id: 'r2',
                    roundNumber: 2,
                    status: BattleRoundStatus.PENDING,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
            ],
            ...overrides,
        });

        it('rejects ready-up when not in intermission', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(
                makeIntermission({ isInIntermission: false }),
            );
            await expect(
                service.readyForNextRound('battle-cw', 'u1'),
            ).rejects.toThrow(/intermission/);
        });

        it('marks the player ready and waits for the other player (allReady=false, no flip)', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeIntermission());
            prisma.battle.updateMany.mockResolvedValue({ count: 1 });
            // The in-tx fresh read shows u1=ready, u2 still not ready.
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'u1', isReady: true },
                { userId: 'u2', isReady: false },
            ]);

            const res = await service.readyForNextRound('battle-cw', 'u1');

            expect(prisma.battleParticipant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { isReady: true },
                }),
            );
            // only one participant readied; the in-tx fresh read sees the
            // other is still not-ready → no intermission flip
            expect(prisma.battle.updateMany).not.toHaveBeenCalled();
            expect(res.allReady).toBe(false);
        });

        it('atomically flips isInIntermission and starts next round when the LAST non-ready player readies', async () => {
            // u1 already ready; u2 is the last to ready.
            prisma.battle.findUnique.mockResolvedValue(
                makeIntermission({
                    participants: [
                        participant({
                            userId: 'u1',
                            teamId: 'team-1',
                            isReady: true,
                        }),
                        participant({
                            userId: 'u2',
                            teamId: 'team-2',
                            isReady: false,
                        }),
                    ],
                }),
            );
            prisma.battle.updateMany.mockResolvedValue({ count: 1 });
            // After u2's self-update, the in-tx re-read sees BOTH ready.
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'u1', isReady: true },
                { userId: 'u2', isReady: true },
            ]);
            // startRound needs the battle again for loading
            const spyStart = jest
                .spyOn(service, 'startRound')
                .mockResolvedValue(undefined as any);

            const res = await service.readyForNextRound('battle-cw', 'u2');

            expect(prisma.battle.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'battle-cw',
                        isInIntermission: true,
                        currentRound: 1,
                    }),
                    data: expect.objectContaining({
                        isInIntermission: false,
                        currentRound: 2,
                    }),
                }),
            );
            expect(res.allReady).toBe(true);
            expect(spyStart).toHaveBeenCalledWith('battle-cw', 2);
        });

        it('race-safe: the losing caller sees allReady=false because the conditional flip matches 0 rows', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeIntermission({
                    participants: [
                        participant({
                            userId: 'u1',
                            teamId: 'team-1',
                            isReady: true,
                        }),
                        participant({
                            userId: 'u2',
                            teamId: 'team-2',
                            isReady: false,
                        }),
                    ],
                }),
            );
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'u1', isReady: true },
                { userId: 'u2', isReady: true },
            ]);
            prisma.battle.updateMany.mockResolvedValue({ count: 0 }); // simulate losing race
            jest.spyOn(service, 'startRound').mockResolvedValue(
                undefined as any,
            );

            const res = await service.readyForNextRound('battle-cw', 'u2');
            expect(res.allReady).toBe(false);
        });

        it('concurrent "last two" readying both see the fresh all-ready state (previously both got stuck at allReady=false)', async () => {
            // REGRESSION GUARD: with the snapshot-based otherReady check, two
            // callers each self-update and each see a stale "other isn't
            // ready yet" snapshot, so neither fires the flip → battle hangs.
            // The fresh in-tx read must see both ready for the conditional
            // updateMany to attempt its flip; the race-safe updateMany then
            // guarantees exactly one caller wins.
            const snapshot = makeIntermission({
                participants: [
                    participant({
                        userId: 'u1',
                        teamId: 'team-1',
                        isReady: false,
                    }),
                    participant({
                        userId: 'u2',
                        teamId: 'team-2',
                        isReady: false,
                    }),
                ],
            });
            prisma.battle.findUnique.mockResolvedValue(snapshot);
            // Both callers' in-tx findMany resolves to the post-update truth:
            // both participants are ready.
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'u1', isReady: true },
                { userId: 'u2', isReady: true },
            ]);
            // First updateMany wins the race, second loses (count=0).
            prisma.battle.updateMany
                .mockResolvedValueOnce({ count: 1 })
                .mockResolvedValueOnce({ count: 0 });
            const spyStart = jest
                .spyOn(service, 'startRound')
                .mockResolvedValue(undefined as any);

            const [resA, resB] = await Promise.all([
                service.readyForNextRound('battle-cw', 'u1'),
                service.readyForNextRound('battle-cw', 'u2'),
            ]);

            // Exactly one caller wins the flip → triggers startRound; the
            // other sees allReady=false (race lost).
            const wins = [resA, resB].filter((r) => r.allReady).length;
            expect(wins).toBe(1);
            expect(spyStart).toHaveBeenCalledTimes(1);
            expect(spyStart).toHaveBeenCalledWith('battle-cw', 2);
        });

        it('rejects double-ready (idempotent protection)', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeIntermission({
                    participants: [
                        participant({
                            userId: 'u1',
                            teamId: 'team-1',
                            isReady: true,
                        }),
                        participant({
                            userId: 'u2',
                            teamId: 'team-2',
                            isReady: false,
                        }),
                    ],
                }),
            );
            await expect(
                service.readyForNextRound('battle-cw', 'u1'),
            ).rejects.toThrow(/already ready/);
        });
    });

    describe('unreadyForNextRound', () => {
        it('rejects when not in intermission', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce({
                id: 'battle-cw',
                mode: BattleMode.CLAN_WARS,
                status: BattleStatus.IN_PROGRESS,
                isInIntermission: false,
                currentRound: 1,
                participants: [
                    participant({
                        userId: 'u1',
                        teamId: 'team-1',
                        isReady: true,
                    }),
                ],
            });
            await expect(
                service.unreadyForNextRound('battle-cw', 'u1'),
            ).rejects.toThrow(/intermission/);
        });

        it('flips isReady off and emits player_ready_next_round with allReady=false', async () => {
            const battleState = {
                id: 'battle-cw',
                mode: BattleMode.CLAN_WARS,
                status: BattleStatus.IN_PROGRESS,
                isInIntermission: true,
                currentRound: 1,
                participants: [
                    participant({
                        userId: 'u1',
                        teamId: 'team-1',
                        isReady: true,
                    }),
                    participant({
                        userId: 'u2',
                        teamId: 'team-2',
                        isReady: false,
                    }),
                ],
            };
            prisma.battle.findUnique.mockResolvedValue(battleState);

            await service.unreadyForNextRound('battle-cw', 'u1');

            expect(prisma.battleParticipant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { isReady: false },
                }),
            );
            expect(
                gateway.emitClanWarsPlayerReadyNextRound,
            ).toHaveBeenCalledWith(
                'battle-cw',
                expect.objectContaining({
                    battleId: 'battle-cw',
                    userId: 'u1',
                    allReady: false,
                }),
            );
        });
    });

    // ========================================
    // endRoundAndAdvance — race safety
    // ========================================

    describe('endRoundAndAdvance', () => {
        const makeBattleAfterRound = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            status: BattleStatus.IN_PROGRESS,
            isInIntermission: false,
            currentRound: 1,
            teamSize: 2,
            clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
            teamOneName: 'T1',
            teamTwoName: 'T2',
            teamOneTag: null,
            teamTwoTag: null,
            teamOneClanId: null,
            teamTwoClanId: null,
            teamOneCaptainId: 'u1',
            teamTwoCaptainId: 'u3',
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    status: BattleRoundStatus.IN_PROGRESS,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
                {
                    id: 'r2',
                    roundNumber: 2,
                    status: BattleRoundStatus.PENDING,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
            ],
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
                participant({ userId: 'u2', teamId: 'team-1' }),
                participant({ userId: 'u3', teamId: 'team-2' }),
                participant({ userId: 'u4', teamId: 'team-2' }),
            ],
            ...overrides,
        });

        it('only the first caller wins the conditional flip; the second is a no-op', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattleAfterRound());
            prisma.battleRound.updateMany
                .mockResolvedValueOnce({ count: 1 }) // first call wins
                .mockResolvedValueOnce({ count: 0 }); // second call loses
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
            // stub out the intermission side-effect so we don't need more prisma fns
            jest.spyOn(service, 'enterIntermission').mockResolvedValue(
                undefined as any,
            );

            await service.endRoundAndAdvance(
                'battle-cw',
                'r1',
                BattleRoundEndReason.TIMER,
            );
            await service.endRoundAndAdvance(
                'battle-cw',
                'r1',
                BattleRoundEndReason.TIMER,
            );

            // round_end is emitted exactly once (by the race winner)
            expect(gateway.emitClanWarsRoundEnd).toHaveBeenCalledTimes(1);
            expect(service.enterIntermission).toHaveBeenCalledTimes(1);
        });

        it('on the final round, calls finalizeClanWars instead of enterIntermission', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattleAfterRound({
                    rounds: [
                        {
                            id: 'r1',
                            roundNumber: 1,
                            status: BattleRoundStatus.IN_PROGRESS,
                            timeLimitSeconds: 60,
                            problemId: null,
                            battleId: 'battle-cw',
                        },
                    ],
                }),
            );
            prisma.battleRound.updateMany.mockResolvedValue({ count: 1 });
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
            jest.spyOn(service, 'enterIntermission').mockResolvedValue(
                undefined as any,
            );
            jest.spyOn(service, 'finalizeClanWars').mockResolvedValue(
                undefined as any,
            );

            await service.endRoundAndAdvance(
                'battle-cw',
                'r1',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );

            expect(service.finalizeClanWars).toHaveBeenCalledWith('battle-cw');
            expect(service.enterIntermission).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // applyClanWarsMmr — clan persistence gate
    // ========================================

    describe('applyClanWarsMmr', () => {
        const makeBattle = (overrides: any = {}) => ({
            id: 'battle-cw',
            teamOneClanId: null,
            teamTwoClanId: null,
            participants: [
                participant({
                    userId: 'u1',
                    teamId: 'team-1',
                    mmr: 1000,
                }),
                participant({
                    userId: 'u2',
                    teamId: 'team-2',
                    mmr: 1000,
                }),
            ],
            ...overrides,
        });

        it('does NOT touch clan rows when both teams are temp clans (clanId null)', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());

            await service.applyClanWarsMmr('battle-cw', 'team-1');

            expect(prisma.clan.update).not.toHaveBeenCalled();
        });

        it('updates team-1 clan row on team-1 win (wins++, new mmr > old)', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({ teamOneClanId: 'clan-a' }),
            );
            prisma.clan.findUnique.mockResolvedValue({ mmr: 1000 });
            await service.applyClanWarsMmr('battle-cw', 'team-1');
            const call = prisma.clan.update.mock.calls[0][0];
            expect(call.where.id).toBe('clan-a');
            expect(call.data.wins).toEqual({ increment: 1 });
            // The MMR write is now a plain number (floored at MIN_MMR) rather
            // than an { increment } delta, so the clan rating cannot regress
            // below 0 on a long losing streak.
            expect(typeof call.data.mmr).toBe('number');
            expect(call.data.mmr).toBeGreaterThan(1000);
        });

        it('updates both clan rows with symmetric deltas when both sides are official', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    teamOneClanId: 'clan-a',
                    teamTwoClanId: 'clan-b',
                }),
            );
            prisma.clan.findUnique.mockImplementation(({ where }: any) => {
                return Promise.resolve({
                    mmr: where.id === 'clan-a' ? 1500 : 1500,
                });
            });
            await service.applyClanWarsMmr('battle-cw', 'team-2');
            const callA = prisma.clan.update.mock.calls.find(
                (c: any[]) => c[0].where.id === 'clan-a',
            );
            const callB = prisma.clan.update.mock.calls.find(
                (c: any[]) => c[0].where.id === 'clan-b',
            );
            expect(callA).toBeDefined();
            expect(callB).toBeDefined();
            expect(callA[0].data.losses).toEqual({ increment: 1 });
            expect(callB[0].data.wins).toEqual({ increment: 1 });
            expect(callA[0].data.mmr).toBeLessThan(1500);
            expect(callB[0].data.mmr).toBeGreaterThan(1500);
        });

        it('floors clan MMR at MIN_MMR (0) so repeated losses cannot make it negative', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({ teamOneClanId: 'clan-a' }),
            );
            // Clan is already at MMR 5 — a full -CLAN_MMR_CHANGE (15) would
            // drive it to -10 without the floor.
            prisma.clan.findUnique.mockResolvedValue({ mmr: 5 });
            await service.applyClanWarsMmr('battle-cw', 'team-2');
            const call = prisma.clan.update.mock.calls[0][0];
            expect(call.data.mmr).toBe(0);
        });

        it('applies 0 mmrChange to non-PRO users (PRO/trial gate)', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    participants: [
                        participant({
                            userId: 'u1',
                            teamId: 'team-1',
                            subscriptionTier: 'FREE',
                        }),
                        participant({
                            userId: 'u2',
                            teamId: 'team-2',
                            subscriptionTier: 'PRO',
                        }),
                    ],
                }),
            );
            await service.applyClanWarsMmr('battle-cw', 'team-1');

            const pCalls = prisma.battleParticipant.update.mock.calls;
            const u1Call = pCalls.find(
                (c: any[]) => c[0].where.id === 'p-u1',
            );
            const u2Call = pCalls.find(
                (c: any[]) => c[0].where.id === 'p-u2',
            );
            expect(u1Call[0].data.mmrChange).toBe(0);
            expect(u2Call[0].data.mmrChange).not.toBe(0);
            // Non-PRO user's base stats should NOT be updated.
            const userUpdates = prisma.user.update.mock.calls.map(
                (c: any[]) => c[0].where.id,
            );
            expect(userUpdates).not.toContain('u1');
            expect(userUpdates).toContain('u2');
        });
    });

    // ========================================
    // startClanWars — positive + race safety
    // ========================================

    describe('startClanWars (positive paths)', () => {
        const makeFullLobby = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            status: BattleStatus.WAITING,
            teamSize: 2,
            currentRound: 0,
            clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
                participant({ userId: 'u2', teamId: 'team-1' }),
                participant({ userId: 'u3', teamId: 'team-2' }),
                participant({ userId: 'u4', teamId: 'team-2' }),
            ],
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    status: BattleRoundStatus.PENDING,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
            ],
            ...overrides,
        });

        it('atomically flips WAITING→IN_PROGRESS, calls startRound, and only then charges games', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeFullLobby());
            prisma.battle.updateMany.mockResolvedValue({ count: 1 });
            const spyStart = jest
                .spyOn(service, 'startRound')
                .mockResolvedValue(undefined as any);

            await service.startClanWars('battle-cw');

            // Race-safe flip used instead of plain update.
            expect(prisma.battle.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'battle-cw',
                        status: BattleStatus.WAITING,
                        mode: BattleMode.CLAN_WARS,
                    }),
                    data: expect.objectContaining({
                        status: BattleStatus.IN_PROGRESS,
                        currentRound: 1,
                        isInIntermission: false,
                    }),
                }),
            );
            expect(spyStart).toHaveBeenCalledWith('battle-cw', 1);
            // Every player's daily game count is incremented exactly once.
            expect(subs.incrementGamesPlayed).toHaveBeenCalledTimes(4);
        });

        it('bails out silently when the race-safe claim is lost (count=0) — no startRound, no games charged', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeFullLobby());
            prisma.battle.updateMany.mockResolvedValue({ count: 0 });
            const spyStart = jest
                .spyOn(service, 'startRound')
                .mockResolvedValue(undefined as any);

            await expect(
                service.startClanWars('battle-cw'),
            ).resolves.toBeUndefined();

            expect(spyStart).not.toHaveBeenCalled();
            expect(subs.incrementGamesPlayed).not.toHaveBeenCalled();
        });

        it('rolls the battle back to WAITING when startRound throws (and does NOT charge games)', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeFullLobby());
            prisma.battle.updateMany.mockResolvedValue({ count: 1 });
            jest.spyOn(service, 'startRound').mockRejectedValue(
                new Error('no problems available'),
            );

            await expect(service.startClanWars('battle-cw')).rejects.toThrow(
                /no problems/,
            );

            // The rollback updateMany must have been called after the flip.
            const rollback = prisma.battle.updateMany.mock.calls.find(
                (c: any[]) =>
                    c[0].data?.status === BattleStatus.WAITING &&
                    c[0].data?.currentRound === 0,
            );
            expect(rollback).toBeDefined();
            expect(subs.incrementGamesPlayed).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // startRound
    // ========================================

    describe('startRound', () => {
        const makeBattle = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
            currentRound: 0,
            teamSize: 2,
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
                participant({ userId: 'u2', teamId: 'team-2' }),
            ],
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    status: BattleRoundStatus.PENDING,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
                {
                    id: 'r2',
                    roundNumber: 2,
                    status: BattleRoundStatus.PENDING,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
            ],
            ...overrides,
        });

        it('SAME_PROBLEM: picks a problem, flips round IN_PROGRESS, emits round_start, schedules timer', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            prisma.problem.count.mockResolvedValue(5);
            prisma.problem.findFirst.mockResolvedValue({ id: 'prob-1' });

            await service.startRound('battle-cw', 1);

            const roundUpdate = prisma.battleRound.update.mock.calls[0][0];
            expect(roundUpdate.where.id).toBe('r1');
            expect(roundUpdate.data).toMatchObject({
                status: BattleRoundStatus.IN_PROGRESS,
                problemId: 'prob-1',
            });
            expect(gateway.emitClanWarsRoundStart).toHaveBeenCalledWith(
                'battle-cw',
                expect.objectContaining({
                    battleId: 'battle-cw',
                    roundNumber: 1,
                    problemId: 'prob-1',
                }),
            );
            expect(scheduler.addTimeout).toHaveBeenCalledWith(
                'clan-wars:battle-cw:1',
                expect.anything(),
            );
        });

        it('SAME_PROBLEM: excludes problems already used in prior rounds', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    rounds: [
                        {
                            id: 'r1',
                            roundNumber: 1,
                            status: BattleRoundStatus.COMPLETED,
                            timeLimitSeconds: 60,
                            problemId: 'prob-prev',
                            battleId: 'battle-cw',
                        },
                        {
                            id: 'r2',
                            roundNumber: 2,
                            status: BattleRoundStatus.PENDING,
                            timeLimitSeconds: 60,
                            problemId: null,
                            battleId: 'battle-cw',
                        },
                    ],
                }),
            );
            prisma.problem.count.mockResolvedValue(3);
            prisma.problem.findFirst.mockResolvedValue({ id: 'prob-next' });

            await service.startRound('battle-cw', 2);

            // Count + findFirst should both filter out already-used problemIds.
            const countCall = prisma.problem.count.mock.calls[0][0];
            expect(countCall.where.id.notIn).toContain('prob-prev');
            const findCall = prisma.problem.findFirst.mock.calls[0][0];
            expect(findCall.where.id.notIn).toContain('prob-prev');
        });

        it('SAME_PROBLEM: throws when no eligible problem remains', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            prisma.problem.count.mockResolvedValue(0);

            await expect(service.startRound('battle-cw', 1)).rejects.toThrow(
                /No distinct problem/,
            );
            expect(prisma.battleRound.update).not.toHaveBeenCalled();
            expect(gateway.emitClanWarsRoundStart).not.toHaveBeenCalled();
        });

        it('SCORE_ATTACK: does NOT pick a problem (problemId stays null on the round)', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({ clanWarsFormat: ClanWarsFormat.SCORE_ATTACK }),
            );

            await service.startRound('battle-cw', 1);

            // No problem lookup for score-attack.
            expect(prisma.problem.findFirst).not.toHaveBeenCalled();
            const roundUpdate = prisma.battleRound.update.mock.calls[0][0];
            expect(roundUpdate.data.problemId).toBeNull();
            expect(gateway.emitClanWarsRoundStart).toHaveBeenCalledWith(
                'battle-cw',
                expect.objectContaining({ problemId: null }),
            );
        });

        it('refuses to start a round that is not in PENDING state', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    rounds: [
                        {
                            id: 'r1',
                            roundNumber: 1,
                            status: BattleRoundStatus.IN_PROGRESS,
                            timeLimitSeconds: 60,
                            problemId: 'x',
                            battleId: 'battle-cw',
                        },
                    ],
                }),
            );
            await expect(service.startRound('battle-cw', 1)).rejects.toThrow(
                /not PENDING/,
            );
        });
    });

    // ========================================
    // submitClanWarsRound
    // ========================================

    describe('submitClanWarsRound', () => {
        const makeBattle = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            status: BattleStatus.IN_PROGRESS,
            isInIntermission: false,
            clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
            teamSize: 2,
            teamOneName: 'T1',
            teamTwoName: 'T2',
            teamOneTag: null,
            teamTwoTag: null,
            teamOneClanId: null,
            teamTwoClanId: null,
            teamOneCaptainId: 'u1',
            teamTwoCaptainId: 'u3',
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
                participant({ userId: 'u2', teamId: 'team-1' }),
                participant({ userId: 'u3', teamId: 'team-2' }),
                participant({ userId: 'u4', teamId: 'team-2' }),
            ],
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    status: BattleRoundStatus.IN_PROGRESS,
                    timeLimitSeconds: 60,
                    problemId: 'prob-1',
                    battleId: 'battle-cw',
                },
            ],
            problemPool: null,
            ...overrides,
        });

        const execOk = {
            allPassed: true,
            passed: 10,
            total: 10,
            results: [],
        };
        const execPartial = {
            allPassed: false,
            passed: 6,
            total: 10,
            results: [],
        };

        beforeEach(() => {
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
            prisma.battleRound.updateMany.mockResolvedValue({ count: 0 });
        });

        it('rejects submission during intermission', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({ isInIntermission: true }),
            );
            await expect(
                service.submitClanWarsRound(
                    'battle-cw',
                    'u1',
                    'x',
                    'js',
                    'prob-1',
                ),
            ).rejects.toThrow(/intermission/);
        });

        it('rejects submission from a non-participant', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            await expect(
                service.submitClanWarsRound(
                    'battle-cw',
                    'outsider',
                    'x',
                    'js',
                    'prob-1',
                ),
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('SAME_PROBLEM: rejects submitted problemId that does not match the round problem', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            await expect(
                service.submitClanWarsRound(
                    'battle-cw',
                    'u1',
                    'x',
                    'js',
                    'prob-different',
                ),
            ).rejects.toThrow(/does not match/);
        });

        it('SAME_PROBLEM: first passing submission creates row and awards 0 points (tests-passed signal drives round winner)', async () => {
            const mockExec = (service as any).codeExecutionService.executeCode;
            mockExec.mockResolvedValue(execOk);
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            prisma.battleRoundSubmission.findUnique.mockResolvedValue(null);

            const res = await service.submitClanWarsRound(
                'battle-cw',
                'u1',
                'code',
                'js',
                'prob-1',
            );

            expect(prisma.battleRoundSubmission.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        roundId: 'r1',
                        userId: 'u1',
                        problemId: 'prob-1',
                        allPassed: true,
                        pointsEarned: 0, // SAME_PROBLEM never awards points
                    }),
                }),
            );
            expect(res.allPassed).toBe(true);
            expect(res.pointsAwarded).toBe(0);
        });

        it('SCORE_ATTACK (no pool): awards DIFFICULTY_POINTS on allPassed', async () => {
            const mockExec = (service as any).codeExecutionService.executeCode;
            mockExec.mockResolvedValue(execOk);
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
                    rounds: [
                        {
                            id: 'r1',
                            roundNumber: 1,
                            status: BattleRoundStatus.IN_PROGRESS,
                            timeLimitSeconds: 60,
                            problemId: null,
                            battleId: 'battle-cw',
                        },
                    ],
                }),
            );
            prisma.problem.findUnique.mockResolvedValue({
                id: 'prob-1',
                difficulty: 'HARD',
            });
            prisma.battleRoundSubmission.findUnique.mockResolvedValue(null);

            const res = await service.submitClanWarsRound(
                'battle-cw',
                'u1',
                'code',
                'js',
                'prob-1',
            );

            expect(res.pointsAwarded).toBe(10); // HARD = 10
        });

        it('SCORE_ATTACK with explicit pool: rejects problems outside the pool', async () => {
            const mockExec = (service as any).codeExecutionService.executeCode;
            mockExec.mockResolvedValue(execOk);
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
                    rounds: [
                        {
                            id: 'r1',
                            roundNumber: 1,
                            status: BattleRoundStatus.IN_PROGRESS,
                            timeLimitSeconds: 60,
                            problemId: null,
                            battleId: 'battle-cw',
                        },
                    ],
                    problemPool: {
                        items: [{ problemId: 'pool-1', pointValue: 5 }],
                    },
                }),
            );
            await expect(
                service.submitClanWarsRound(
                    'battle-cw',
                    'u1',
                    'code',
                    'js',
                    'not-in-pool',
                ),
            ).rejects.toThrow(/not part of the SCORE_ATTACK pool/);
        });

        it('upsert-best: later WORSE attempt does NOT update the submission and participant stats remain at the best', async () => {
            const mockExec = (service as any).codeExecutionService.executeCode;
            mockExec.mockResolvedValue(execPartial);
            // Participant already at 10/10 (best) from a previous full-pass
            const battleState = makeBattle({
                participants: [
                    participant({
                        userId: 'u1',
                        teamId: 'team-1',
                        testsPassed: 10,
                        totalTests: 10,
                    }),
                    participant({ userId: 'u2', teamId: 'team-1' }),
                    participant({ userId: 'u3', teamId: 'team-2' }),
                    participant({ userId: 'u4', teamId: 'team-2' }),
                ],
            });
            prisma.battle.findUnique.mockResolvedValue(battleState);
            prisma.battleRoundSubmission.findUnique.mockResolvedValue({
                id: 'sub-1',
                pointsEarned: 0,
                testsPassed: 10,
                totalTests: 10,
                allPassed: true,
            });

            await service.submitClanWarsRound(
                'battle-cw',
                'u1',
                'worse-code',
                'js',
                'prob-1',
            );

            // Submission row is NOT updated with the regression.
            expect(prisma.battleRoundSubmission.update).not.toHaveBeenCalled();
            // Participant row keeps the BEST testsPassed/totalTests across
            // attempts (previous fix protects standings from regressions).
            const pCall = prisma.battleParticipant.update.mock.calls[0][0];
            expect(pCall.data.testsPassed).toBe(10);
            expect(pCall.data.totalTests).toBe(10);
            // Latest code/language/submittedAt still reflect the new attempt.
            expect(pCall.data.code).toBe('worse-code');
            expect(pCall.data.language).toBe('js');
            expect(pCall.data.submittedAt).toBeInstanceOf(Date);
        });

        it('emits team_standings and calls evaluateRoundEnd after every submission', async () => {
            const mockExec = (service as any).codeExecutionService.executeCode;
            mockExec.mockResolvedValue(execPartial);
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            prisma.battleRoundSubmission.findUnique.mockResolvedValue(null);
            const evalSpy = jest
                .spyOn(service, 'evaluateRoundEnd')
                .mockResolvedValue(undefined as any);

            await service.submitClanWarsRound(
                'battle-cw',
                'u1',
                'code',
                'js',
                'prob-1',
            );

            expect(
                gateway.emitClanWarsTeamStandings,
            ).toHaveBeenCalledTimes(1);
            expect(evalSpy).toHaveBeenCalledWith('battle-cw', 'r1');
        });
    });

    // ========================================
    // evaluateRoundEnd
    // ========================================

    describe('evaluateRoundEnd', () => {
        const makeBattle = (overrides: any = {}) => ({
            id: 'battle-cw',
            status: BattleStatus.IN_PROGRESS,
            clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
                participant({ userId: 'u2', teamId: 'team-1' }),
                participant({ userId: 'u3', teamId: 'team-2' }),
                participant({ userId: 'u4', teamId: 'team-2' }),
            ],
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    status: BattleRoundStatus.IN_PROGRESS,
                    timeLimitSeconds: 60,
                    problemId: 'prob-1',
                    battleId: 'battle-cw',
                },
            ],
            ...overrides,
        });

        it('ends the round EARLY_ALL_PASSED when one team has all members passing', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                { userId: 'u1' },
                { userId: 'u2' },
            ]);
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);

            await service.evaluateRoundEnd('battle-cw', 'r1');

            expect(spy).toHaveBeenCalledWith(
                'battle-cw',
                'r1',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );
        });

        it('does NOT end the round when only some team members have passed', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                { userId: 'u1' }, // only 1/2 of team-1
            ]);
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);

            await service.evaluateRoundEnd('battle-cw', 'r1');
            expect(spy).not.toHaveBeenCalled();
        });

        it('is a no-op for SCORE_ATTACK (relies on timer)', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
                }),
            );
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);

            await service.evaluateRoundEnd('battle-cw', 'r1');
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // handleRoundTimer
    // ========================================

    describe('handleRoundTimer', () => {
        it('ends the round with reason=TIMER when still IN_PROGRESS', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-cw',
                status: BattleStatus.IN_PROGRESS,
                rounds: [
                    {
                        id: 'r1',
                        roundNumber: 1,
                        status: BattleRoundStatus.IN_PROGRESS,
                    },
                ],
            });
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);

            await service.handleRoundTimer('battle-cw', 1);

            expect(spy).toHaveBeenCalledWith(
                'battle-cw',
                'r1',
                BattleRoundEndReason.TIMER,
            );
        });

        it('no-ops when the round already ended (race-safe against early-end)', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-cw',
                status: BattleStatus.IN_PROGRESS,
                rounds: [
                    {
                        id: 'r1',
                        roundNumber: 1,
                        status: BattleRoundStatus.COMPLETED,
                    },
                ],
            });
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);

            await service.handleRoundTimer('battle-cw', 1);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // getTeamStandings
    // ========================================

    describe('getTeamStandings', () => {
        const makeBattle = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
            teamSize: 2,
            teamOneName: 'Alpha',
            teamOneTag: 'A',
            teamOneClanId: 'clan-a',
            teamOneCaptainId: 'u1',
            teamTwoName: 'Bravo',
            teamTwoTag: 'B',
            teamTwoClanId: null,
            teamTwoCaptainId: 'u3',
            participants: [
                participant({ userId: 'u1', teamId: 'team-1', testsPassed: 5, totalTests: 10 }),
                participant({ userId: 'u2', teamId: 'team-1', testsPassed: 3, totalTests: 10 }),
                participant({ userId: 'u3', teamId: 'team-2', testsPassed: 7, totalTests: 10 }),
                participant({ userId: 'u4', teamId: 'team-2', testsPassed: 8, totalTests: 10 }),
            ],
            rounds: [
                {
                    id: 'r1',
                    roundNumber: 1,
                    status: BattleRoundStatus.COMPLETED,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
                {
                    id: 'r2',
                    roundNumber: 2,
                    status: BattleRoundStatus.IN_PROGRESS,
                    timeLimitSeconds: 60,
                    problemId: null,
                    battleId: 'battle-cw',
                },
            ],
            ...overrides,
        });

        it('computes cumulative points, round points (current round), and round wins per team (SCORE_ATTACK)', async () => {
            prisma.battle.findUnique.mockResolvedValue(makeBattle());
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                // Round 1 (completed): team-1 earned 8, team-2 earned 5 → t1 wins r1
                {
                    userId: 'u1',
                    pointsEarned: 5,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r1',
                    submittedAt: new Date('2024-01-01T00:00:00Z'),
                },
                {
                    userId: 'u2',
                    pointsEarned: 3,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r1',
                    submittedAt: new Date('2024-01-01T00:01:00Z'),
                },
                {
                    userId: 'u3',
                    pointsEarned: 5,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r1',
                    submittedAt: new Date('2024-01-01T00:00:30Z'),
                },
                // Round 2 (in progress): team-2 so far has 10, team-1 has 2
                {
                    userId: 'u1',
                    pointsEarned: 2,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r2',
                    submittedAt: new Date('2024-01-01T00:05:00Z'),
                },
                {
                    userId: 'u3',
                    pointsEarned: 5,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r2',
                    submittedAt: new Date('2024-01-01T00:06:00Z'),
                },
                {
                    userId: 'u4',
                    pointsEarned: 5,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r2',
                    submittedAt: new Date('2024-01-01T00:06:30Z'),
                },
            ]);

            const [t1, t2] = await service.getTeamStandings('battle-cw');

            // Cumulative = all rounds
            expect(t1.cumulativePoints).toBe(5 + 3 + 2); // 10
            expect(t2.cumulativePoints).toBe(5 + 5 + 5); // 15
            // roundPoints only for the IN_PROGRESS round
            expect(t1.roundPoints).toBe(2);
            expect(t2.roundPoints).toBe(10);
            // roundsWon counts COMPLETED rounds
            expect(t1.roundsWon).toBe(1); // won r1 8 vs 5
            expect(t2.roundsWon).toBe(0);
            // lastSubmittedAt is the latest timestamp across all attempts
            expect(t1.lastSubmittedAt?.toISOString()).toBe(
                '2024-01-01T00:05:00.000Z',
            );
            expect(t2.lastSubmittedAt?.toISOString()).toBe(
                '2024-01-01T00:06:30.000Z',
            );
        });

        it('SAME_PROBLEM: round wins are based on distinct allPassed=true members per team', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                makeBattle({
                    clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                }),
            );
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                // Round 1 completed: team-2 sweeps (both pass), team-1 only 1/2
                {
                    userId: 'u1',
                    pointsEarned: 0,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r1',
                    submittedAt: new Date(),
                },
                {
                    userId: 'u3',
                    pointsEarned: 0,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r1',
                    submittedAt: new Date(),
                },
                {
                    userId: 'u4',
                    pointsEarned: 0,
                    testsPassed: 10,
                    allPassed: true,
                    roundId: 'r1',
                    submittedAt: new Date(),
                },
            ]);

            const [t1, t2] = await service.getTeamStandings('battle-cw');
            expect(t1.roundsWon).toBe(0);
            expect(t2.roundsWon).toBe(1);
        });
    });

    // ========================================
    // finalizeClanWars — tie-breaks + emit
    // ========================================

    describe('finalizeClanWars', () => {
        const baseBattle = (overrides: any = {}) => ({
            id: 'battle-cw',
            mode: BattleMode.CLAN_WARS,
            status: BattleStatus.IN_PROGRESS,
            teamOneClanId: null,
            teamTwoClanId: null,
            participants: [
                participant({ userId: 'u1', teamId: 'team-1' }),
                participant({ userId: 'u2', teamId: 'team-2' }),
            ],
            ...overrides,
        });

        const stubStandings = (data: {
            t1Cum: number;
            t2Cum: number;
            t1RoundsWon?: number;
            t2RoundsWon?: number;
            t1LastAt?: Date | null;
            t2LastAt?: Date | null;
        }) => {
            jest.spyOn(service, 'getTeamStandings').mockResolvedValue([
                {
                    team: 'team-1',
                    clanId: null,
                    name: 'T1',
                    tag: null,
                    captainId: 'u1',
                    cumulativePoints: data.t1Cum,
                    roundPoints: 0,
                    roundsWon: data.t1RoundsWon ?? 0,
                    testsPassed: 0,
                    totalTests: 0,
                    lastSubmittedAt: data.t1LastAt ?? null,
                    members: [],
                },
                {
                    team: 'team-2',
                    clanId: null,
                    name: 'T2',
                    tag: null,
                    captainId: 'u2',
                    cumulativePoints: data.t2Cum,
                    roundPoints: 0,
                    roundsWon: data.t2RoundsWon ?? 0,
                    testsPassed: 0,
                    totalTests: 0,
                    lastSubmittedAt: data.t2LastAt ?? null,
                    members: [],
                },
            ]);
        };

        beforeEach(() => {
            // Common prerequisites for finalizeClanWars → applyClanWarsMmr →
            // getClanWarsDetails → emitBattleCompleted.
            prisma.battle.update.mockResolvedValue({});
            // getClanWarsDetails performs a battle.findUnique with a big
            // include — a minimal shape is enough for the emit.
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-cw',
                participants: [],
                rounds: [],
                problem: null,
                problemPool: null,
            });
        });

        it('picks team-1 when cumulative points are higher', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(baseBattle());
            stubStandings({ t1Cum: 20, t2Cum: 10 });
            jest.spyOn(service, 'applyClanWarsMmr').mockResolvedValue(
                undefined as any,
            );

            await service.finalizeClanWars('battle-cw');

            const final = prisma.battle.update.mock.calls.find(
                (c: any[]) => c[0].data?.status === BattleStatus.COMPLETED,
            );
            expect(final).toBeDefined();
            expect(final[0].data.winningTeam).toBe('team-1');
            expect(gateway.emitBattleCompleted).toHaveBeenCalledWith(
                'battle-cw',
                expect.anything(),
            );
        });

        it('tie-break 1: equal points → team with more roundsWon wins', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(baseBattle());
            stubStandings({
                t1Cum: 10,
                t2Cum: 10,
                t1RoundsWon: 1,
                t2RoundsWon: 2,
            });
            jest.spyOn(service, 'applyClanWarsMmr').mockResolvedValue(
                undefined as any,
            );

            await service.finalizeClanWars('battle-cw');
            const final = prisma.battle.update.mock.calls.find(
                (c: any[]) => c[0].data?.status === BattleStatus.COMPLETED,
            );
            expect(final[0].data.winningTeam).toBe('team-2');
        });

        it('tie-break 2: equal points + rounds → earlier lastSubmittedAt wins', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(baseBattle());
            stubStandings({
                t1Cum: 10,
                t2Cum: 10,
                t1RoundsWon: 1,
                t2RoundsWon: 1,
                t1LastAt: new Date('2024-01-01T00:00:00Z'),
                t2LastAt: new Date('2024-01-01T00:00:30Z'),
            });
            jest.spyOn(service, 'applyClanWarsMmr').mockResolvedValue(
                undefined as any,
            );

            await service.finalizeClanWars('battle-cw');
            const final = prisma.battle.update.mock.calls.find(
                (c: any[]) => c[0].data?.status === BattleStatus.COMPLETED,
            );
            // team-1 finished 30s earlier → wins the tiebreaker.
            expect(final[0].data.winningTeam).toBe('team-1');
        });

        it('tie-break 3: only one team ever submitted → they win even if cumulative is 0', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(baseBattle());
            stubStandings({
                t1Cum: 0,
                t2Cum: 0,
                t1LastAt: null,
                t2LastAt: new Date('2024-01-01T00:00:00Z'),
            });
            jest.spyOn(service, 'applyClanWarsMmr').mockResolvedValue(
                undefined as any,
            );

            await service.finalizeClanWars('battle-cw');
            const final = prisma.battle.update.mock.calls.find(
                (c: any[]) => c[0].data?.status === BattleStatus.COMPLETED,
            );
            expect(final[0].data.winningTeam).toBe('team-2');
        });

        it('is a no-op when the battle is already COMPLETED (idempotent)', async () => {
            prisma.battle.findUnique.mockResolvedValueOnce(
                baseBattle({ status: BattleStatus.COMPLETED }),
            );
            const applySpy = jest
                .spyOn(service, 'applyClanWarsMmr')
                .mockResolvedValue(undefined as any);

            await service.finalizeClanWars('battle-cw');
            expect(applySpy).not.toHaveBeenCalled();
            expect(gateway.emitBattleCompleted).not.toHaveBeenCalled();
        });
    });
});
