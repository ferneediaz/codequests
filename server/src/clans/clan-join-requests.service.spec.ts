import { Test, TestingModule } from '@nestjs/testing';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { ClanJoinRequestStatus } from '@prisma/client';
import { ClanJoinRequestsService } from './clan-join-requests.service';
import { ClansService } from './clans.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService } from '../__mocks__/prisma.service';

describe('ClanJoinRequestsService', () => {
    let service: ClanJoinRequestsService;
    let prisma: ReturnType<typeof createMockPrismaService>;
    let clans: { join: jest.Mock };

    beforeEach(async () => {
        prisma = createMockPrismaService();
        clans = { join: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClanJoinRequestsService,
                { provide: PrismaService, useValue: prisma },
                { provide: ClansService, useValue: clans },
            ],
        }).compile();

        service = module.get(ClanJoinRequestsService);
    });

    describe('requestToJoin', () => {
        it('joins directly when clan is open', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                inviteOnly: false,
            });
            prisma.user.findUnique.mockResolvedValue({ clanId: null });
            clans.join.mockResolvedValue({ id: 'clan-1' });

            const result = await service.requestToJoin('clan-1', 'user-1');

            expect(clans.join).toHaveBeenCalledWith('clan-1', 'user-1');
            expect(result).toEqual({ joined: true, clan: { id: 'clan-1' } });
            expect(prisma.clanJoinRequest.create).not.toHaveBeenCalled();
        });

        it('creates a PENDING request for an invite-only clan', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                inviteOnly: true,
            });
            prisma.user.findUnique.mockResolvedValue({ clanId: null });
            prisma.clanJoinRequest.findUnique.mockResolvedValue(null);
            prisma.clanJoinRequest.create.mockResolvedValue({
                id: 'req-1',
                status: ClanJoinRequestStatus.PENDING,
            });

            const result = await service.requestToJoin('clan-1', 'user-1', 'pls');

            expect(prisma.clanJoinRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { clanId: 'clan-1', userId: 'user-1', message: 'pls' },
                }),
            );
            expect(result.joined).toBe(false);
        });

        it('rejects a duplicate PENDING request', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                inviteOnly: true,
            });
            prisma.user.findUnique.mockResolvedValue({ clanId: null });
            prisma.clanJoinRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                status: ClanJoinRequestStatus.PENDING,
            });

            await expect(
                service.requestToJoin('clan-1', 'user-1'),
            ).rejects.toThrow(ConflictException);
        });

        it('rejects when user is already in a clan', async () => {
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                inviteOnly: true,
            });
            prisma.user.findUnique.mockResolvedValue({ clanId: 'other' });

            await expect(
                service.requestToJoin('clan-1', 'user-1'),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws NotFound when clan does not exist', async () => {
            prisma.clan.findUnique.mockResolvedValue(null);
            await expect(
                service.requestToJoin('missing', 'user-1'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('approve', () => {
        it('updates user.clanId and marks request APPROVED in a transaction', async () => {
            prisma.clanJoinRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                clanId: 'clan-1',
                userId: 'user-1',
                status: ClanJoinRequestStatus.PENDING,
            });
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                ownerId: 'owner-1',
            });
            prisma.user.findUnique.mockResolvedValue({ clanId: null });

            const calls: { method: string; args: unknown }[] = [];
            prisma.$transaction.mockImplementation(async (cb: any) => {
                const tx = {
                    user: {
                        update: jest.fn().mockImplementation((args) => {
                            calls.push({ method: 'user.update', args });
                            return Promise.resolve({});
                        }),
                    },
                    clanJoinRequest: {
                        update: jest.fn().mockImplementation((args) => {
                            calls.push({ method: 'clanJoinRequest.update', args });
                            return Promise.resolve({
                                id: 'req-1',
                                status: ClanJoinRequestStatus.APPROVED,
                            });
                        }),
                    },
                };
                return cb(tx);
            });

            const result = await service.approve('req-1', 'owner-1');

            expect(calls).toEqual([
                {
                    method: 'user.update',
                    args: {
                        where: { id: 'user-1' },
                        data: { clanId: 'clan-1' },
                    },
                },
                expect.objectContaining({ method: 'clanJoinRequest.update' }),
            ]);
            expect(result.status).toBe(ClanJoinRequestStatus.APPROVED);
        });

        it('rejects non-owner approvals', async () => {
            prisma.clanJoinRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                clanId: 'clan-1',
                userId: 'user-1',
                status: ClanJoinRequestStatus.PENDING,
            });
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                ownerId: 'owner-1',
            });

            await expect(service.approve('req-1', 'someone-else')).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('rejects when target user already has a clan', async () => {
            prisma.clanJoinRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                clanId: 'clan-1',
                userId: 'user-1',
                status: ClanJoinRequestStatus.PENDING,
            });
            prisma.clan.findUnique.mockResolvedValue({
                id: 'clan-1',
                ownerId: 'owner-1',
            });
            prisma.user.findUnique.mockResolvedValue({ clanId: 'other' });

            await expect(service.approve('req-1', 'owner-1')).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('cancel', () => {
        it('lets the requester cancel their own pending request', async () => {
            prisma.clanJoinRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                userId: 'user-1',
                status: ClanJoinRequestStatus.PENDING,
            });
            prisma.clanJoinRequest.update.mockResolvedValue({
                id: 'req-1',
                status: ClanJoinRequestStatus.CANCELLED,
            });

            const result = await service.cancel('req-1', 'user-1');

            expect(prisma.clanJoinRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { status: ClanJoinRequestStatus.CANCELLED },
                }),
            );
            expect(result.status).toBe(ClanJoinRequestStatus.CANCELLED);
        });

        it('forbids cancelling someone else\'s request', async () => {
            prisma.clanJoinRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                userId: 'user-1',
                status: ClanJoinRequestStatus.PENDING,
            });

            await expect(service.cancel('req-1', 'user-2')).rejects.toThrow(
                ForbiddenException,
            );
        });
    });
});
