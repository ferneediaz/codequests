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
    BattleRoyaleFormat,
    BattleStatus,
    Difficulty,
} from '@prisma/client';

import { BattleRoyaleService } from './battle-royale.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeasonsService } from '../seasons/seasons.service';
import { ProblemsService } from '../problems/problems.service';
import { BattlesGateway } from '../websockets/battles.gateway';
import { CreateBattleDto } from './dto/create-battle.dto';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';

// ============================================
// Test helpers
// ============================================

const makeConfig = (overrides: Partial<CreateBattleDto> = {}): CreateBattleDto =>
    ({
        mode: BattleMode.BATTLE_ROYALE,
        battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
        maxPlayers: 8,
        rounds: [
            { timeLimitSeconds: 300, eliminateCount: 3 },
            { timeLimitSeconds: 300, eliminateCount: 3 },
            { timeLimitSeconds: 300, eliminateCount: 1 },
        ],
        ...overrides,
    } as CreateBattleDto);

const participant = (overrides: any = {}) => ({
    id: `p-${overrides.userId ?? 'u'}`,
    battleId: 'battle-br',
    userId: overrides.userId ?? 'u1',
    teamId: null,
    code: null,
    language: null,
    testsPassed: 0,
    totalTests: 0,
    submittedAt: null,
    pointsEarned: 0,
    isReady: false,
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
        clan: null,
    },
    ...overrides,
});

const round = (overrides: any = {}) => ({
    id: `r-${overrides.roundNumber ?? 1}`,
    battleId: 'battle-br',
    roundNumber: overrides.roundNumber ?? 1,
    timeLimitSeconds: 300,
    eliminateCount: 2,
    status: BattleRoundStatus.PENDING,
    problemId: null,
    startedAt: null,
    endedAt: null,
    endedReason: null,
    ...overrides,
});

describe('BattleRoyaleService', () => {
    let service: BattleRoyaleService;
    let prisma: MockPrismaService;
    let codeExec: jest.Mocked<CodeExecutionService>;
    let subs: jest.Mocked<SubscriptionsService>;
    let seasons: jest.Mocked<SeasonsService>;
    let problems: jest.Mocked<ProblemsService>;
    let scheduler: {
        addTimeout: jest.Mock;
        deleteTimeout: jest.Mock;
        doesExist: jest.Mock;
    };
    let gateway: {
        emitRoyaleRoundStart: jest.Mock;
        emitRoyaleRoundEnd: jest.Mock;
        emitRoyaleElimination: jest.Mock;
        emitRoyaleStandings: jest.Mock;
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
            emitRoyaleRoundStart: jest.fn(),
            emitRoyaleRoundEnd: jest.fn(),
            emitRoyaleElimination: jest.fn(),
            emitRoyaleStandings: jest.fn(),
            emitBattleCompleted: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BattleRoyaleService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CodeExecutionService, useValue: mockCodeExec },
                { provide: SubscriptionsService, useValue: mockSubs },
                { provide: SeasonsService, useValue: mockSeasons },
                { provide: ProblemsService, useValue: mockProblems },
                { provide: SchedulerRegistry, useValue: scheduler },
                { provide: BattlesGateway, useValue: gateway },
            ],
        }).compile();

        service = module.get<BattleRoyaleService>(BattleRoyaleService);
        prisma = module.get<MockPrismaService>(PrismaService);
        codeExec = module.get(CodeExecutionService);
        subs = module.get(SubscriptionsService);
        seasons = module.get(SeasonsService);
        problems = module.get(ProblemsService);

        // By default, transactions simply delegate to the mock prisma so we can
        // assert on the same mock fn spies.
        prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    });

    // ========================================
    // validateConfig
    // ========================================

    describe('validateConfig', () => {
        it('accepts a valid 8p / 3-round SAME_PROBLEM config', () => {
            expect(() => service.validateConfig(makeConfig())).not.toThrow();
        });

        it('accepts a 20p / 5-round SCORE_ATTACK config with mixed eliminations', () => {
            const dto = makeConfig({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                maxPlayers: 20,
                rounds: [
                    { timeLimitSeconds: 1800, eliminateCount: 5 },
                    { timeLimitSeconds: 1800, eliminateCount: 5 },
                    { timeLimitSeconds: 1800, eliminateCount: 5 },
                    { timeLimitSeconds: 1800, eliminateCount: 3 },
                    { timeLimitSeconds: 900, eliminateCount: 1 },
                ],
            });
            expect(() => service.validateConfig(dto)).not.toThrow();
        });

        it('rejects when mode is not BATTLE_ROYALE', () => {
            const dto = makeConfig({ mode: BattleMode.ONE_V_ONE });
            expect(() => service.validateConfig(dto)).toThrow(BadRequestException);
        });

        it('rejects missing battleRoyaleFormat', () => {
            const dto = makeConfig({ battleRoyaleFormat: undefined });
            expect(() => service.validateConfig(dto)).toThrow(/battleRoyaleFormat/);
        });

        it('rejects maxPlayers < 3', () => {
            const dto = makeConfig({
                maxPlayers: 2,
                rounds: [{ timeLimitSeconds: 300, eliminateCount: 1 }],
            });
            expect(() => service.validateConfig(dto)).toThrow(/maxPlayers/);
        });

        it('rejects maxPlayers > 50', () => {
            const dto = makeConfig({ maxPlayers: 51 });
            expect(() => service.validateConfig(dto)).toThrow(/maxPlayers/);
        });

        it('rejects empty rounds', () => {
            const dto = makeConfig({ rounds: [] });
            expect(() => service.validateConfig(dto)).toThrow(/rounds/);
        });

        it('rejects single-round configs (Battle Royale requires at least 2 rounds)', () => {
            const dto = makeConfig({
                maxPlayers: 8,
                rounds: [{ timeLimitSeconds: 600, eliminateCount: 7 }],
            });
            expect(() => service.validateConfig(dto)).toThrow(/at least two round/);
        });

        it('rejects rounds.length > maxPlayers - 1', () => {
            const dto = makeConfig({
                maxPlayers: 3,
                rounds: [
                    { timeLimitSeconds: 60, eliminateCount: 1 },
                    { timeLimitSeconds: 60, eliminateCount: 1 },
                    { timeLimitSeconds: 60, eliminateCount: 0 },
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/maxPlayers - 1/);
        });

        it('rejects sum of eliminations != maxPlayers - 1', () => {
            const dto = makeConfig({
                rounds: [
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    // missing one elimination: sum = 6, but maxPlayers-1 = 7
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/Sum of eliminateCount/);
        });

        it('rejects any prefix where over-elimination would occur', () => {
            const dto = makeConfig({
                maxPlayers: 5,
                rounds: [
                    // elim 5 in first round leaves 0 players
                    { timeLimitSeconds: 300, eliminateCount: 5 },
                    { timeLimitSeconds: 300, eliminateCount: -1 }, // also invalid, but caught earlier
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/over-elimination/);
        });

        it('rejects last round eliminateCount === 0', () => {
            const dto = makeConfig({
                maxPlayers: 4,
                rounds: [
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 0 },
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/last round/);
        });

        it('rejects negative eliminateCount', () => {
            const dto = makeConfig({
                rounds: [
                    { timeLimitSeconds: 300, eliminateCount: -1 },
                    { timeLimitSeconds: 300, eliminateCount: 8 },
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/eliminateCount/);
        });

        it('rejects timeLimitSeconds below minimum (10s)', () => {
            const dto = makeConfig({
                rounds: [
                    { timeLimitSeconds: 5, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/timeLimitSeconds/);
        });

        it('rejects timeLimitSeconds above maximum (7200s)', () => {
            const dto = makeConfig({
                rounds: [
                    { timeLimitSeconds: 7201, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/timeLimitSeconds/);
        });

        it('rejects non-integer timeLimitSeconds', () => {
            const dto = makeConfig({
                rounds: [
                    { timeLimitSeconds: 300.5, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/integer/);
        });

        it('accepts a minimal 3p / 2-round config', () => {
            const dto = makeConfig({
                maxPlayers: 3,
                rounds: [
                    { timeLimitSeconds: 60, eliminateCount: 1 },
                    { timeLimitSeconds: 60, eliminateCount: 1 },
                ],
            });
            expect(() => service.validateConfig(dto)).not.toThrow();
        });

        it('rejects a single-round config (e.g., 8p [7]) even if eliminations sum correctly', () => {
            const dto = makeConfig({
                maxPlayers: 8,
                rounds: [{ timeLimitSeconds: 600, eliminateCount: 7 }],
            });
            expect(() => service.validateConfig(dto)).toThrow(/at least two round/);
        });

        it('rejects a config where the last round eliminates more than 1 (not a 1v1)', () => {
            // 8 players, [4, 3] → last round begins with 4 players, eliminates 3.
            // Valid by the old rules (sum=7, last>=1) but not a 1v1 finale.
            const dto = makeConfig({
                maxPlayers: 8,
                rounds: [
                    { timeLimitSeconds: 300, eliminateCount: 4 },
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                ],
            });
            expect(() => service.validateConfig(dto)).toThrow(/1v1/);
        });

        it('accepts a two-round config with a 1v1 final (e.g., 8p [6, 1])', () => {
            const dto = makeConfig({
                maxPlayers: 8,
                rounds: [
                    { timeLimitSeconds: 600, eliminateCount: 6 },
                    { timeLimitSeconds: 600, eliminateCount: 1 },
                ],
            });
            expect(() => service.validateConfig(dto)).not.toThrow();
        });

        it('all four server presets end in a 1v1 (last.eliminateCount === 1)', () => {
            const presets = service.getPresets();
            for (const p of presets) {
                expect(p.rounds[p.rounds.length - 1].eliminateCount).toBe(1);
            }
        });
    });

    // ========================================
    // getPresets
    // ========================================

    describe('getPresets', () => {
        it('returns the four server presets and they all validate', () => {
            const presets = service.getPresets();
            expect(presets.length).toBeGreaterThanOrEqual(4);
            for (const p of presets) {
                expect(() =>
                    service.validateConfig(
                        makeConfig({
                            mode: BattleMode.BATTLE_ROYALE,
                            battleRoyaleFormat: p.battleRoyaleFormat,
                            maxPlayers: p.maxPlayers,
                            rounds: p.rounds,
                        }),
                    ),
                ).not.toThrow();
            }
        });

        it('includes a mega-20 preset with mixed eliminations', () => {
            const presets = service.getPresets();
            const mega = presets.find((p) => p.id === 'mega-20')!;
            expect(mega).toBeDefined();
            expect(mega.maxPlayers).toBe(20);
            const total = mega.rounds.reduce((a, b) => a + b.eliminateCount, 0);
            expect(total).toBe(19);
        });
    });

    // ========================================
    // createRoyaleBattle
    // ========================================

    describe('createRoyaleBattle', () => {
        beforeEach(() => {
            prisma.user.findUnique.mockResolvedValue({ id: 'u1' } as any);
            prisma.problem.count.mockResolvedValue(10);
            prisma.battle.create.mockResolvedValue({ id: 'battle-br' } as any);
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-br',
                participants: [],
                rounds: [],
            } as any);
        });

        it('happy path: creates battle + creator participant + PENDING rounds', async () => {
            const dto = makeConfig();
            await service.createRoyaleBattle('u1', dto);

            expect(subs.canPlay).toHaveBeenCalledWith('u1');
            expect(prisma.battle.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        mode: BattleMode.BATTLE_ROYALE,
                        battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
                        maxPlayers: 8,
                        status: BattleStatus.WAITING,
                        participants: expect.any(Object),
                        rounds: expect.any(Object),
                    }),
                }),
            );
            // Verify rounds list length matches dto
            const callArg = (prisma.battle.create.mock.calls[0] as any)[0];
            expect(callArg.data.rounds.create).toHaveLength(dto.rounds!.length);
            expect(callArg.data.rounds.create[0]).toMatchObject({
                roundNumber: 1,
                timeLimitSeconds: 300,
                eliminateCount: 3,
                status: BattleRoundStatus.PENDING,
            });
        });

        it('throws Forbidden when subscriptionsService.canPlay is false', async () => {
            subs.canPlay.mockResolvedValue(false);
            await expect(
                service.createRoyaleBattle('u1', makeConfig()),
            ).rejects.toThrow(ForbiddenException);
        });

        it('rejects a non-BR mode', async () => {
            const dto = makeConfig({ mode: BattleMode.ONE_V_ONE });
            await expect(
                service.createRoyaleBattle('u1', dto),
            ).rejects.toThrow(BadRequestException);
        });

        it('rejects SAME_PROBLEM when DB has fewer distinct problems than rounds', async () => {
            prisma.problem.count.mockResolvedValue(2);
            const dto = makeConfig(); // 3 rounds
            await expect(
                service.createRoyaleBattle('u1', dto),
            ).rejects.toThrow(/Not enough distinct problems/);
        });

        it('rejects SCORE_ATTACK when problemIds reference missing problems', async () => {
            prisma.problem.count.mockResolvedValueOnce(1); // for the `in:` count
            const dto = makeConfig({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                problemIds: ['p1', 'p2'],
            });
            await expect(
                service.createRoyaleBattle('u1', dto),
            ).rejects.toThrow(/problemIds do not exist/);
        });

        it('SCORE_ATTACK auto-pool path: no problemIds → succeeds WITHOUT creating a ProblemPool', async () => {
            const dto = makeConfig({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
            });
            await expect(
                service.createRoyaleBattle('u1', dto),
            ).resolves.toBeDefined();
            // Auto-pool means the server doesn't commit to a fixed pool at
            // create time — there must be no ProblemPool row.
            expect(prisma.problemPool.create).not.toHaveBeenCalled();
        });

        it('SCORE_ATTACK auto-pool rejects when no problems exist at all', async () => {
            prisma.problem.count.mockResolvedValue(0);
            const dto = makeConfig({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
            });
            await expect(
                service.createRoyaleBattle('u1', dto),
            ).rejects.toThrow(/No problems available/);
        });

        it('SCORE_ATTACK with explicit problemIds: creates a ProblemPool with difficulty-based pointValues', async () => {
            // count of matching problems must equal len(problemIds) to pass
            prisma.problem.count.mockResolvedValue(3);
            prisma.problem.findMany.mockResolvedValue([
                { id: 'p-easy', difficulty: Difficulty.EASY },
                { id: 'p-medium', difficulty: Difficulty.MEDIUM },
                { id: 'p-hard', difficulty: Difficulty.HARD },
            ] as any);
            prisma.problemPool.create.mockResolvedValue({} as any);

            const dto = makeConfig({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                problemIds: ['p-easy', 'p-medium', 'p-hard'],
            });

            await service.createRoyaleBattle('u1', dto);

            expect(prisma.problemPool.create).toHaveBeenCalledTimes(1);
            const poolArg = (prisma.problemPool.create.mock.calls[0] as any)[0];
            expect(poolArg.data.battleId).toBe('battle-br');
            // Each pool item must carry its problem's difficulty-based point value.
            expect(poolArg.data.items.create).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        problemId: 'p-easy',
                        pointValue: 2,
                    }),
                    expect.objectContaining({
                        problemId: 'p-medium',
                        pointValue: 5,
                    }),
                    expect.objectContaining({
                        problemId: 'p-hard',
                        pointValue: 10,
                    }),
                ]),
            );
        });

        it('persists the active seasonId on the created battle when one exists', async () => {
            await service.createRoyaleBattle('u1', makeConfig());
            const createArg = (prisma.battle.create.mock.calls[0] as any)[0];
            expect(createArg.data.seasonId).toBe('season-1');
        });

        it('persists null seasonId when no active season exists', async () => {
            seasons.getActiveSeason.mockResolvedValueOnce(null as any);
            await service.createRoyaleBattle('u1', makeConfig());
            const createArg = (prisma.battle.create.mock.calls[0] as any)[0];
            expect(createArg.data.seasonId).toBeNull();
        });

        it('throws NotFound when user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(
                service.createRoyaleBattle('u1', makeConfig()),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ========================================
    // enforceRoyaleJoinCap
    // ========================================

    describe('enforceRoyaleJoinCap', () => {
        it('throws when missing maxPlayers', () => {
            expect(() =>
                service.enforceRoyaleJoinCap({
                    maxPlayers: null,
                    participants: [],
                }),
            ).toThrow(/maxPlayers/);
        });

        it('throws when lobby is full', () => {
            expect(() =>
                service.enforceRoyaleJoinCap({
                    maxPlayers: 3,
                    participants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
                }),
            ).toThrow(/lobby is full/);
        });

        it('allows when lobby has space', () => {
            expect(() =>
                service.enforceRoyaleJoinCap({
                    maxPlayers: 4,
                    participants: [{ id: 'a' }, { id: 'b' }],
                }),
            ).not.toThrow();
        });
    });

    // ========================================
    // startRoyale
    // ========================================

    describe('startRoyale', () => {
        const buildBattle = (overrides: any = {}) => ({
            id: 'battle-br',
            mode: BattleMode.BATTLE_ROYALE,
            battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
            status: BattleStatus.WAITING,
            maxPlayers: 3,
            currentRound: 0,
            participants: [
                participant({ userId: 'u1' }),
                participant({ userId: 'u2' }),
                participant({ userId: 'u3' }),
            ],
            rounds: [
                round({ roundNumber: 1, eliminateCount: 1 }),
                round({ roundNumber: 2, eliminateCount: 1 }),
            ],
            ...overrides,
        });

        beforeEach(() => {
            prisma.problem.findFirst.mockResolvedValue({ id: 'problem-1' });
            prisma.problem.count.mockResolvedValue(10);
            prisma.battleRound.update.mockResolvedValue({} as any);
            prisma.battle.update.mockResolvedValue({} as any);
        });

        it('starts round 1, emits round_start, schedules timer when lobby full and all ready', async () => {
            prisma.battle.findUnique.mockResolvedValue(buildBattle());

            await service.startRoyale('battle-br');

            expect(prisma.battle.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'battle-br' },
                    data: expect.objectContaining({
                        status: BattleStatus.IN_PROGRESS,
                        currentRound: 1,
                    }),
                }),
            );
            expect(subs.incrementGamesPlayed).toHaveBeenCalledTimes(3);
            expect(gateway.emitRoyaleRoundStart).toHaveBeenCalledWith(
                'battle-br',
                expect.objectContaining({ roundNumber: 1 }),
            );
            expect(scheduler.addTimeout).toHaveBeenCalledWith(
                'royale:battle-br:1',
                expect.any(Object),
            );
        });

        it('rejects when battle not found', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);
            await expect(service.startRoyale('missing')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('rejects when mode is not BR', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                buildBattle({ mode: BattleMode.ONE_V_ONE }),
            );
            await expect(service.startRoyale('battle-br')).rejects.toThrow(
                /not a Battle Royale/,
            );
        });

        it('rejects when status is not WAITING', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                buildBattle({ status: BattleStatus.IN_PROGRESS }),
            );
            await expect(service.startRoyale('battle-br')).rejects.toThrow(
                /waiting state/,
            );
        });

        it('rejects when lobby is not full', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                buildBattle({
                    participants: [
                        participant({ userId: 'u1' }),
                        participant({ userId: 'u2' }),
                    ],
                }),
            );
            await expect(service.startRoyale('battle-br')).rejects.toThrow(
                /lobby must be full/,
            );
        });

        it('does not pick a problem for SCORE_ATTACK startRound', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                buildBattle({
                    battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                }),
            );
            await service.startRoyale('battle-br');
            expect(prisma.battleRound.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: BattleRoundStatus.IN_PROGRESS,
                        problemId: null,
                    }),
                }),
            );
        });

        it('SAME_PROBLEM round 1: picks any available problem (no notIn filter when no rounds used yet)', async () => {
            prisma.battle.findUnique.mockResolvedValue(buildBattle());
            await service.startRoyale('battle-br');
            expect(prisma.problem.findFirst).toHaveBeenCalled();
            const findFirstArg = (prisma.problem.findFirst.mock.calls[0] as any)[0];
            // On round 1, usedIds is empty → where should NOT constrain by id.
            expect(findFirstArg.where?.id).toBeUndefined();
            const updateCall = (prisma.battleRound.update.mock.calls[0] as any)[0];
            expect(updateCall.data.problemId).toBe('problem-1');
        });

        it('SAME_PROBLEM round N>1: constrains findFirst with notIn for previously used problem ids', async () => {
            // Directly call startRound(2) on a battle whose round 1 already
            // chose problem-1 and is COMPLETED, to verify the distinctness
            // filter is applied on subsequent rounds.
            prisma.problem.findFirst.mockResolvedValue({ id: 'problem-2' });
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-br',
                battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
                status: BattleStatus.IN_PROGRESS,
                maxPlayers: 3,
                participants: [
                    participant({ userId: 'u1' }),
                    participant({ userId: 'u2' }),
                ],
                rounds: [
                    round({
                        roundNumber: 1,
                        status: BattleRoundStatus.COMPLETED,
                        problemId: 'problem-1',
                    }),
                    round({
                        roundNumber: 2,
                        status: BattleRoundStatus.PENDING,
                        problemId: null,
                    }),
                ],
            } as any);

            await service.startRound('battle-br', 2);

            const findFirstArg = (prisma.problem.findFirst.mock.calls[0] as any)[0];
            expect(findFirstArg.where?.id).toEqual({ notIn: ['problem-1'] });
            const countArg = (prisma.problem.count.mock.calls[0] as any)[0];
            expect(countArg.where?.id).toEqual({ notIn: ['problem-1'] });
            const updateCall = (prisma.battleRound.update.mock.calls[0] as any)[0];
            expect(updateCall.data.problemId).toBe('problem-2');
        });

        it('SAME_PROBLEM startRound throws when no distinct problem remains', async () => {
            prisma.problem.count.mockResolvedValue(0);
            prisma.problem.findFirst.mockResolvedValue(null);
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-br',
                battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
                status: BattleStatus.IN_PROGRESS,
                maxPlayers: 3,
                participants: [
                    participant({ userId: 'u1' }),
                    participant({ userId: 'u2' }),
                ],
                rounds: [
                    round({
                        roundNumber: 1,
                        status: BattleRoundStatus.PENDING,
                        problemId: null,
                    }),
                ],
            } as any);

            await expect(
                service.startRound('battle-br', 1),
            ).rejects.toThrow(/No distinct problem available/);
        });
    });

    // ========================================
    // submitRoyaleRound
    // ========================================

    describe('submitRoyaleRound', () => {
        const irBattle = (overrides: any = {}) => ({
            id: 'battle-br',
            mode: BattleMode.BATTLE_ROYALE,
            battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
            status: BattleStatus.IN_PROGRESS,
            maxPlayers: 3,
            participants: [
                participant({ userId: 'u1' }),
                participant({ userId: 'u2' }),
                participant({ userId: 'u3' }),
            ],
            rounds: [
                round({
                    roundNumber: 1,
                    status: BattleRoundStatus.IN_PROGRESS,
                    eliminateCount: 1,
                    problemId: 'problem-1',
                }),
            ],
            problemPool: null,
            ...overrides,
        });

        beforeEach(() => {
            prisma.battleRoundSubmission.findUnique.mockResolvedValue(null);
            prisma.battleRoundSubmission.create.mockResolvedValue({} as any);
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
            prisma.battleParticipant.update.mockResolvedValue({} as any);
            prisma.battle.findUnique.mockResolvedValue(null);
            codeExec.executeCode.mockResolvedValue({
                passed: 2,
                total: 3,
                allPassed: false,
                results: [],
            } as any);
        });

        it('rejects when battle does not exist', async () => {
            await expect(
                service.submitRoyaleRound('missing', 'u1', 'code', 'js'),
            ).rejects.toThrow(NotFoundException);
        });

        it('rejects when battle mode is not BR', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...irBattle(),
                mode: BattleMode.ONE_V_ONE,
            } as any);
            await expect(
                service.submitRoyaleRound('battle-br', 'u1', 'code', 'js'),
            ).rejects.toThrow(/not a Battle Royale/);
        });

        it('rejects when battle is not IN_PROGRESS', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...irBattle(),
                status: BattleStatus.WAITING,
            } as any);
            await expect(
                service.submitRoyaleRound('battle-br', 'u1', 'code', 'js'),
            ).rejects.toThrow(/not in progress/);
        });

        it('rejects when user is not a participant', async () => {
            prisma.battle.findUnique.mockResolvedValue(irBattle() as any);
            await expect(
                service.submitRoyaleRound('battle-br', 'stranger', 'code', 'js'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('rejects when participant is already eliminated', async () => {
            const b = irBattle();
            b.participants[0].isEliminated = true;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            await expect(
                service.submitRoyaleRound('battle-br', 'u1', 'code', 'js'),
            ).rejects.toThrow(/eliminated/);
        });

        it('rejects when there is no IN_PROGRESS round', async () => {
            const b = irBattle();
            b.rounds[0].status = BattleRoundStatus.COMPLETED;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            await expect(
                service.submitRoyaleRound('battle-br', 'u1', 'code', 'js'),
            ).rejects.toThrow(/No round/);
        });

        it('SAME_PROBLEM: rejects mismatched problemId', async () => {
            prisma.battle.findUnique.mockResolvedValue(irBattle() as any);
            await expect(
                service.submitRoyaleRound(
                    'battle-br',
                    'u1',
                    'code',
                    'js',
                    'other-problem',
                ),
            ).rejects.toThrow(/does not match the current round problem/);
        });

        it('SAME_PROBLEM: runs code, creates submission, updates participant, broadcasts standings', async () => {
            prisma.battle.findUnique.mockResolvedValue(irBattle() as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 3,
                total: 3,
                allPassed: true,
                results: [],
            } as any);
            // standings fetch inside getStandings
            prisma.battle.findUnique.mockResolvedValueOnce(irBattle() as any);

            const result = await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'return 1;',
                'javascript',
                'problem-1',
            );

            expect(codeExec.executeCode).toHaveBeenCalledWith(
                'problem-1',
                'return 1;',
                'javascript',
            );
            expect(prisma.battleRoundSubmission.create).toHaveBeenCalled();
            expect(prisma.battleParticipant.update).toHaveBeenCalled();
            expect(gateway.emitRoyaleStandings).toHaveBeenCalled();
            expect(result).toMatchObject({
                testsPassed: 3,
                totalTests: 3,
                allPassed: true,
            });
        });

        it('SCORE_ATTACK: rejects missing problemId', async () => {
            const b = irBattle({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
            });
            b.rounds[0].problemId = null;
            b.problemPool = null;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            await expect(
                service.submitRoyaleRound('battle-br', 'u1', 'code', 'js'),
            ).rejects.toThrow(/problemId is required/);
        });

        it('SCORE_ATTACK with pool: rejects problem outside the pool', async () => {
            const b = irBattle({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
            });
            b.rounds[0].problemId = null;
            b.problemPool = {
                id: 'pp-1',
                battleId: 'battle-br',
                items: [
                    { id: 'i1', problemId: 'p-in', pointValue: 5 },
                ],
            };
            prisma.battle.findUnique.mockResolvedValue(b as any);
            await expect(
                service.submitRoyaleRound(
                    'battle-br',
                    'u1',
                    'code',
                    'js',
                    'p-not-in',
                ),
            ).rejects.toThrow(/part of the SCORE_ATTACK pool/);
        });

        it('SCORE_ATTACK with pool: awards pool pointValue when allPassed', async () => {
            const b = irBattle({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
            });
            b.rounds[0].problemId = null;
            b.problemPool = {
                id: 'pp-1',
                battleId: 'battle-br',
                items: [{ id: 'i1', problemId: 'p-in', pointValue: 10 }],
            };
            prisma.battle.findUnique.mockResolvedValue(b as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 2,
                total: 2,
                allPassed: true,
                results: [],
            } as any);

            const result = await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'return 1;',
                'js',
                'p-in',
            );
            expect(result.pointsAwarded).toBe(10);
        });

        it('SCORE_ATTACK without pool: awards difficulty-based points when allPassed', async () => {
            const b = irBattle({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
            });
            b.rounds[0].problemId = null;
            b.problemPool = null;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            prisma.problem.findUnique.mockResolvedValue({
                id: 'p-free',
                difficulty: Difficulty.HARD,
            } as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 3,
                total: 3,
                allPassed: true,
                results: [],
            } as any);

            const result = await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'code',
                'js',
                'p-free',
            );
            expect(result.pointsAwarded).toBe(10); // HARD = 10
        });

        it('upsert-best: lower-score resubmission does not overwrite existing and does NOT re-award points', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                irBattle({
                    battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                    problemPool: {
                        id: 'pp-1',
                        battleId: 'battle-br',
                        items: [
                            { id: 'i1', problemId: 'problem-1', pointValue: 10 },
                        ],
                    },
                }) as any,
            );
            prisma.battleRoundSubmission.findUnique.mockResolvedValue({
                id: 'sub-1',
                roundId: 'r-1',
                userId: 'u1',
                problemId: 'problem-1',
                pointsEarned: 10,
                testsPassed: 3,
                allPassed: true,
            } as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 1,
                total: 3,
                allPassed: false,
                results: [],
            } as any);

            await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'code-v2',
                'js',
                'problem-1',
            );

            expect(prisma.battleRoundSubmission.update).not.toHaveBeenCalled();
            // Regression: pointsEarned delta must be 0 when no improvement happened.
            const participantUpdate =
                (prisma.battleParticipant.update.mock.calls[0] as any)[0];
            expect(participantUpdate.data.pointsEarned).toEqual({ increment: 0 });
        });

        it('upsert-best: higher-score resubmission updates existing', async () => {
            const b = irBattle();
            prisma.battle.findUnique.mockResolvedValue(b as any);
            prisma.battleRoundSubmission.findUnique.mockResolvedValue({
                id: 'sub-1',
                roundId: 'r-1',
                userId: 'u1',
                problemId: 'problem-1',
                pointsEarned: 0,
                testsPassed: 1,
                allPassed: false,
            } as any);
            prisma.battleRoundSubmission.update.mockResolvedValue({} as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 3,
                total: 3,
                allPassed: true,
                results: [],
            } as any);

            await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'code-v2',
                'js',
                'problem-1',
            );

            expect(prisma.battleRoundSubmission.update).toHaveBeenCalled();
        });

        it('isImprovement allPassed edge: same pointsEarned and same testsPassed but allPassed flips false→true is treated as improvement', async () => {
            // SAME_PROBLEM: pointsEarned is always 0, and code-execution flakiness
            // could initially record allPassed=false with testsPassed=N, then a
            // later submission records allPassed=true with testsPassed=N. The
            // service MUST recognize this as an improvement so evaluateRoundEnd
            // can correctly count all-passers.
            prisma.battle.findUnique.mockResolvedValue(irBattle() as any);
            prisma.battleRoundSubmission.findUnique.mockResolvedValue({
                id: 'sub-1',
                roundId: 'r-1',
                userId: 'u1',
                problemId: 'problem-1',
                pointsEarned: 0,
                testsPassed: 3,
                allPassed: false,
            } as any);
            prisma.battleRoundSubmission.update.mockResolvedValue({} as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 3,
                total: 3,
                allPassed: true,
                results: [],
            } as any);

            await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'code-v2',
                'js',
                'problem-1',
            );

            expect(prisma.battleRoundSubmission.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ allPassed: true }),
                }),
            );
        });

        it('regression: solving the same SCORE_ATTACK problem twice awards points ONCE (participant.pointsEarned delta = 0 on resolve)', async () => {
            // First solve: existing is null → create submission, +10 to participant.
            // Second solve: existing already has pointsEarned=10; same points,
            // same allPassed, same testsPassed → NOT an improvement → delta 0.
            const batt = irBattle({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                problemPool: {
                    id: 'pp-1',
                    battleId: 'battle-br',
                    items: [{ id: 'i1', problemId: 'p-hard', pointValue: 10 }],
                },
            });
            prisma.battle.findUnique.mockResolvedValue(batt as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 3,
                total: 3,
                allPassed: true,
                results: [],
            } as any);
            prisma.battleRoundSubmission.findUnique
                .mockResolvedValueOnce(null) // first submission: no existing row
                .mockResolvedValueOnce({
                    id: 'sub-1',
                    roundId: 'r-1',
                    userId: 'u1',
                    problemId: 'p-hard',
                    pointsEarned: 10,
                    testsPassed: 3,
                    allPassed: true,
                } as any);

            await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'code-v1',
                'js',
                'p-hard',
            );
            await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'code-v2',
                'js',
                'p-hard',
            );

            // Two participant.update calls — first increments by 10, second by 0.
            const calls = prisma.battleParticipant.update.mock.calls;
            expect(calls).toHaveLength(2);
            expect((calls[0] as any)[0].data.pointsEarned).toEqual({
                increment: 10,
            });
            expect((calls[1] as any)[0].data.pointsEarned).toEqual({
                increment: 0,
            });
        });

        it('regression: improving a SCORE_ATTACK submission from partial (0 pts) to full (10 pts) increments by exactly the delta of 10 (not 10 on top of something else)', async () => {
            const batt = irBattle({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                problemPool: {
                    id: 'pp-1',
                    battleId: 'battle-br',
                    items: [{ id: 'i1', problemId: 'p-hard', pointValue: 10 }],
                },
            });
            prisma.battle.findUnique.mockResolvedValue(batt as any);
            prisma.battleRoundSubmission.findUnique.mockResolvedValue({
                id: 'sub-1',
                roundId: 'r-1',
                userId: 'u1',
                problemId: 'p-hard',
                pointsEarned: 0,
                testsPassed: 1,
                allPassed: false,
            } as any);
            prisma.battleRoundSubmission.update.mockResolvedValue({} as any);
            codeExec.executeCode.mockResolvedValue({
                passed: 3,
                total: 3,
                allPassed: true,
                results: [],
            } as any);

            await service.submitRoyaleRound(
                'battle-br',
                'u1',
                'code-v2',
                'js',
                'p-hard',
            );

            const participantUpdate =
                (prisma.battleParticipant.update.mock.calls[0] as any)[0];
            expect(participantUpdate.data.pointsEarned).toEqual({ increment: 10 });
        });
    });

    // ========================================
    // evaluateRoundEnd (SAME_PROBLEM)
    // ========================================

    describe('evaluateRoundEnd - SAME_PROBLEM', () => {
        const baseBattle = () => ({
            id: 'battle-br',
            mode: BattleMode.BATTLE_ROYALE,
            battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
            status: BattleStatus.IN_PROGRESS,
            participants: [
                participant({ userId: 'u1' }),
                participant({ userId: 'u2' }),
                participant({ userId: 'u3' }),
                participant({ userId: 'u4' }),
            ],
            rounds: [
                round({
                    id: 'r-1',
                    roundNumber: 1,
                    status: BattleRoundStatus.IN_PROGRESS,
                    eliminateCount: 1,
                    problemId: 'problem-1',
                }),
            ],
        });

        it('ends the round early when enough distinct users have allPassed', async () => {
            prisma.battle.findUnique.mockResolvedValue(baseBattle() as any);
            // target = 4 - 1 = 3 → need 3 distinct allPassed users
            prisma.battleRoundSubmission.findMany.mockResolvedValueOnce([
                { userId: 'u1' },
                { userId: 'u2' },
                { userId: 'u3' },
            ] as any);
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);

            await service.evaluateRoundEnd('battle-br', 'r-1');

            expect(spy).toHaveBeenCalledWith(
                'battle-br',
                'r-1',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );
        });

        it('does not end the round when target not yet reached', async () => {
            prisma.battle.findUnique.mockResolvedValue(baseBattle() as any);
            prisma.battleRoundSubmission.findMany.mockResolvedValueOnce([
                { userId: 'u1' },
                { userId: 'u2' },
            ] as any);
            const spy = jest.spyOn(service, 'endRoundAndAdvance');
            await service.evaluateRoundEnd('battle-br', 'r-1');
            expect(spy).not.toHaveBeenCalled();
        });

        it('no-op when battle is not IN_PROGRESS', async () => {
            const b: any = baseBattle();
            b.status = BattleStatus.WAITING;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            const spy = jest.spyOn(service, 'endRoundAndAdvance');
            await service.evaluateRoundEnd('battle-br', 'r-1');
            expect(spy).not.toHaveBeenCalled();
        });

        it('no-op for SCORE_ATTACK', async () => {
            const b: any = baseBattle();
            b.battleRoyaleFormat = BattleRoyaleFormat.SCORE_ATTACK;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            const spy = jest.spyOn(service, 'endRoundAndAdvance');
            await service.evaluateRoundEnd('battle-br', 'r-1');
            expect(spy).not.toHaveBeenCalled();
        });

        it('does NOT end early when target === 0 (every remaining player is being eliminated)', async () => {
            // Degenerate: 2 remaining, eliminateCount=2 → target=0.
            // Should never trigger early-end (that path is only meaningful
            // when at least 1 player survives the cut).
            const b: any = baseBattle();
            b.participants = [
                participant({ userId: 'u1' }),
                participant({ userId: 'u2' }),
            ];
            b.rounds[0].eliminateCount = 2;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            prisma.battleRoundSubmission.findMany.mockResolvedValueOnce([
                { userId: 'u1' },
                { userId: 'u2' },
            ] as any);
            const spy = jest.spyOn(service, 'endRoundAndAdvance');
            await service.evaluateRoundEnd('battle-br', 'r-1');
            expect(spy).not.toHaveBeenCalled();
        });

        it('ends early even when ONLY 1 player passes but target === 1 (remaining=2, elim=1)', async () => {
            // 1v1 finale: once one player passes all tests they would survive
            // alone, so the round must end even though only one user passed.
            const b: any = baseBattle();
            b.participants = [
                participant({ userId: 'u1' }),
                participant({ userId: 'u2' }),
            ];
            b.rounds[0].eliminateCount = 1;
            prisma.battle.findUnique.mockResolvedValue(b as any);
            prisma.battleRoundSubmission.findMany.mockResolvedValueOnce([
                { userId: 'u1' },
            ] as any);
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);
            await service.evaluateRoundEnd('battle-br', 'r-1');
            expect(spy).toHaveBeenCalledWith(
                'battle-br',
                'r-1',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );
        });
    });

    // ========================================
    // handleRoundTimer
    // ========================================

    describe('handleRoundTimer', () => {
        const buildBattle = (status: BattleRoundStatus = BattleRoundStatus.IN_PROGRESS) => ({
            id: 'battle-br',
            status: BattleStatus.IN_PROGRESS,
            rounds: [round({ id: 'r-1', roundNumber: 1, status })],
        });

        it('ends the round with TIMER reason when still IN_PROGRESS', async () => {
            prisma.battle.findUnique.mockResolvedValue(buildBattle() as any);
            const spy = jest
                .spyOn(service, 'endRoundAndAdvance')
                .mockResolvedValue(undefined as any);

            await service.handleRoundTimer('battle-br', 1);

            expect(spy).toHaveBeenCalledWith(
                'battle-br',
                'r-1',
                BattleRoundEndReason.TIMER,
            );
        });

        it('is a no-op when the round is already COMPLETED (race-safe)', async () => {
            prisma.battle.findUnique.mockResolvedValue(
                buildBattle(BattleRoundStatus.COMPLETED) as any,
            );
            const spy = jest.spyOn(service, 'endRoundAndAdvance');
            await service.handleRoundTimer('battle-br', 1);
            expect(spy).not.toHaveBeenCalled();
        });

        it('is a no-op when battle is not found', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);
            const spy = jest.spyOn(service, 'endRoundAndAdvance');
            await service.handleRoundTimer('battle-br', 1);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // endRoundAndAdvance + placement
    // ========================================

    describe('endRoundAndAdvance', () => {
        const buildBattle = (overrides: any = {}) => ({
            id: 'battle-br',
            mode: BattleMode.BATTLE_ROYALE,
            battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
            status: BattleStatus.IN_PROGRESS,
            maxPlayers: 4,
            participants: [
                participant({ userId: 'u1' }),
                participant({ userId: 'u2' }),
                participant({ userId: 'u3' }),
                participant({ userId: 'u4' }),
            ],
            rounds: [
                round({
                    id: 'r-1',
                    roundNumber: 1,
                    status: BattleRoundStatus.IN_PROGRESS,
                    eliminateCount: 1,
                    problemId: 'problem-1',
                }),
                round({
                    id: 'r-2',
                    roundNumber: 2,
                    status: BattleRoundStatus.PENDING,
                    eliminateCount: 1,
                }),
                round({
                    id: 'r-3',
                    roundNumber: 3,
                    status: BattleRoundStatus.PENDING,
                    eliminateCount: 1,
                }),
            ],
            ...overrides,
        });

        beforeEach(() => {
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
            prisma.battle.findUnique.mockResolvedValue(buildBattle() as any);
            prisma.battleParticipant.updateMany.mockResolvedValue({
                count: 1,
            } as any);
            // Default: conditional round flip wins the race (count === 1).
            prisma.battleRound.updateMany.mockResolvedValue({ count: 1 } as any);
            prisma.battleRound.update.mockResolvedValue({} as any);
            prisma.battle.update.mockResolvedValue({} as any);
            scheduler.doesExist.mockReturnValue(true);
        });

        it('SAME_PROBLEM: eliminates the non-submitter first (deterministic), emits elimination + round_end, advances', async () => {
            // Only u1, u2, u3 submitted all passed. u4 did not submit → should be eliminated.
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                {
                    userId: 'u1',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: new Date('2024-01-01T10:00:00Z'),
                    pointsEarned: 0,
                },
                {
                    userId: 'u2',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: new Date('2024-01-01T10:00:05Z'),
                    pointsEarned: 0,
                },
                {
                    userId: 'u3',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: new Date('2024-01-01T10:00:10Z'),
                    pointsEarned: 0,
                },
            ] as any);
            // Spy on startRound to avoid recursing
            const startSpy = jest
                .spyOn(service, 'startRound')
                .mockResolvedValue(undefined as any);

            await service.endRoundAndAdvance(
                'battle-br',
                'r-1',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );

            // The non-submitter u4 should have been eliminated with placement = 4
            const updateCalls = prisma.battleParticipant.updateMany.mock.calls;
            expect(updateCalls).toHaveLength(1);
            expect(updateCalls[0][0]).toMatchObject({
                where: expect.objectContaining({ userId: 'u4' }),
                data: expect.objectContaining({
                    isEliminated: true,
                    placement: 4,
                    eliminatedInRound: 1,
                }),
            });
            expect(gateway.emitRoyaleElimination).toHaveBeenCalledWith(
                'battle-br',
                expect.objectContaining({ userId: 'u4', placement: 4 }),
            );
            expect(gateway.emitRoyaleRoundEnd).toHaveBeenCalled();
            expect(startSpy).toHaveBeenCalledWith('battle-br', 2);
            // Round closed via the atomic (conditional) updateMany, not update.
            expect(prisma.battleRound.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'r-1',
                        status: { not: BattleRoundStatus.COMPLETED },
                    }),
                    data: expect.objectContaining({
                        status: BattleRoundStatus.COMPLETED,
                        endedReason: BattleRoundEndReason.EARLY_ALL_PASSED,
                    }),
                }),
            );
        });

        it('clears the scheduled timer for the ended round', async () => {
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
            jest.spyOn(service, 'startRound').mockResolvedValue(undefined as any);

            await service.endRoundAndAdvance(
                'battle-br',
                'r-1',
                BattleRoundEndReason.TIMER,
            );

            expect(scheduler.deleteTimeout).toHaveBeenCalledWith(
                'royale:battle-br:1',
            );
        });

        it('is a no-op when the round is already COMPLETED (outer short-circuit)', async () => {
            const b = buildBattle();
            b.rounds[0].status = BattleRoundStatus.COMPLETED;
            prisma.battle.findUnique.mockResolvedValue(b as any);

            await service.endRoundAndAdvance(
                'battle-br',
                'r-1',
                BattleRoundEndReason.TIMER,
            );

            expect(prisma.battleRound.update).not.toHaveBeenCalled();
            expect(prisma.battleRound.updateMany).not.toHaveBeenCalled();
            expect(prisma.battleParticipant.updateMany).not.toHaveBeenCalled();
            expect(gateway.emitRoyaleElimination).not.toHaveBeenCalled();
            expect(gateway.emitRoyaleRoundEnd).not.toHaveBeenCalled();
        });

        it('race-safety: bails out without emitting events when a concurrent caller already closed the round (conditional updateMany returns count=0)', async () => {
            // Outer `battle.findUnique` says round is IN_PROGRESS (the caller
            // hasn't seen the race yet), but the conditional flip inside the
            // transaction reports count=0 meaning another caller beat us.
            prisma.battleRound.updateMany.mockResolvedValueOnce({
                count: 0,
            } as any);
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                {
                    userId: 'u1',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: new Date(),
                    pointsEarned: 0,
                },
            ] as any);
            const startSpy = jest
                .spyOn(service, 'startRound')
                .mockResolvedValue(undefined as any);
            const finalizeSpy = jest
                .spyOn(service, 'finalizeRoyale')
                .mockResolvedValue(undefined as any);

            await service.endRoundAndAdvance(
                'battle-br',
                'r-1',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );

            // No participant eliminations, no emitted events, no advancement.
            expect(
                prisma.battleParticipant.updateMany,
            ).not.toHaveBeenCalled();
            expect(gateway.emitRoyaleElimination).not.toHaveBeenCalled();
            expect(gateway.emitRoyaleRoundEnd).not.toHaveBeenCalled();
            expect(startSpy).not.toHaveBeenCalled();
            expect(finalizeSpy).not.toHaveBeenCalled();
            expect(scheduler.deleteTimeout).not.toHaveBeenCalled();
        });

        it('finalizes the battle when <=1 player remains after elimination', async () => {
            const b = buildBattle({
                participants: [
                    participant({ userId: 'u1' }),
                    participant({ userId: 'u2' }),
                ],
                rounds: [
                    round({
                        id: 'r-final',
                        roundNumber: 1,
                        status: BattleRoundStatus.IN_PROGRESS,
                        eliminateCount: 1,
                        problemId: 'problem-1',
                    }),
                ],
            });
            prisma.battle.findUnique.mockResolvedValue(b as any);

            const finalizeSpy = jest
                .spyOn(service, 'finalizeRoyale')
                .mockResolvedValue(undefined as any);
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                {
                    userId: 'u1',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: new Date(),
                    pointsEarned: 0,
                },
            ] as any);

            await service.endRoundAndAdvance(
                'battle-br',
                'r-final',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );

            expect(finalizeSpy).toHaveBeenCalledWith('battle-br');
        });

        it('SCORE_ATTACK: eliminates the lowest cumulative points player', async () => {
            const b = buildBattle({
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                participants: [
                    participant({ userId: 'u1' }),
                    participant({ userId: 'u2' }),
                    participant({ userId: 'u3' }),
                ],
                rounds: [
                    round({
                        id: 'r-sa',
                        roundNumber: 1,
                        status: BattleRoundStatus.IN_PROGRESS,
                        eliminateCount: 1,
                    }),
                    round({
                        id: 'r-sa2',
                        roundNumber: 2,
                        status: BattleRoundStatus.PENDING,
                        eliminateCount: 1,
                    }),
                ],
            });
            prisma.battle.findUnique.mockResolvedValue(b as any);
            // Round submissions — u1 has 10, u2 has 7, u3 has 2.
            prisma.battleRoundSubmission.findMany
                .mockResolvedValueOnce([
                    {
                        userId: 'u1',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:00Z'),
                        pointsEarned: 10,
                    },
                    {
                        userId: 'u2',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:05Z'),
                        pointsEarned: 7,
                    },
                    {
                        userId: 'u3',
                        allPassed: true,
                        testsPassed: 1,
                        submittedAt: new Date('2024-01-01T10:00:10Z'),
                        pointsEarned: 2,
                    },
                ] as any)
                // cumulative call in computeCumulativePoints
                .mockResolvedValueOnce([
                    { userId: 'u1', pointsEarned: 10, submittedAt: new Date() },
                    { userId: 'u2', pointsEarned: 7, submittedAt: new Date() },
                    { userId: 'u3', pointsEarned: 2, submittedAt: new Date() },
                ] as any)
                .mockResolvedValue([]); // fallback for subsequent calls (standings)

            jest.spyOn(service, 'startRound').mockResolvedValue(undefined as any);

            await service.endRoundAndAdvance(
                'battle-br',
                'r-sa',
                BattleRoundEndReason.TIMER,
            );

            const updateCalls = prisma.battleParticipant.updateMany.mock.calls;
            expect(updateCalls).toHaveLength(1);
            expect(updateCalls[0][0]).toMatchObject({
                where: expect.objectContaining({ userId: 'u3' }),
                data: expect.objectContaining({ placement: 3 }),
            });
        });

        it('SAME_PROBLEM with ties breaks by submittedAt then userId', async () => {
            const sameTime = new Date('2024-01-01T10:00:00Z');
            // 4 players all passed simultaneously (same time, same testsPassed);
            // eliminate 1 → last by userId (alphabetical) should go.
            prisma.battleRoundSubmission.findMany.mockResolvedValue([
                {
                    userId: 'u1',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: sameTime,
                    pointsEarned: 0,
                },
                {
                    userId: 'u2',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: sameTime,
                    pointsEarned: 0,
                },
                {
                    userId: 'u3',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: sameTime,
                    pointsEarned: 0,
                },
                {
                    userId: 'u4',
                    allPassed: true,
                    testsPassed: 3,
                    submittedAt: sameTime,
                    pointsEarned: 0,
                },
            ] as any);
            jest.spyOn(service, 'startRound').mockResolvedValue(undefined as any);

            await service.endRoundAndAdvance(
                'battle-br',
                'r-1',
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );

            const call = prisma.battleParticipant.updateMany.mock.calls[0][0];
            expect(call.where.userId).toBe('u4');
        });

        // ----------------------------------------------------------------
        // SAME_PROBLEM "v1 Balanced" bucket rules
        //   Bucket A: full solve (allPassed=true)
        //   Bucket B: attempted but not fully solved
        //   Bucket C: no submission
        // Order: A (safest) < B < C (first eliminated).
        // ----------------------------------------------------------------
        describe('SAME_PROBLEM bucket ranking (v1 Balanced)', () => {
            it('eliminates Bucket C (no submission) before Bucket B (attempted but failed)', async () => {
                // u1,u2 full solve (A); u3 attempted but not passing (B);
                // u4 did not submit (C). Eliminate 1 → u4 (bucket C) goes.
                prisma.battleRoundSubmission.findMany.mockResolvedValue([
                    {
                        userId: 'u1',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:00Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u2',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:05Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u3',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:10Z'),
                        pointsEarned: 0,
                    },
                ] as any);
                jest.spyOn(service, 'startRound').mockResolvedValue(
                    undefined as any,
                );

                await service.endRoundAndAdvance(
                    'battle-br',
                    'r-1',
                    BattleRoundEndReason.TIMER,
                );

                const updateCalls =
                    prisma.battleParticipant.updateMany.mock.calls;
                expect(updateCalls).toHaveLength(1);
                expect(updateCalls[0][0]).toMatchObject({
                    where: expect.objectContaining({ userId: 'u4' }),
                    data: expect.objectContaining({ placement: 4 }),
                });
            });

            it('eliminates Bucket B (attempted) before Bucket A (full solve) when the cut dips into B', async () => {
                // 4 players, eliminate 2.
                // u1,u2 full solve (A); u3,u4 attempted but failed (B).
                // Eliminate 2 → u3 and u4 (both from B), u4 worst placement.
                const b = buildBattle({
                    rounds: [
                        round({
                            id: 'r-1',
                            roundNumber: 1,
                            status: BattleRoundStatus.IN_PROGRESS,
                            eliminateCount: 2,
                            problemId: 'problem-1',
                        }),
                        round({
                            id: 'r-2',
                            roundNumber: 2,
                            status: BattleRoundStatus.PENDING,
                            eliminateCount: 1,
                        }),
                    ],
                });
                prisma.battle.findUnique.mockResolvedValue(b as any);
                prisma.battleRoundSubmission.findMany.mockResolvedValue([
                    {
                        userId: 'u1',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:00Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u2',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:05Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u3',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:10Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u4',
                        allPassed: false,
                        testsPassed: 1,
                        submittedAt: new Date('2024-01-01T10:00:15Z'),
                        pointsEarned: 0,
                    },
                ] as any);
                jest.spyOn(service, 'startRound').mockResolvedValue(
                    undefined as any,
                );

                await service.endRoundAndAdvance(
                    'battle-br',
                    'r-1',
                    BattleRoundEndReason.TIMER,
                );

                const updateCalls =
                    prisma.battleParticipant.updateMany.mock.calls;
                expect(updateCalls).toHaveLength(2);
                const eliminated = updateCalls
                    .map((c) => c[0])
                    .sort((a, b) => a.data.placement - b.data.placement);
                // u3 has higher testsPassed than u4 → u3 safer, placement 3.
                expect(eliminated[0]).toMatchObject({
                    where: expect.objectContaining({ userId: 'u3' }),
                    data: expect.objectContaining({ placement: 3 }),
                });
                expect(eliminated[1]).toMatchObject({
                    where: expect.objectContaining({ userId: 'u4' }),
                    data: expect.objectContaining({ placement: 4 }),
                });
            });

            it('within Bucket A, the LATEST full-pass is eliminated when the cut reaches into A', async () => {
                // All 4 full-solved (bucket A); eliminate 1.
                // u1 at t=0, u2 at t=5, u3 at t=10, u4 at t=15 → u4 (latest) eliminated.
                prisma.battleRoundSubmission.findMany.mockResolvedValue([
                    {
                        userId: 'u1',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:00Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u2',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:05Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u3',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:10Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u4',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:15Z'),
                        pointsEarned: 0,
                    },
                ] as any);
                jest.spyOn(service, 'startRound').mockResolvedValue(
                    undefined as any,
                );

                await service.endRoundAndAdvance(
                    'battle-br',
                    'r-1',
                    BattleRoundEndReason.EARLY_ALL_PASSED,
                );

                const call =
                    prisma.battleParticipant.updateMany.mock.calls[0][0];
                expect(call.where.userId).toBe('u4');
                expect(call.data.placement).toBe(4);
            });

            it('within Bucket B, lower testsPassed is eliminated first', async () => {
                // 4 players, eliminate 1. All attempted but none fully solved.
                // u1: 3 tests, u2: 2 tests, u3: 2 tests earlier, u4: 1 test → u4 goes.
                prisma.battleRoundSubmission.findMany.mockResolvedValue([
                    {
                        userId: 'u1',
                        allPassed: false,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:00Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u2',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:10Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u3',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:05Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u4',
                        allPassed: false,
                        testsPassed: 1,
                        submittedAt: new Date('2024-01-01T10:00:20Z'),
                        pointsEarned: 0,
                    },
                ] as any);
                jest.spyOn(service, 'startRound').mockResolvedValue(
                    undefined as any,
                );

                await service.endRoundAndAdvance(
                    'battle-br',
                    'r-1',
                    BattleRoundEndReason.TIMER,
                );

                const call =
                    prisma.battleParticipant.updateMany.mock.calls[0][0];
                expect(call.where.userId).toBe('u4');
            });

            it('within Bucket B with equal testsPassed, the LATER submitter is eliminated', async () => {
                // 4 players, eliminate 1. All attempted with same testsPassed;
                // tie-break by earlier submittedAt wins.
                prisma.battleRoundSubmission.findMany.mockResolvedValue([
                    {
                        userId: 'u1',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:00Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u2',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:05Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u3',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:10Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u4',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:15Z'),
                        pointsEarned: 0,
                    },
                ] as any);
                jest.spyOn(service, 'startRound').mockResolvedValue(
                    undefined as any,
                );

                await service.endRoundAndAdvance(
                    'battle-br',
                    'r-1',
                    BattleRoundEndReason.TIMER,
                );

                const call =
                    prisma.battleParticipant.updateMany.mock.calls[0][0];
                expect(call.where.userId).toBe('u4');
            });

            it('within Bucket C (all non-submitters), eliminates the alphabetically-last userId first', async () => {
                // Nobody submitted; all 4 are bucket C. Eliminate 1.
                prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
                jest.spyOn(service, 'startRound').mockResolvedValue(
                    undefined as any,
                );

                await service.endRoundAndAdvance(
                    'battle-br',
                    'r-1',
                    BattleRoundEndReason.TIMER,
                );

                const call =
                    prisma.battleParticipant.updateMany.mock.calls[0][0];
                expect(call.where.userId).toBe('u4');
            });

            it('strict bucket ordering: a LATE full-solve (A) beats an EARLY partial (B) even with fewer tests shown', async () => {
                // u1: partial submission very early, many tests passed.
                // u4: full solve, but late.
                // Bucket A (u4) must still be safer than bucket B (u1).
                // Eliminate 1 → must pick from B or C, not u4.
                prisma.battleRoundSubmission.findMany.mockResolvedValue([
                    {
                        userId: 'u1',
                        allPassed: false,
                        testsPassed: 2,
                        submittedAt: new Date('2024-01-01T10:00:00Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u2',
                        allPassed: false,
                        testsPassed: 1,
                        submittedAt: new Date('2024-01-01T10:00:05Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u3',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:02Z'),
                        pointsEarned: 0,
                    },
                    {
                        userId: 'u4',
                        allPassed: true,
                        testsPassed: 3,
                        submittedAt: new Date('2024-01-01T10:00:30Z'),
                        pointsEarned: 0,
                    },
                ] as any);
                jest.spyOn(service, 'startRound').mockResolvedValue(
                    undefined as any,
                );

                await service.endRoundAndAdvance(
                    'battle-br',
                    'r-1',
                    BattleRoundEndReason.TIMER,
                );

                const call =
                    prisma.battleParticipant.updateMany.mock.calls[0][0];
                // Bucket B: u1 (2 tests) safer than u2 (1 test) → u2 eliminated.
                expect(call.where.userId).toBe('u2');
            });
        });
    });

    // ========================================
    // finalizeRoyale
    // ========================================

    describe('finalizeRoyale', () => {
        it('marks winner with placement=1, flips battle to COMPLETED, applies MMR, emits completed', async () => {
            const battleState = {
                id: 'battle-br',
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        ...participant({ userId: 'u1' }),
                        isEliminated: false,
                        placement: null,
                    },
                    {
                        ...participant({ userId: 'u2' }),
                        isEliminated: true,
                        placement: 2,
                    },
                ],
            };
            prisma.battle.findUnique
                .mockResolvedValueOnce(battleState as any) // first call in finalize
                .mockResolvedValue({
                    ...battleState,
                    status: BattleStatus.COMPLETED,
                    rounds: [],
                    problem: null,
                    problemPool: null,
                } as any);

            const mmrSpy = jest
                .spyOn(service, 'applyRoyaleMmr')
                .mockResolvedValue(undefined as any);

            await service.finalizeRoyale('battle-br');

            expect(prisma.battleParticipant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        placement: 1,
                        isEliminated: false,
                    }),
                }),
            );
            expect(prisma.battle.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: BattleStatus.COMPLETED,
                        winnerId: 'u1',
                    }),
                }),
            );
            expect(mmrSpy).toHaveBeenCalledWith('battle-br');
            expect(gateway.emitBattleCompleted).toHaveBeenCalledWith(
                'battle-br',
                expect.any(Object),
            );
        });

        it('no-op when battle already COMPLETED', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-br',
                status: BattleStatus.COMPLETED,
                participants: [],
            } as any);

            await service.finalizeRoyale('battle-br');
            expect(prisma.battleParticipant.update).not.toHaveBeenCalled();
        });
    });

    // ========================================
    // applyRoyaleMmr (pair-wise Elo)
    // ========================================

    describe('applyRoyaleMmr (pair-wise Elo)', () => {
        const makeParticipantForMmr = (
            userId: string,
            placement: number,
            mmr: number,
            tier: 'PRO' | 'FREE' = 'PRO',
        ) => ({
            id: `p-${userId}`,
            userId,
            placement,
            isEliminated: placement !== 1,
            user: {
                id: userId,
                mmr,
                subscriptionTier: tier,
                trialEndsAt: null,
            },
        });

        it('3p: hand-computed deltas (all equal MMR)', async () => {
            // With equal MMR, Ea = 0.5 for every pair → each pair contributes
            // K*(Sa - 0.5) = ±8. Player at placement 1 beats the other 2 → +16.
            // Player at placement 2 beats placement-3 only → 0 (wins one, loses one).
            // Player at placement 3 → -16.
            const participants = [
                makeParticipantForMmr('u1', 1, 1000),
                makeParticipantForMmr('u2', 2, 1000),
                makeParticipantForMmr('u3', 3, 1000),
            ];
            prisma.battle.findUnique.mockResolvedValue({
                participants,
            } as any);

            await service.applyRoyaleMmr('battle-br');

            const updates = prisma.battleParticipant.update.mock.calls
                .map((c: any) => c[0])
                .filter((arg: any) => arg?.data?.mmrChange !== undefined);
            const byUser = (uid: string) =>
                updates.find((u: any) => u.where.id === `p-${uid}`)?.data.mmrChange;
            expect(byUser('u1')).toBe(16);
            expect(byUser('u2')).toBe(0);
            expect(byUser('u3')).toBe(-16);
        });

        it('MMR floor clamps at 0 when very-low-MMR user loses heavily', async () => {
            // u2 has a very low MMR AND is upset by an even lower-rated u1,
            // causing a ~-8 delta that would push u2 below zero without the
            // floor clamp.
            const participants = [
                makeParticipantForMmr('u1', 1, 1),
                makeParticipantForMmr('u2', 2, 5), // very low, upset loser
            ];
            prisma.battle.findUnique.mockResolvedValue({
                participants,
            } as any);

            await service.applyRoyaleMmr('battle-br');

            // u2 should have mmr=0 (floor), not negative.
            const u2Update = prisma.user.update.mock.calls.find(
                (c: any) => c[0].where.id === 'u2',
            );
            expect(u2Update).toBeDefined();
            expect((u2Update as any)[0].data.mmr).toBe(0);
        });

        it('FREE tier users get no delta applied to their MMR', async () => {
            const participants = [
                makeParticipantForMmr('u1', 1, 1000, 'FREE'),
                makeParticipantForMmr('u2', 2, 1000, 'FREE'),
            ];
            prisma.battle.findUnique.mockResolvedValue({
                participants,
            } as any);

            await service.applyRoyaleMmr('battle-br');

            // No user.update calls for FREE users
            expect(prisma.user.update).not.toHaveBeenCalled();
            // But the participant row still records mmrChange=0
            const updates = prisma.battleParticipant.update.mock.calls.map(
                (c: any) => c[0].data.mmrChange,
            );
            expect(updates).toEqual([0, 0]);
        });

        it('winner gets wins++ and losers get losses++', async () => {
            const participants = [
                makeParticipantForMmr('u1', 1, 1000),
                makeParticipantForMmr('u2', 2, 1000),
                makeParticipantForMmr('u3', 3, 1000),
            ];
            prisma.battle.findUnique.mockResolvedValue({
                participants,
            } as any);

            await service.applyRoyaleMmr('battle-br');

            const u1 = prisma.user.update.mock.calls.find(
                (c: any) => c[0].where.id === 'u1',
            );
            const u2 = prisma.user.update.mock.calls.find(
                (c: any) => c[0].where.id === 'u2',
            );
            expect((u1 as any)[0].data.wins).toEqual({ increment: 1 });
            expect((u2 as any)[0].data.losses).toEqual({ increment: 1 });
        });

        it('updates season peak MMR and wins/losses for PRO users', async () => {
            const participants = [
                makeParticipantForMmr('u1', 1, 1000),
                makeParticipantForMmr('u2', 2, 1000),
            ];
            prisma.battle.findUnique.mockResolvedValue({
                participants,
            } as any);

            await service.applyRoyaleMmr('battle-br');

            expect(seasons.updatePeakMmr).toHaveBeenCalledTimes(2);
            expect(seasons.incrementSeasonStats).toHaveBeenCalledTimes(2);
        });
    });

    // ========================================
    // getStandings
    // ========================================

    describe('getStandings', () => {
        it('orders by placement asc NULLS LAST, then cumulative points desc', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-br',
                participants: [
                    {
                        ...participant({ userId: 'u1' }),
                        isEliminated: true,
                        placement: 4,
                    },
                    {
                        ...participant({ userId: 'u2' }),
                        isEliminated: false,
                        placement: 1,
                    },
                    {
                        ...participant({ userId: 'u3' }),
                        isEliminated: false,
                        placement: null,
                    },
                ],
                rounds: [],
            } as any);

            // No cumulative submissions
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);

            const standings = await service.getStandings('battle-br');
            expect(standings.map((s) => s.userId)).toEqual(['u2', 'u3', 'u1']);
        });

        it('throws NotFound when battle is missing', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);
            await expect(service.getStandings('missing')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ========================================
    // listRounds / getRoundDetails
    // ========================================

    describe('listRounds / getRoundDetails', () => {
        it('listRounds returns rounds in ascending order', async () => {
            prisma.battle.findUnique.mockResolvedValue({ id: 'battle-br' } as any);
            prisma.battleRound.findMany.mockResolvedValue([
                round({ roundNumber: 1 }),
                round({ roundNumber: 2 }),
            ] as any);
            const out = await service.listRounds('battle-br');
            expect(out).toHaveLength(2);
        });

        it('listRounds throws NotFound when battle missing', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);
            await expect(service.listRounds('missing')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('getRoundDetails returns the round + submissions for a participant', async () => {
            prisma.battleParticipant.findUnique.mockResolvedValue({
                id: 'p-u1',
            } as any);
            prisma.battleRound.findUnique.mockResolvedValue({
                id: 'r-1',
                roundNumber: 1,
                submissions: [],
            } as any);
            const out = await service.getRoundDetails('battle-br', 1, 'u1');
            expect(out).toMatchObject({ id: 'r-1', roundNumber: 1 });
            expect(prisma.battleParticipant.findUnique).toHaveBeenCalledWith({
                where: {
                    battleId_userId: { battleId: 'battle-br', userId: 'u1' },
                },
                select: { id: true },
            });
        });

        it('getRoundDetails throws Forbidden for non-participants (protects code from leaking)', async () => {
            prisma.battleParticipant.findUnique.mockResolvedValue(null);
            await expect(
                service.getRoundDetails('battle-br', 1, 'stranger'),
            ).rejects.toThrow(ForbiddenException);
            // Must short-circuit before loading the round.
            expect(prisma.battleRound.findUnique).not.toHaveBeenCalled();
        });

        it('getRoundDetails throws NotFound when the round is missing', async () => {
            prisma.battleParticipant.findUnique.mockResolvedValue({
                id: 'p-u1',
            } as any);
            prisma.battleRound.findUnique.mockResolvedValue(null);
            await expect(
                service.getRoundDetails('battle-br', 99, 'u1'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ========================================
    // Scheduler safety
    // ========================================

    describe('scheduler safety', () => {
        it('clearRoundTimer is safe when the timer does not exist', async () => {
            scheduler.doesExist.mockReturnValue(false);
            // Indirectly trigger clearRoundTimer via endRoundAndAdvance
            prisma.battle.findUnique.mockResolvedValue({
                id: 'battle-br',
                mode: BattleMode.BATTLE_ROYALE,
                battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
                status: BattleStatus.IN_PROGRESS,
                maxPlayers: 2,
                participants: [
                    participant({ userId: 'u1' }),
                    participant({ userId: 'u2' }),
                ],
                rounds: [
                    round({
                        id: 'r-1',
                        roundNumber: 1,
                        status: BattleRoundStatus.IN_PROGRESS,
                        eliminateCount: 1,
                    }),
                ],
            } as any);
            prisma.battleRoundSubmission.findMany.mockResolvedValue([]);
            prisma.battleRound.updateMany.mockResolvedValue({ count: 1 } as any);
            prisma.battleParticipant.updateMany.mockResolvedValue({
                count: 1,
            } as any);
            jest.spyOn(service, 'finalizeRoyale').mockResolvedValue(
                undefined as any,
            );

            await service.endRoundAndAdvance(
                'battle-br',
                'r-1',
                BattleRoundEndReason.TIMER,
            );

            // Should not have attempted to delete (doesExist=false)
            expect(scheduler.deleteTimeout).not.toHaveBeenCalled();
        });
    });
});
