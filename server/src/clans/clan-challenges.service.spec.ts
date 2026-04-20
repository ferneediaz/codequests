import { Test, TestingModule } from '@nestjs/testing';
import { ClanChallengeService } from './clan-challenges.service';
import { PrismaService } from '../prisma/prisma.service';
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
import { ClanChallengeStatus } from '@prisma/client';

describe('ClanChallengeService', () => {
    let service: ClanChallengeService;
    let prisma: MockPrismaService;

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

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClanChallengeService,
                { provide: PrismaService, useValue: mockPrisma },
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
