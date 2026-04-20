import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClanChallengeStatus } from '@prisma/client';
import { SendChallengeDto } from './dto/send-challenge.dto';
import { CounterChallengeDto } from './dto/counter-challenge.dto';

const CHALLENGE_EXPIRY_HOURS = 24;

const challengeInclude = {
    challengerClan: {
        select: { id: true, name: true, tag: true, mmr: true },
    },
    challengedClan: {
        select: { id: true, name: true, tag: true, mmr: true },
    },
};

@Injectable()
export class ClanChallengeService {
    constructor(private prisma: PrismaService) {}

    /**
     * Send a clan challenge (owner only)
     */
    async sendChallenge(userId: string, dto: SendChallengeDto) {
        // Get user's clan
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { clanId: true },
        });

        if (!user?.clanId) {
            throw new BadRequestException('You must be in a clan to send a challenge');
        }

        // Verify user is the clan owner
        const clan = await this.prisma.clan.findUnique({
            where: { id: user.clanId },
        });

        if (!clan || clan.ownerId !== userId) {
            throw new ForbiddenException('Only the clan owner can send challenges');
        }

        // Verify target clan exists
        if (dto.targetClanId === user.clanId) {
            throw new BadRequestException('You cannot challenge your own clan');
        }

        const targetClan = await this.prisma.clan.findUnique({
            where: { id: dto.targetClanId },
        });

        if (!targetClan) {
            throw new NotFoundException('Target clan not found');
        }

        // Check for existing active challenge between these clans
        const existingChallenge = await this.prisma.clanChallenge.findFirst({
            where: {
                OR: [
                    { challengerClanId: user.clanId, challengedClanId: dto.targetClanId },
                    { challengerClanId: dto.targetClanId, challengedClanId: user.clanId },
                ],
                status: { in: [ClanChallengeStatus.PENDING, ClanChallengeStatus.COUNTERED] },
                expiresAt: { gt: new Date() },
            },
        });

        if (existingChallenge) {
            throw new ConflictException('An active challenge already exists between these clans');
        }

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + CHALLENGE_EXPIRY_HOURS);

        const challenge = await this.prisma.clanChallenge.create({
            data: {
                challengerClanId: user.clanId,
                challengedClanId: dto.targetClanId,
                message: dto.message,
                teamSize: dto.teamSize ?? 2,
                timeLimitMinutes: dto.timeLimitMinutes ?? 30,
                enabledSkills: dto.enabledSkills ?? [],
                preferredTopic: dto.preferredTopic,
                expiresAt,
            },
            include: challengeInclude,
        });

        return challenge;
    }

    /**
     * Accept a clan challenge (respective clan owner only)
     */
    async acceptChallenge(userId: string, challengeId: string) {
        const challenge = await this.prisma.clanChallenge.findUnique({
            where: { id: challengeId },
            include: challengeInclude,
        });

        if (!challenge) {
            throw new NotFoundException('Challenge not found');
        }

        if (challenge.expiresAt < new Date()) {
            throw new BadRequestException('This challenge has expired');
        }

        // Determine who can accept based on status
        if (challenge.status === ClanChallengeStatus.PENDING) {
            // Challenged clan owner accepts
            await this.validateClanOwner(userId, challenge.challengedClanId);
        } else if (challenge.status === ClanChallengeStatus.COUNTERED) {
            // Challenger clan owner accepts the counter
            await this.validateClanOwner(userId, challenge.challengerClanId);
        } else {
            throw new BadRequestException(
                `Cannot accept a challenge with status ${challenge.status}`,
            );
        }

        const updated = await this.prisma.clanChallenge.update({
            where: { id: challengeId },
            data: {
                status: ClanChallengeStatus.ACCEPTED,
                respondedAt: new Date(),
            },
            include: challengeInclude,
        });

        return updated;
    }

    /**
     * Decline a clan challenge (respective clan owner only)
     */
    async declineChallenge(userId: string, challengeId: string) {
        const challenge = await this.prisma.clanChallenge.findUnique({
            where: { id: challengeId },
            include: challengeInclude,
        });

        if (!challenge) {
            throw new NotFoundException('Challenge not found');
        }

        if (challenge.expiresAt < new Date()) {
            throw new BadRequestException('This challenge has expired');
        }

        // Determine who can decline based on status
        if (challenge.status === ClanChallengeStatus.PENDING) {
            await this.validateClanOwner(userId, challenge.challengedClanId);
        } else if (challenge.status === ClanChallengeStatus.COUNTERED) {
            await this.validateClanOwner(userId, challenge.challengerClanId);
        } else {
            throw new BadRequestException(
                `Cannot decline a challenge with status ${challenge.status}`,
            );
        }

        const updated = await this.prisma.clanChallenge.update({
            where: { id: challengeId },
            data: {
                status: ClanChallengeStatus.DECLINED,
                respondedAt: new Date(),
            },
            include: challengeInclude,
        });

        return updated;
    }

    /**
     * Counter-propose a clan challenge (challenged clan owner only, PENDING status only)
     */
    async counterChallenge(
        userId: string,
        challengeId: string,
        dto: CounterChallengeDto,
    ) {
        const challenge = await this.prisma.clanChallenge.findUnique({
            where: { id: challengeId },
            include: challengeInclude,
        });

        if (!challenge) {
            throw new NotFoundException('Challenge not found');
        }

        if (challenge.status !== ClanChallengeStatus.PENDING) {
            throw new BadRequestException('Only pending challenges can be countered');
        }

        if (challenge.expiresAt < new Date()) {
            throw new BadRequestException('This challenge has expired');
        }

        // Only challenged clan owner can counter
        await this.validateClanOwner(userId, challenge.challengedClanId);

        // Reset expiry on counter
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + CHALLENGE_EXPIRY_HOURS);

        const updated = await this.prisma.clanChallenge.update({
            where: { id: challengeId },
            data: {
                status: ClanChallengeStatus.COUNTERED,
                counterTeamSize: dto.teamSize,
                counterTimeLimitMinutes: dto.timeLimitMinutes,
                counterEnabledSkills: dto.enabledSkills ?? [],
                counterPreferredTopic: dto.preferredTopic,
                counterMessage: dto.counterMessage,
                expiresAt,
            },
            include: challengeInclude,
        });

        return updated;
    }

    /**
     * Get all challenges for a clan (sent and received)
     */
    async getChallenges(clanId: string, userId: string) {
        // Verify user is a member of this clan
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { clanId: true },
        });

        if (user?.clanId !== clanId) {
            throw new ForbiddenException('You are not a member of this clan');
        }

        const now = new Date();

        const challenges = await this.prisma.clanChallenge.findMany({
            where: {
                OR: [
                    { challengerClanId: clanId },
                    { challengedClanId: clanId },
                ],
            },
            include: challengeInclude,
            orderBy: { createdAt: 'desc' },
        });

        // Mark expired challenges in the response
        return challenges.map((c) => ({
            ...c,
            status:
                (c.status === ClanChallengeStatus.PENDING ||
                    c.status === ClanChallengeStatus.COUNTERED) &&
                c.expiresAt < now
                    ? ClanChallengeStatus.EXPIRED
                    : c.status,
        }));
    }

    /**
     * Get pending/countered challenges for a clan (not expired)
     */
    async getPendingChallenges(clanId: string, userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { clanId: true },
        });

        if (user?.clanId !== clanId) {
            throw new ForbiddenException('You are not a member of this clan');
        }

        return this.prisma.clanChallenge.findMany({
            where: {
                OR: [
                    { challengerClanId: clanId },
                    { challengedClanId: clanId },
                ],
                status: {
                    in: [ClanChallengeStatus.PENDING, ClanChallengeStatus.COUNTERED],
                },
                expiresAt: { gt: new Date() },
            },
            include: challengeInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get clan member IDs (used by WebSocket notifications)
     */
    async getClanMemberIds(clanId: string): Promise<string[]> {
        const members = await this.prisma.user.findMany({
            where: { clanId },
            select: { id: true },
        });
        return members.map((m) => m.id);
    }

    /**
     * Validate that a user is the owner of the given clan
     */
    private async validateClanOwner(userId: string, clanId: string) {
        const clan = await this.prisma.clan.findUnique({
            where: { id: clanId },
        });

        if (!clan) {
            throw new NotFoundException('Clan not found');
        }

        if (clan.ownerId !== userId) {
            throw new ForbiddenException('Only the clan owner can perform this action');
        }

        return clan;
    }
}
