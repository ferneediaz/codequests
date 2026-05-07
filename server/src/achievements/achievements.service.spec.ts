import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from './achievements.service';
import { PrismaService } from '../prisma/prisma.service';
import {
    ACHIEVEMENT_EVENTS_PORT,
    AchievementEventsPort,
} from '../realtime/ports/achievement-events.port';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import { ACHIEVEMENT_DEFINITIONS } from './achievement-definitions';

describe('AchievementsService', () => {
    let service: AchievementsService;
    let prisma: MockPrismaService;
    let events: jest.Mocked<AchievementEventsPort>;

    /**
     * Builds a battle context shaped like what BattlesService passes in.
     * Defaults represent a clean 1v1 win on a small test suite.
     */
    const buildBattleCtx = (
        overrides: Partial<{
            mode: string;
            isWinner: boolean;
            userMmr: number;
            userWins: number;
            userLosses: number;
            preBattleMmr: number;
            language: string | null;
            testsPassed: number;
            totalTests: number;
            elapsedSeconds: number;
            opponent: {
                preBattleMmr: number;
                testsPassed: number;
                totalTests: number;
            } | null;
        }> = {},
    ) => {
        const startedAt = new Date('2026-05-07T10:00:00Z');
        const elapsed = overrides.elapsedSeconds ?? 180;
        const submittedAt = new Date(startedAt.getTime() + elapsed * 1000);
        return {
            userId: 'user-1',
            user: {
                wins: overrides.userWins ?? 1,
                losses: overrides.userLosses ?? 0,
                mmr: overrides.userMmr ?? 1010,
            },
            battle: {
                id: 'battle-1',
                mode: overrides.mode ?? 'ONE_V_ONE',
                isWinner: overrides.isWinner ?? true,
                preBattleMmr: overrides.preBattleMmr ?? 1000,
                participant: {
                    language:
                        overrides.language === undefined
                            ? 'python'
                            : overrides.language,
                    testsPassed: overrides.testsPassed ?? 5,
                    totalTests: overrides.totalTests ?? 10,
                    submittedAt,
                },
                opponent:
                    overrides.opponent === undefined
                        ? {
                              preBattleMmr: 1000,
                              testsPassed: 3,
                              totalTests: 10,
                          }
                        : overrides.opponent,
                startedAt,
                endedAt: new Date(submittedAt.getTime() + 1000),
            },
        };
    };

    beforeEach(async () => {
        prisma = createMockPrismaService() as MockPrismaService;
        // Default: nothing already unlocked.
        prisma.userAchievement.findMany.mockResolvedValue([]);
        prisma.userAchievement.createMany.mockResolvedValue({ count: 0 });
        // Helpers default to "no extra wins anywhere" so non-relevant
        // checkers don't accidentally unlock.
        prisma.battleParticipant.count.mockResolvedValue(0);
        prisma.battleParticipant.findMany.mockResolvedValue([]);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AchievementsService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: ACHIEVEMENT_EVENTS_PORT,
                    useValue: {
                        emitAchievementUnlocked: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AchievementsService>(AchievementsService);
        events = module.get(ACHIEVEMENT_EVENTS_PORT);
    });

    describe('seedDefinitions', () => {
        it('upserts every definition with id-matching where + full create + full update payloads', async () => {
            prisma.achievement.upsert.mockResolvedValue({});

            await service.seedDefinitions();

            expect(prisma.achievement.upsert).toHaveBeenCalledTimes(
                ACHIEVEMENT_DEFINITIONS.length,
            );

            // Per-definition exact-shape assertion — catches partial misses
            // (skipped definitions), drift between `create` and `update`
            // payloads, and any field accidentally dropped from `update`
            // (which would silently leave stale catalog rows in prod).
            for (const def of ACHIEVEMENT_DEFINITIONS) {
                expect(prisma.achievement.upsert).toHaveBeenCalledWith({
                    where: { id: def.id },
                    create: {
                        id: def.id,
                        title: def.title,
                        description: def.description,
                        icon: def.icon,
                        category: def.category,
                        tier: def.tier,
                        sortOrder: def.sortOrder,
                    },
                    update: {
                        title: def.title,
                        description: def.description,
                        icon: def.icon,
                        category: def.category,
                        tier: def.tier,
                        sortOrder: def.sortOrder,
                    },
                });
            }
        });

        it('propagates upsert failures (so missing tables / DB outages fail boot loudly)', async () => {
            // Regression guard against a "lazy fix" that wraps seedDefinitions
            // in try/catch — schema drift (e.g. Achievement table missing)
            // must crash boot, not silently degrade the catalog.
            const dbError = new Error(
                'P2021: The table `public.Achievement` does not exist',
            );
            prisma.achievement.upsert.mockRejectedValue(dbError);

            await expect(service.seedDefinitions()).rejects.toBe(dbError);
        });

        it('onModuleInit awaits seedDefinitions and surfaces its failure', async () => {
            // Guard the boot path itself: forgetting `await` or swallowing
            // the error in onModuleInit would re-introduce the silent-failure
            // mode this test suite is here to prevent.
            const dbError = new Error(
                'P2021: The table `public.Achievement` does not exist',
            );
            prisma.achievement.upsert.mockRejectedValue(dbError);

            await expect(service.onModuleInit()).rejects.toBe(dbError);
        });
    });

    describe('listForUser', () => {
        it('merges definitions with unlocks and sorts by sortOrder', async () => {
            const unlockedAt = new Date('2026-05-01T12:00:00Z');
            prisma.userAchievement.findMany.mockResolvedValue([
                { achievementId: 'first_blood', unlockedAt },
            ]);

            const result = await service.listForUser('user-1');

            expect(result.length).toBe(ACHIEVEMENT_DEFINITIONS.length);
            // sortOrder is monotonically non-decreasing in the result
            for (let i = 1; i < result.length; i++) {
                expect(result[i].sortOrder).toBeGreaterThanOrEqual(
                    result[i - 1].sortOrder,
                );
            }
            const firstBlood = result.find((a) => a.id === 'first_blood')!;
            expect(firstBlood.unlocked).toBe(true);
            expect(firstBlood.unlockedAt).toBe(unlockedAt.toISOString());
            const speedDemon = result.find((a) => a.id === 'speed_demon')!;
            expect(speedDemon.unlocked).toBe(false);
            expect(speedDemon.unlockedAt).toBeNull();
        });
    });

    describe('runChecks — First Blood', () => {
        it('unlocks first_blood when wins becomes 1 on a winning battle', async () => {
            const ctx = buildBattleCtx({ userWins: 1, isWinner: true });
            const result = await service.runChecks(ctx);
            expect(result).toContain('first_blood');
            expect(prisma.userAchievement.createMany).toHaveBeenCalled();
        });

        it('does NOT unlock first_blood when the user lost', async () => {
            const ctx = buildBattleCtx({ userWins: 0, isWinner: false });
            const result = await service.runChecks(ctx);
            expect(result).not.toContain('first_blood');
        });

        it('does NOT unlock first_blood on the user\'s second win', async () => {
            const ctx = buildBattleCtx({ userWins: 2, isWinner: true });
            const result = await service.runChecks(ctx);
            expect(result).not.toContain('first_blood');
        });
    });

    describe('runChecks — Streak achievements', () => {
        const mockOutcomes = (outcomes: ('W' | 'L' | 'D')[]) => {
            // recentOutcomes is built from battleParticipant.findMany — return
            // rows shaped for a 1v1 with winnerId set/unset to produce the
            // requested outcome.
            prisma.battleParticipant.findMany.mockImplementation(
                ({ orderBy }: any) => {
                    if (orderBy?.battle?.endedAt) {
                        return Promise.resolve(
                            outcomes.map((o) => ({
                                teamId: null,
                                battle: {
                                    mode: 'ONE_V_ONE',
                                    winnerId:
                                        o === 'W'
                                            ? 'user-1'
                                            : o === 'L'
                                              ? 'someone-else'
                                              : null,
                                    winningTeam: null,
                                },
                            })),
                        );
                    }
                    return Promise.resolve([]);
                },
            );
        };

        it('on_fire fires at exactly 5 consecutive wins', async () => {
            mockOutcomes(['W', 'W', 'W', 'W', 'W', 'L']);
            const ctx = buildBattleCtx({ userWins: 5, isWinner: true });
            const result = await service.runChecks(ctx);
            expect(result).toContain('on_fire');
            expect(result).not.toContain('unstoppable');
        });

        it('on_fire does NOT fire at 4 consecutive wins', async () => {
            mockOutcomes(['W', 'W', 'W', 'W', 'L']);
            const ctx = buildBattleCtx({ userWins: 4, isWinner: true });
            const result = await service.runChecks(ctx);
            expect(result).not.toContain('on_fire');
        });

        it('unstoppable fires when on_fire also fires (10+ streak)', async () => {
            mockOutcomes(Array(10).fill('W'));
            const ctx = buildBattleCtx({ userWins: 10, isWinner: true });
            const result = await service.runChecks(ctx);
            expect(result).toContain('on_fire');
            expect(result).toContain('unstoppable');
            expect(result).not.toContain('legendary');
        });

        it('legendary fires at 25-win streak', async () => {
            mockOutcomes(Array(25).fill('W'));
            const ctx = buildBattleCtx({ userWins: 25, isWinner: true });
            const result = await service.runChecks(ctx);
            expect(result).toContain('legendary');
        });

        it('a loss never unlocks any streak achievement', async () => {
            mockOutcomes(['L', 'W', 'W', 'W', 'W', 'W']);
            const ctx = buildBattleCtx({ userWins: 5, isWinner: false });
            const result = await service.runChecks(ctx);
            expect(result).not.toContain('on_fire');
            expect(result).not.toContain('unstoppable');
            expect(result).not.toContain('legendary');
        });
    });

    describe('runChecks — Speed achievements', () => {
        it('speed_demon fires at 119s, NOT at 120s', async () => {
            const fast = await service.runChecks(
                buildBattleCtx({ elapsedSeconds: 119 }),
            );
            expect(fast).toContain('speed_demon');

            // Fresh prisma state for the boundary case
            prisma.userAchievement.findMany.mockResolvedValue([]);
            const slow = await service.runChecks(
                buildBattleCtx({ elapsedSeconds: 120 }),
            );
            expect(slow).not.toContain('speed_demon');
        });

        it('flash fires at 59s, NOT at 60s', async () => {
            const fast = await service.runChecks(
                buildBattleCtx({ elapsedSeconds: 59 }),
            );
            expect(fast).toContain('flash');

            prisma.userAchievement.findMany.mockResolvedValue([]);
            const slow = await service.runChecks(
                buildBattleCtx({ elapsedSeconds: 60 }),
            );
            expect(slow).not.toContain('flash');
        });
    });

    describe('runChecks — Quality achievements', () => {
        it('perfectionist fires only at 100% tests passed', async () => {
            const perfect = await service.runChecks(
                buildBattleCtx({ testsPassed: 10, totalTests: 10 }),
            );
            expect(perfect).toContain('perfectionist');

            prisma.userAchievement.findMany.mockResolvedValue([]);
            const partial = await service.runChecks(
                buildBattleCtx({ testsPassed: 9, totalTests: 10 }),
            );
            expect(partial).not.toContain('perfectionist');
        });

        it('flawless requires 10 perfect wins (only fires when this win is also perfect)', async () => {
            // 10 prior perfect wins, this one also perfect → flawless
            prisma.battleParticipant.findMany.mockResolvedValue(
                Array(10).fill({ testsPassed: 10, totalTests: 10 }),
            );
            const result = await service.runChecks(
                buildBattleCtx({ testsPassed: 10, totalTests: 10 }),
            );
            expect(result).toContain('flawless');
        });

        it('flawless does NOT fire on a non-perfect win even with 10 historical perfects', async () => {
            prisma.battleParticipant.findMany.mockResolvedValue(
                Array(10).fill({ testsPassed: 10, totalTests: 10 }),
            );
            const result = await service.runChecks(
                buildBattleCtx({ testsPassed: 9, totalTests: 10 }),
            );
            expect(result).not.toContain('flawless');
        });
    });

    describe('runChecks — Language achievements', () => {
        it('pythonista fires at 10 Python wins, on a Python win', async () => {
            prisma.battleParticipant.count.mockResolvedValue(10);
            const result = await service.runChecks(
                buildBattleCtx({ language: 'python' }),
            );
            expect(result).toContain('pythonista');
        });

        it('pythonista does NOT fire when this win was JavaScript (even with 10 Python wins)', async () => {
            prisma.battleParticipant.count.mockResolvedValue(10);
            const result = await service.runChecks(
                buildBattleCtx({ language: 'javascript' }),
            );
            expect(result).not.toContain('pythonista');
        });

        it('pythonista does NOT fire at the 9th Python win', async () => {
            prisma.battleParticipant.count.mockResolvedValue(9);
            const result = await service.runChecks(
                buildBattleCtx({ language: 'python' }),
            );
            expect(result).not.toContain('pythonista');
        });

        it('polyglot fires at 3 distinct winning languages', async () => {
            prisma.battleParticipant.findMany.mockResolvedValue([
                { language: 'python' },
                { language: 'javascript' },
                { language: 'go' },
            ]);
            const result = await service.runChecks(buildBattleCtx());
            expect(result).toContain('polyglot');
        });

        it('polyglot does NOT fire at 2 distinct winning languages', async () => {
            prisma.battleParticipant.findMany.mockResolvedValue([
                { language: 'python' },
                { language: 'javascript' },
            ]);
            const result = await service.runChecks(buildBattleCtx());
            expect(result).not.toContain('polyglot');
        });
    });

    describe('runChecks — Underdog & No Mercy', () => {
        it('underdog fires only when opponent had higher pre-battle MMR', async () => {
            const ctx = buildBattleCtx({
                preBattleMmr: 1000,
                opponent: { preBattleMmr: 1200, testsPassed: 5, totalTests: 10 },
            });
            const result = await service.runChecks(ctx);
            expect(result).toContain('underdog');
        });

        it('underdog does NOT fire when MMRs are equal or user was higher', async () => {
            const result = await service.runChecks(
                buildBattleCtx({
                    preBattleMmr: 1200,
                    opponent: {
                        preBattleMmr: 1000,
                        testsPassed: 5,
                        totalTests: 10,
                    },
                }),
            );
            expect(result).not.toContain('underdog');
        });

        it('no_mercy fires when opponent had 0 tests passed', async () => {
            const result = await service.runChecks(
                buildBattleCtx({
                    opponent: {
                        preBattleMmr: 1000,
                        testsPassed: 0,
                        totalTests: 10,
                    },
                }),
            );
            expect(result).toContain('no_mercy');
        });

        it('no_mercy does NOT fire in non-1v1 modes', async () => {
            const result = await service.runChecks(
                buildBattleCtx({
                    mode: 'BATTLE_ROYALE',
                    opponent: null,
                }),
            );
            expect(result).not.toContain('no_mercy');
        });
    });

    describe('runChecks — Mode achievements', () => {
        it('royale_survivor fires on a Battle Royale win', async () => {
            const result = await service.runChecks(
                buildBattleCtx({ mode: 'BATTLE_ROYALE', opponent: null }),
            );
            expect(result).toContain('royale_survivor');
        });

        it('clan_champion needs 10 Clan Wars wins on a clan-mode win', async () => {
            // countClanWarsWins is fed from the CLAN_WARS findMany branch.
            // Return 10 winning clan-war participations.
            prisma.battleParticipant.findMany.mockResolvedValue(
                Array(10).fill({
                    teamId: 'team-1',
                    battle: { winningTeam: 'team-1' },
                }),
            );
            const result = await service.runChecks(
                buildBattleCtx({
                    mode: 'CLAN_WARS',
                    language: null,
                    opponent: null,
                }),
            );
            expect(result).toContain('clan_champion');
        });
    });

    describe('runChecks — MMR achievements', () => {
        it('top_1000 fires at 2000 MMR', async () => {
            const result = await service.runChecks(
                buildBattleCtx({ userMmr: 2000 }),
            );
            expect(result).toContain('top_1000');
        });

        it('mythic fires at 2500 MMR', async () => {
            const result = await service.runChecks(
                buildBattleCtx({ userMmr: 2500 }),
            );
            expect(result).toContain('top_1000');
            expect(result).toContain('mythic');
        });

        it('top_1000 does NOT fire below 2000 MMR', async () => {
            const result = await service.runChecks(
                buildBattleCtx({ userMmr: 1999 }),
            );
            expect(result).not.toContain('top_1000');
        });
    });

    describe('runChecks — idempotency', () => {
        it('does not re-emit events for already-unlocked achievements', async () => {
            prisma.userAchievement.findMany.mockResolvedValue([
                { achievementId: 'first_blood', unlockedAt: new Date() },
            ]);
            const result = await service.runChecks(
                buildBattleCtx({ userWins: 1 }),
            );
            expect(result).not.toContain('first_blood');
            // The events port should NOT be called for first_blood.
            const calls = (
                events.emitAchievementUnlocked as jest.Mock
            ).mock.calls;
            expect(
                calls.every(
                    ([, payload]: any) => payload.achievementId !== 'first_blood',
                ),
            ).toBe(true);
        });

        it('returns empty when every achievement is already unlocked', async () => {
            prisma.userAchievement.findMany.mockResolvedValue(
                ACHIEVEMENT_DEFINITIONS.map((d) => ({
                    achievementId: d.id,
                    unlockedAt: new Date(),
                })),
            );
            const result = await service.runChecks(buildBattleCtx());
            expect(result).toEqual([]);
            expect(prisma.userAchievement.createMany).not.toHaveBeenCalled();
            expect(events.emitAchievementUnlocked).not.toHaveBeenCalled();
        });
    });

    describe('runChecks — events', () => {
        it('emits one achievement.unlocked event per newly unlocked slug', async () => {
            const result = await service.runChecks(
                buildBattleCtx({ userWins: 1, elapsedSeconds: 50 }),
            );
            expect(result).toContain('first_blood');
            expect(result).toContain('speed_demon');
            expect(result).toContain('flash');

            const calls = (
                events.emitAchievementUnlocked as jest.Mock
            ).mock.calls;
            expect(calls.length).toBe(result.length);
            const ids = calls.map(([, payload]: any) => payload.achievementId);
            expect(new Set(ids)).toEqual(new Set(result));
        });

        it('passes correct payload fields to the events port', async () => {
            await service.runChecks(buildBattleCtx({ userWins: 1 }));
            const callForFirstBlood = (
                events.emitAchievementUnlocked as jest.Mock
            ).mock.calls.find(
                ([, p]: any) => p.achievementId === 'first_blood',
            );
            expect(callForFirstBlood).toBeDefined();
            const [userId, payload] = callForFirstBlood!;
            expect(userId).toBe('user-1');
            expect(payload.title).toBe('First Blood');
            expect(payload.icon).toBe('Swords');
            expect(payload.tier).toBe('bronze');
            expect(payload.unlockedAt).toBeInstanceOf(Date);
        });

        it('includes battleId on the payload when ctx has a battle', async () => {
            await service.runChecks(buildBattleCtx({ userWins: 1 }));
            const calls = (
                events.emitAchievementUnlocked as jest.Mock
            ).mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            for (const [, payload] of calls) {
                expect(payload.battleId).toBe('battle-1');
            }
        });

        it('omits battleId when ctx has no battle (e.g. season-top runs)', async () => {
            prisma.user.findUnique.mockResolvedValue({
                wins: 50,
                losses: 50,
                mmr: 1500,
            });
            await service.runChecksForSeasonTop({
                userId: 'user-1',
                seasonId: 'season-1',
                placement: 42,
            });
            const calls = (
                events.emitAchievementUnlocked as jest.Mock
            ).mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            for (const [, payload] of calls) {
                expect(payload.battleId).toBeUndefined();
            }
        });
    });

    describe('runChecksForSeasonTop', () => {
        it('unlocks seasonal_glory for a top-100 finish', async () => {
            prisma.user.findUnique.mockResolvedValue({
                wins: 50,
                losses: 50,
                mmr: 1500,
            });
            const result = await service.runChecksForSeasonTop({
                userId: 'user-1',
                seasonId: 'season-1',
                placement: 42,
            });
            expect(result).toContain('seasonal_glory');
        });

        it('does NOT unlock seasonal_glory for placement 101+', async () => {
            prisma.user.findUnique.mockResolvedValue({
                wins: 50,
                losses: 50,
                mmr: 1500,
            });
            const result = await service.runChecksForSeasonTop({
                userId: 'user-1',
                seasonId: 'season-1',
                placement: 101,
            });
            expect(result).not.toContain('seasonal_glory');
        });
    });
});
