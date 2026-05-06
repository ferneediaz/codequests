import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ClanJoinRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClansService } from './clans.service';

@Injectable()
export class ClanJoinRequestsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly clansService: ClansService,
    ) {}

    async requestToJoin(clanId: string, userId: string, message?: string) {
        const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
        if (!clan) throw new NotFoundException('Clan not found');

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { clanId: true },
        });
        if (user?.clanId) {
            throw new BadRequestException(
                'You must leave your current clan before joining another',
            );
        }

        if (!clan.inviteOnly) {
            return { joined: true, clan: await this.clansService.join(clanId, userId) };
        }

        const existing = await this.prisma.clanJoinRequest.findUnique({
            where: { clanId_userId: { clanId, userId } },
        });
        if (existing?.status === ClanJoinRequestStatus.PENDING) {
            throw new ConflictException('You already have a pending request for this clan');
        }

        const request = existing
            ? await this.prisma.clanJoinRequest.update({
                  where: { id: existing.id },
                  data: { status: ClanJoinRequestStatus.PENDING, message, updatedAt: new Date() },
                  include: this.includeRequest,
              })
            : await this.prisma.clanJoinRequest.create({
                  data: { clanId, userId, message },
                  include: this.includeRequest,
              });

        return { joined: false, request };
    }

    async list(clanId: string, ownerId: string, status?: ClanJoinRequestStatus) {
        await this.validateOwner(clanId, ownerId);
        return this.prisma.clanJoinRequest.findMany({
            where: { clanId, ...(status ? { status } : {}) },
            include: this.includeRequest,
            orderBy: { createdAt: 'desc' },
        });
    }

    async approve(requestId: string, ownerId: string) {
        const request = await this.getRequest(requestId);
        await this.validateOwner(request.clanId, ownerId);
        if (request.status !== ClanJoinRequestStatus.PENDING) {
            throw new BadRequestException('Join request is not pending');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: request.userId },
            select: { clanId: true },
        });
        if (user?.clanId) {
            throw new BadRequestException('User already joined a clan');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: request.userId },
                data: { clanId: request.clanId },
            });
            return tx.clanJoinRequest.update({
                where: { id: request.id },
                data: { status: ClanJoinRequestStatus.APPROVED },
                include: this.includeRequest,
            });
        });
    }

    async reject(requestId: string, ownerId: string) {
        const request = await this.getRequest(requestId);
        await this.validateOwner(request.clanId, ownerId);
        if (request.status !== ClanJoinRequestStatus.PENDING) {
            throw new BadRequestException('Join request is not pending');
        }
        return this.prisma.clanJoinRequest.update({
            where: { id: request.id },
            data: { status: ClanJoinRequestStatus.REJECTED },
            include: this.includeRequest,
        });
    }

    async cancel(requestId: string, userId: string) {
        const request = await this.getRequest(requestId);
        if (request.userId !== userId) {
            throw new ForbiddenException('You can only cancel your own join request');
        }
        if (request.status !== ClanJoinRequestStatus.PENDING) {
            throw new BadRequestException('Join request is not pending');
        }
        return this.prisma.clanJoinRequest.update({
            where: { id: request.id },
            data: { status: ClanJoinRequestStatus.CANCELLED },
            include: this.includeRequest,
        });
    }

    private async getRequest(requestId: string) {
        const request = await this.prisma.clanJoinRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) throw new NotFoundException('Join request not found');
        return request;
    }

    private async validateOwner(clanId: string, userId: string) {
        const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
        if (!clan) throw new NotFoundException('Clan not found');
        if (clan.ownerId !== userId) {
            throw new ForbiddenException('Only the clan owner can manage join requests');
        }
        return clan;
    }

    private readonly includeRequest = {
        clan: { select: { id: true, name: true, tag: true, ownerId: true } },
        user: { select: { id: true, username: true, avatarUrl: true, mmr: true } },
    };
}
