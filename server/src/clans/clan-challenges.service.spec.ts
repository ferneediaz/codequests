import { Test, TestingModule } from '@nestjs/testing';
import { ClanChallengeService } from './clan-challenges.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClanWarsService } from '../battles/clan-wars.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { BattleMode, ClanChallengeStatus, ClanWarsFormat } from '@prisma/client';

describe('ClanChallengeService', () => {
    let service: ClanChallengeService;
    let prisma: MockPrismaService;
    let clanWars: { createClanWarsBattle: jest.Mock };

    const mockUser1 = {
        id: 'user-1',
        clanId: 'clan-1',
    };

    const mockUser2 = {
        id: 'user-2',
        clanId: 'clan-2',
    };

    const mockClan1 = {
        id: 'clan-1',
        name: 'Alpha Coders',
        tag: 'AC',
        ownerId: 'user-1',
        mmr: 1200,
        wins: 5,
        losses: 3,
    };

    const mockClan2 = {
        id: 'clan-2',
        name: 'Beta Devs',
        tag: 'BD',
        ownerId: 'user-2',
        mmr: 1100,
        wins: 4,
        losses: 4,
    };

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pastDate = new Date(Date.now() - 1000);

    const mockChallenge = {
        id: 'challenge-1',
        challengerClanId: 'clan-1',
        challengedClanId: 'clan-2',
        status: ClanChallengeStatus.PENDING,
        message: 'Bring it on!',
        teamSize: 2,
        timeLimitMinutes: 30,
        enabledSkills: [],
        preferredTopic: null,
        counterTeamSize: null,
        counterTimeLimitMinutes: null,
        counterEnabledSkills: [],
        counterPreferredTopic: null,
        counterMessage: null,
        expiresAt: futureDate,
        respondedAt: null,
        createdAt: new Date('2026-04-20T10:00:00Z'),
        updatedAt: new Date('2026-04-20T10:00:00Z'),
        challengerClan: { id: 'clan-1', name: 'Alpha Coders', tag: 'AC', mmr: 1200 },
        challengedClan: { id: 'clan-2', name: 'Beta Devs', tag: 'BD', mmr: 1100 },
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();
        clanWars = {
            createClanWarsBattle: jest
                .fn()
                .mockResolvedValue({ id: 'new-cw-battle' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClanChallengeService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ClanWarsService, useValue: clanWars },
            ],
        }).compile();

        service = module.get<ClanChallengeService>(ClanChallengeService);
        prisma = module.get(PrismaService);
    });

    // ====================================================================
    // sendChallenge
    // ====================================================================

    describe('sendChallenge', () => {
        it('should create a challenge successfully', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1) // own clan
                .mockResolvedValueOnce(mockClan2); // target clan
            prisma.clanChallenge.findFirst.mockResolvedValue(null);
            prisma.clanChallenge.create.mockResolvedValue(mockChallenge);

            const result = await service.sendChallenge('user-1', {
                targetClanId: 'clan-2',
                message: 'Bring it on!',
                teamSize: 2,
                timeLimitMinutes: 30,
            });

            expect(result).toEqual(mockChallenge);
            expect(prisma.clanChallenge.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        challengerClanId: 'clan-1',
                        challengedClanId: 'clan-2',
                        message: 'Bring it on!',
                        teamSize: 2,
                        timeLimitMinutes: 30,
                    }),
                }),
            );
        });

        it('should throw if user has no clan', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', clanId: null });

            await expect(
                service.sendChallenge('user-1', { targetClanId: 'clan-2' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if user is not the clan owner', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'user-3', clanId: 'clan-1' });
            prisma.clan.findUnique.mockResolvedValue({ ...mockClan1, ownerId: 'user-1' });

            await expect(
                service.sendChallenge('user-3', { targetClanId: 'clan-2' }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw if challenging own clan', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique.mockResolvedValue(mockClan1);

            await expect(
                service.sendChallenge('user-1', { targetClanId: 'clan-1' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if target clan not found', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1) // own clan
                .mockResolvedValueOnce(null); // target clan

            await expect(
                service.sendChallenge('user-1', { targetClanId: 'clan-999' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw if an active challenge already exists', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1)
                .mockResolvedValueOnce(mockClan2);
            prisma.clanChallenge.findFirst.mockResolvedValue(mockChallenge);

            await expect(
                service.sendChallenge('user-1', { targetClanId: 'clan-2' }),
            ).rejects.toThrow(ConflictException);
        });

        // ============================================================
        // CLAN_WARS-specific validation on send
        // ============================================================

        it('CLAN_WARS: requires clanWarsFormat (missing → 400)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1)
                .mockResolvedValueOnce(mockClan2);
            prisma.clanChallenge.findFirst.mockResolvedValue(null);

            await expect(
                service.sendChallenge('user-1', {
                    targetClanId: 'clan-2',
                    mode: BattleMode.CLAN_WARS,
                    rounds: [{ timeLimitSeconds: 300 }],
                }),
            ).rejects.toThrow(/clanWarsFormat is required/);
        });

        it('CLAN_WARS: requires non-empty rounds (missing → 400)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1)
                .mockResolvedValueOnce(mockClan2);
            prisma.clanChallenge.findFirst.mockResolvedValue(null);

            await expect(
                service.sendChallenge('user-1', {
                    targetClanId: 'clan-2',
                    mode: BattleMode.CLAN_WARS,
                    clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                }),
            ).rejects.toThrow(/rounds \(non-empty\) are required/);
        });

        it('CLAN_WARS: requires rounds to be non-empty (empty array → 400)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1)
                .mockResolvedValueOnce(mockClan2);
            prisma.clanChallenge.findFirst.mockResolvedValue(null);

            await expect(
                service.sendChallenge('user-1', {
                    targetClanId: 'clan-2',
                    mode: BattleMode.CLAN_WARS,
                    clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                    rounds: [],
                }),
            ).rejects.toThrow(/rounds \(non-empty\) are required/);
        });

        it('CLAN_WARS: happy path persists mode, format and rounds', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1)
                .mockResolvedValueOnce(mockClan2);
            prisma.clanChallenge.findFirst.mockResolvedValue(null);
            prisma.clanChallenge.create.mockResolvedValue({
                ...mockChallenge,
                mode: BattleMode.CLAN_WARS,
            });

            await service.sendChallenge('user-1', {
                targetClanId: 'clan-2',
                mode: BattleMode.CLAN_WARS,
                clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
                rounds: [
                    { timeLimitSeconds: 300 },
                    { timeLimitSeconds: 300 },
                ],
                teamSize: 3,
            });

            const createArg = prisma.clanChallenge.create.mock.calls[0][0];
            expect(createArg.data.mode).toBe(BattleMode.CLAN_WARS);
            expect(createArg.data.clanWarsFormat).toBe(
                ClanWarsFormat.SCORE_ATTACK,
            );
            expect(createArg.data.teamSize).toBe(3);
            // rounds goes through JSON field, so the create layer receives
            // the same object shape back.
            expect(createArg.data.rounds).toEqual([
                { timeLimitSeconds: 300 },
                { timeLimitSeconds: 300 },
            ]);
        });

        it('CLAN_VS_CLAN (default mode) does NOT require format or rounds', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan1)
                .mockResolvedValueOnce(mockClan2);
            prisma.clanChallenge.findFirst.mockResolvedValue(null);
            prisma.clanChallenge.create.mockResolvedValue(mockChallenge);

            await expect(
                service.sendChallenge('user-1', {
                    targetClanId: 'clan-2',
                    teamSize: 2,
                }),
            ).resolves.toBeDefined();
        });
    });

    // ====================================================================
    // acceptChallenge
    // ====================================================================

    describe('acceptChallenge', () => {
        it('should accept a PENDING challenge as challenged clan owner', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            const accepted = {
                ...mockChallenge,
                status: ClanChallengeStatus.ACCEPTED,
                respondedAt: new Date(),
            };
            prisma.clanChallenge.update.mockResolvedValue(accepted);

            const result = await service.acceptChallenge('user-2', 'challenge-1');

            expect(result.status).toBe(ClanChallengeStatus.ACCEPTED);
            expect(prisma.clanChallenge.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'challenge-1' },
                    data: expect.objectContaining({
                        status: ClanChallengeStatus.ACCEPTED,
                    }),
                }),
            );
        });

        it('should accept a COUNTERED challenge as challenger clan owner', async () => {
            const counteredChallenge = {
                ...mockChallenge,
                status: ClanChallengeStatus.COUNTERED,
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(counteredChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan1);
            const accepted = {
                ...counteredChallenge,
                status: ClanChallengeStatus.ACCEPTED,
                respondedAt: new Date(),
            };
            prisma.clanChallenge.update.mockResolvedValue(accepted);

            const result = await service.acceptChallenge('user-1', 'challenge-1');

            expect(result.status).toBe(ClanChallengeStatus.ACCEPTED);
        });

        it('should throw if challenge not found', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(null);

            await expect(
                service.acceptChallenge('user-2', 'nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw if challenge is expired', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue({
                ...mockChallenge,
                expiresAt: pastDate,
            });

            await expect(
                service.acceptChallenge('user-2', 'challenge-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if caller is not the correct clan owner', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            // mockClan2 owner is user-2, but we're calling with user-3
            prisma.clan.findUnique.mockResolvedValue({ ...mockClan2, ownerId: 'user-2' });

            await expect(
                service.acceptChallenge('user-3', 'challenge-1'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw if challenge status is not acceptable', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue({
                ...mockChallenge,
                status: ClanChallengeStatus.DECLINED,
            });

            await expect(
                service.acceptChallenge('user-2', 'challenge-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('materialises a Clan Wars battle when mode === CLAN_WARS', async () => {
            const cwChallenge = {
                ...mockChallenge,
                mode: BattleMode.CLAN_WARS,
                clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                rounds: [{ timeLimitSeconds: 300 }, { timeLimitSeconds: 300 }],
                counterClanWarsFormat: null,
                counterRounds: null,
                counterEnabledSkills: [],
                counterPreferredTopic: null,
                counterTeamSize: null,
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(cwChallenge);
            prisma.clan.findUnique
                .mockResolvedValueOnce(mockClan2) // validateClanOwner for challenged clan
                .mockResolvedValueOnce(mockClan1) // challenger clan lookup in createClanWarsBattleFromChallenge
                .mockResolvedValueOnce(mockClan2); // challenged clan lookup
            prisma.clanChallenge.update.mockResolvedValue({
                ...cwChallenge,
                status: ClanChallengeStatus.ACCEPTED,
                respondedAt: new Date(),
            });

            const result = await service.acceptChallenge(
                'user-2',
                'challenge-1',
            );

            expect(result.status).toBe(ClanChallengeStatus.ACCEPTED);
            expect(result.battleId).toBe('new-cw-battle');
            expect(clanWars.createClanWarsBattle).toHaveBeenCalledTimes(1);
            const [creatorId, dto] =
                clanWars.createClanWarsBattle.mock.calls[0];
            // Challenger clan's owner is the creator/captain of team-1.
            expect(creatorId).toBe(mockClan1.ownerId);
            expect(dto.clanWarsFormat).toBe(ClanWarsFormat.SAME_PROBLEM);
            // Both clan IDs are pre-filled from the challenge.
            expect(dto.teamOne.clanId).toBe(mockClan1.id);
            expect(dto.teamTwo.clanId).toBe(mockClan2.id);
        });

        it('does NOT create a Clan Wars battle for CLAN_VS_CLAN challenges', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            prisma.clanChallenge.update.mockResolvedValue({
                ...mockChallenge,
                status: ClanChallengeStatus.ACCEPTED,
                respondedAt: new Date(),
            });

            await service.acceptChallenge('user-2', 'challenge-1');
            expect(clanWars.createClanWarsBattle).not.toHaveBeenCalled();
        });
    });

    // ====================================================================
    // declineChallenge
    // ====================================================================

    describe('declineChallenge', () => {
        it('should decline a PENDING challenge as challenged clan owner', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            const declined = {
                ...mockChallenge,
                status: ClanChallengeStatus.DECLINED,
                respondedAt: new Date(),
            };
            prisma.clanChallenge.update.mockResolvedValue(declined);

            const result = await service.declineChallenge('user-2', 'challenge-1');

            expect(result.status).toBe(ClanChallengeStatus.DECLINED);
        });

        it('should decline a COUNTERED challenge as challenger clan owner', async () => {
            const counteredChallenge = {
                ...mockChallenge,
                status: ClanChallengeStatus.COUNTERED,
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(counteredChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan1);
            const declined = {
                ...counteredChallenge,
                status: ClanChallengeStatus.DECLINED,
                respondedAt: new Date(),
            };
            prisma.clanChallenge.update.mockResolvedValue(declined);

            const result = await service.declineChallenge('user-1', 'challenge-1');

            expect(result.status).toBe(ClanChallengeStatus.DECLINED);
        });

        it('should throw if challenge not found', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(null);

            await expect(
                service.declineChallenge('user-2', 'nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw if challenge is expired', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue({
                ...mockChallenge,
                expiresAt: pastDate,
            });

            await expect(
                service.declineChallenge('user-2', 'challenge-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if caller is not the correct clan owner', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            prisma.clan.findUnique.mockResolvedValue({ ...mockClan2, ownerId: 'user-2' });

            await expect(
                service.declineChallenge('user-3', 'challenge-1'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    // ====================================================================
    // counterChallenge
    // ====================================================================

    describe('counterChallenge', () => {
        it('should counter-propose successfully', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            const countered = {
                ...mockChallenge,
                status: ClanChallengeStatus.COUNTERED,
                counterTeamSize: 3,
                counterTimeLimitMinutes: 60,
                counterMessage: 'How about this?',
            };
            prisma.clanChallenge.update.mockResolvedValue(countered);

            const result = await service.counterChallenge('user-2', 'challenge-1', {
                teamSize: 3,
                timeLimitMinutes: 60,
                counterMessage: 'How about this?',
            });

            expect(result.status).toBe(ClanChallengeStatus.COUNTERED);
            expect(result.counterTeamSize).toBe(3);
            expect(prisma.clanChallenge.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: ClanChallengeStatus.COUNTERED,
                        counterTeamSize: 3,
                        counterTimeLimitMinutes: 60,
                        counterMessage: 'How about this?',
                    }),
                }),
            );
        });

        it('should throw if challenge is not PENDING', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue({
                ...mockChallenge,
                status: ClanChallengeStatus.COUNTERED,
            });

            await expect(
                service.counterChallenge('user-2', 'challenge-1', { teamSize: 3 }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if challenge is expired', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue({
                ...mockChallenge,
                expiresAt: pastDate,
            });

            await expect(
                service.counterChallenge('user-2', 'challenge-1', { teamSize: 3 }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw if caller is not challenged clan owner', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            prisma.clan.findUnique.mockResolvedValue({ ...mockClan2, ownerId: 'user-2' });

            await expect(
                service.counterChallenge('user-3', 'challenge-1', { teamSize: 3 }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw if challenge not found', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(null);

            await expect(
                service.counterChallenge('user-2', 'nonexistent', { teamSize: 3 }),
            ).rejects.toThrow(NotFoundException);
        });

        it('should reset expiry on counter', async () => {
            prisma.clanChallenge.findUnique.mockResolvedValue(mockChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            prisma.clanChallenge.update.mockResolvedValue({
                ...mockChallenge,
                status: ClanChallengeStatus.COUNTERED,
            });

            await service.counterChallenge('user-2', 'challenge-1', { teamSize: 3 });

            const updateCall = prisma.clanChallenge.update.mock.calls[0][0];
            const newExpiresAt = updateCall.data.expiresAt as Date;
            // New expiry should be roughly 24 hours from now
            const hoursFromNow =
                (newExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
            expect(hoursFromNow).toBeGreaterThan(23);
            expect(hoursFromNow).toBeLessThanOrEqual(24);
        });

        // ============================================================
        // CLAN_WARS counter-proposal semantics
        // ============================================================

        it('CLAN_WARS counter snapshots original fields when DTO omits them (so counter row is self-contained)', async () => {
            const cwChallenge = {
                ...mockChallenge,
                mode: BattleMode.CLAN_WARS,
                clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                rounds: [{ timeLimitSeconds: 300 }],
                enabledSkills: ['FREEZE'],
                preferredTopic: 'dp',
                teamSize: 2,
                timeLimitMinutes: 30,
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(cwChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            prisma.clanChallenge.update.mockResolvedValue({
                ...cwChallenge,
                status: ClanChallengeStatus.COUNTERED,
            });

            // Counter only tweaks teamSize; format / rounds / skills /
            // topic / timeLimit are omitted — they MUST be snapshotted from
            // the original so the counter row is a complete proposal.
            await service.counterChallenge('user-2', 'challenge-1', {
                teamSize: 3,
                counterMessage: 'how about 3v3 instead?',
            });

            const data = prisma.clanChallenge.update.mock.calls[0][0].data;
            expect(data.status).toBe(ClanChallengeStatus.COUNTERED);
            expect(data.counterTeamSize).toBe(3);
            expect(data.counterTimeLimitMinutes).toBe(30);
            expect(data.counterEnabledSkills).toEqual(['FREEZE']);
            expect(data.counterPreferredTopic).toBe('dp');
            expect(data.counterClanWarsFormat).toBe(
                ClanWarsFormat.SAME_PROBLEM,
            );
            expect(data.counterRounds).toEqual([{ timeLimitSeconds: 300 }]);
        });

        it('CLAN_WARS counter: explicit empty enabledSkills=[] overrides original (no silent fallback)', async () => {
            const cwChallenge = {
                ...mockChallenge,
                mode: BattleMode.CLAN_WARS,
                clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                rounds: [{ timeLimitSeconds: 300 }],
                enabledSkills: ['FREEZE', 'SABOTAGE'],
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(cwChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            prisma.clanChallenge.update.mockResolvedValue({
                ...cwChallenge,
                status: ClanChallengeStatus.COUNTERED,
            });

            await service.counterChallenge('user-2', 'challenge-1', {
                enabledSkills: [],
            });

            const data = prisma.clanChallenge.update.mock.calls[0][0].data;
            // Critical: previously '?? challenge.enabledSkills' would
            // fall through empty arrays; now `[]` is respected as an
            // intentional "no skills" counter.
            expect(data.counterEnabledSkills).toEqual([]);
        });

        it('CLAN_WARS counter: DTO rounds override original counterRounds', async () => {
            const cwChallenge = {
                ...mockChallenge,
                mode: BattleMode.CLAN_WARS,
                clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                rounds: [{ timeLimitSeconds: 300 }],
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(cwChallenge);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);
            prisma.clanChallenge.update.mockResolvedValue({
                ...cwChallenge,
                status: ClanChallengeStatus.COUNTERED,
            });

            await service.counterChallenge('user-2', 'challenge-1', {
                rounds: [
                    { timeLimitSeconds: 600 },
                    { timeLimitSeconds: 600 },
                    { timeLimitSeconds: 600 },
                ],
            });

            const data = prisma.clanChallenge.update.mock.calls[0][0].data;
            expect(data.counterRounds).toEqual([
                { timeLimitSeconds: 600 },
                { timeLimitSeconds: 600 },
                { timeLimitSeconds: 600 },
            ]);
        });

        it('CLAN_WARS counter: rejects when mode becomes CLAN_WARS but original had no format', async () => {
            const originalNoFormat = {
                ...mockChallenge,
                mode: BattleMode.CLAN_VS_CLAN, // originally not CW
                clanWarsFormat: null,
                rounds: null,
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(originalNoFormat);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);

            await expect(
                service.counterChallenge('user-2', 'challenge-1', {
                    mode: BattleMode.CLAN_WARS,
                    rounds: [{ timeLimitSeconds: 300 }],
                }),
            ).rejects.toThrow(/clanWarsFormat is required/);
        });

        it('CLAN_WARS counter: rejects when mode becomes CLAN_WARS but no rounds anywhere', async () => {
            const originalNoRounds = {
                ...mockChallenge,
                mode: BattleMode.CLAN_VS_CLAN,
                clanWarsFormat: null,
                rounds: null,
            };
            prisma.clanChallenge.findUnique.mockResolvedValue(originalNoRounds);
            prisma.clan.findUnique.mockResolvedValue(mockClan2);

            await expect(
                service.counterChallenge('user-2', 'challenge-1', {
                    mode: BattleMode.CLAN_WARS,
                    clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                }),
            ).rejects.toThrow(/rounds \(non-empty\) are required/);
        });
    });

    // ====================================================================
    // getChallenges
    // ====================================================================

    describe('getChallenges', () => {
        it('should return challenges for the clan', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clanChallenge.findMany.mockResolvedValue([mockChallenge]);

            const result = await service.getChallenges('clan-1', 'user-1');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('challenge-1');
        });

        it('should mark expired challenges as EXPIRED in response', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clanChallenge.findMany.mockResolvedValue([
                { ...mockChallenge, expiresAt: pastDate },
            ]);

            const result = await service.getChallenges('clan-1', 'user-1');

            expect(result[0].status).toBe(ClanChallengeStatus.EXPIRED);
        });

        it('should throw if user is not in the clan', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', clanId: 'other-clan' });

            await expect(
                service.getChallenges('clan-1', 'user-1'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    // ====================================================================
    // getPendingChallenges
    // ====================================================================

    describe('getPendingChallenges', () => {
        it('should return only pending/countered non-expired challenges', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.clanChallenge.findMany.mockResolvedValue([mockChallenge]);

            const result = await service.getPendingChallenges('clan-1', 'user-1');

            expect(result).toHaveLength(1);
            expect(prisma.clanChallenge.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: {
                            in: [ClanChallengeStatus.PENDING, ClanChallengeStatus.COUNTERED],
                        },
                        expiresAt: { gt: expect.any(Date) },
                    }),
                }),
            );
        });

        it('should throw if user is not in the clan', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', clanId: null });

            await expect(
                service.getPendingChallenges('clan-1', 'user-1'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    // ====================================================================
    // getClanMemberIds
    // ====================================================================

    describe('getClanMemberIds', () => {
        it('should return member IDs for the clan', async () => {
            prisma.user.findMany.mockResolvedValue([
                { id: 'user-1' },
                { id: 'user-2' },
                { id: 'user-3' },
            ]);

            const result = await service.getClanMemberIds('clan-1');

            expect(result).toEqual(['user-1', 'user-2', 'user-3']);
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { clanId: 'clan-1' },
                select: { id: true },
            });
        });

        it('should return empty array for clan with no members', async () => {
            prisma.user.findMany.mockResolvedValue([]);

            const result = await service.getClanMemberIds('clan-1');

            expect(result).toEqual([]);
        });
    });
});
