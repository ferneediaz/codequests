import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    BattleMode,
    ClanChallengeStatus,
    ClanWarsFormat,
    SkillType,
} from '@prisma/client';
import { SendChallengeDto } from './dto/send-challenge.dto';
import { CounterChallengeDto } from './dto/counter-challenge.dto';
import { ClanWarsService } from '../battles/clan-wars.service';
import { CreateClanWarsBattleDto } from '../battles/dto/create-clan-wars-battle.dto';
import { RoundConfigDto } from '../battles/dto/round-config.dto';

const CHALLENGE_EXPIRY_HOURS = 24;

// JSON shape persisted in `ClanChallenge.rounds` / `counterRounds`. Stored as
// Prisma `Json`, so we re-validate on read instead of trusting the column.
interface RawRoundJson {
    timeLimitSeconds: number | string;
}

function isRawRoundJson(value: unknown): value is RawRoundJson {
    if (typeof value !== 'object' || value === null) return false;
    const t = (value as Record<string, unknown>).timeLimitSeconds;
    return typeof t === 'number' || typeof t === 'string';
}

const KNOWN_SKILL_TYPES = new Set<string>(Object.values(SkillType));

// `ClanChallenge.enabledSkills` is `string[]` in Prisma so we re-narrow it
// to the live `SkillType` enum, dropping any value the catalog no longer
// recognises (e.g. a skill removed since the challenge was issued).
function asSkillTypes(values: string[]): SkillType[] {
    return values.filter((v): v is SkillType => KNOWN_SKILL_TYPES.has(v));
}

const KNOWN_CLAN_WARS_FORMATS = new Set<string>(Object.values(ClanWarsFormat));

function isClanWarsFormat(value: unknown): value is ClanWarsFormat {
    return typeof value === 'string' && KNOWN_CLAN_WARS_FORMATS.has(value);
}

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
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => ClanWarsService))
        private clanWarsService: ClanWarsService,
    ) {}

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

        const mode = dto.mode ?? BattleMode.CLAN_VS_CLAN;

        // When initiating a CLAN_WARS negotiation, rounds + format must be
        // present so the accepting clan owner knows what they're agreeing to.
        if (mode === BattleMode.CLAN_WARS) {
            if (!dto.clanWarsFormat) {
                throw new BadRequestException(
                    'clanWarsFormat is required when mode === CLAN_WARS',
                );
            }
            if (!dto.rounds || dto.rounds.length === 0) {
                throw new BadRequestException(
                    'rounds (non-empty) are required when mode === CLAN_WARS',
                );
            }
        }

        const challenge = await this.prisma.clanChallenge.create({
            data: {
                challengerClanId: user.clanId,
                challengedClanId: dto.targetClanId,
                message: dto.message,
                mode,
                teamSize: dto.teamSize ?? 2,
                timeLimitMinutes: dto.timeLimitMinutes ?? 30,
                enabledSkills: dto.enabledSkills ?? [],
                preferredTopic: dto.preferredTopic,
                clanWarsFormat: dto.clanWarsFormat ?? null,
                rounds:
                    mode === BattleMode.CLAN_WARS && dto.rounds
                        ? (dto.rounds as unknown as object)
                        : undefined,
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

        // Clan Wars: materialise the negotiated config into a real Battle. The
        // challenge's challenger-clan owner acts as team-1 creator; both
        // clanIds are pre-filled so members can then join via the battle's
        // join endpoint (clan-gate enforced). `wasCountered` uses the
        // pre-flip status so the counter* fields are preferred when the
        // latest agreed state was a counter-proposal (snapshotted at counter
        // time, see counterChallenge).
        let battleId: string | null = null;
        if (updated.mode === BattleMode.CLAN_WARS) {
            const wasCountered =
                challenge.status === ClanChallengeStatus.COUNTERED;
            battleId = await this.createClanWarsBattleFromChallenge(
                updated,
                wasCountered,
            );
        }

        return { ...updated, battleId };
    }

    /**
     * Resolve a CLAN_WARS accepted challenge into an actual `Battle` row.
     *
     * - Uses counter* fields when the latest state was a counter-proposal.
     * - The challenger clan's owner is the creator (team-1 captain) so their
     *   subscription gate governs the battle.
     */
    private async createClanWarsBattleFromChallenge(
        challenge: {
            id: string;
            challengerClanId: string;
            challengedClanId: string;
            teamSize: number;
            counterTeamSize: number | null;
            enabledSkills: string[];
            counterEnabledSkills: string[];
            preferredTopic: string | null;
            counterPreferredTopic: string | null;
            clanWarsFormat: unknown;
            counterClanWarsFormat: unknown;
            rounds: unknown;
            counterRounds: unknown;
        },
        wasCountered: boolean,
    ): Promise<string | null> {
        const challengerClan = await this.prisma.clan.findUnique({
            where: { id: challenge.challengerClanId },
        });
        if (!challengerClan) {
            throw new NotFoundException('Challenger clan vanished');
        }

        const challengedClan = await this.prisma.clan.findUnique({
            where: { id: challenge.challengedClanId },
        });
        if (!challengedClan) {
            throw new NotFoundException('Challenged clan vanished');
        }

        // When the latest negotiation state was a counter-proposal, the
        // counter* row is the authoritative snapshot. counterChallenge now
        // fills every counter* field from the original on counter time so
        // that `counterEnabledSkills = []` truthfully means "no skills"
        // rather than being ambiguous with "counter didn't touch skills".
        const teamSize = wasCountered
            ? (challenge.counterTeamSize ?? challenge.teamSize)
            : challenge.teamSize;
        const enabledSkills = wasCountered
            ? (challenge.counterEnabledSkills ?? challenge.enabledSkills)
            : challenge.enabledSkills;
        const preferredTopic = wasCountered
            ? (challenge.counterPreferredTopic ?? challenge.preferredTopic)
            : challenge.preferredTopic;
        const clanWarsFormat = wasCountered
            ? (challenge.counterClanWarsFormat ?? challenge.clanWarsFormat)
            : challenge.clanWarsFormat;
        const rawRounds = wasCountered
            ? (challenge.counterRounds ?? challenge.rounds)
            : challenge.rounds;

        if (!isClanWarsFormat(clanWarsFormat)) {
            throw new BadRequestException(
                'Challenge is missing or has invalid clanWarsFormat',
            );
        }
        if (!Array.isArray(rawRounds) || rawRounds.length === 0) {
            throw new BadRequestException('Challenge is missing rounds config');
        }
        if (!rawRounds.every(isRawRoundJson)) {
            throw new BadRequestException(
                'Challenge has malformed rounds config',
            );
        }

        const rounds: RoundConfigDto[] = rawRounds.map((r) => ({
            timeLimitSeconds: Number(r.timeLimitSeconds),
        }));

        const dto: CreateClanWarsBattleDto = {
            clanWarsFormat,
            teamSize,
            rounds,
            enabledSkills: asSkillTypes(enabledSkills),
            preferredTopic: preferredTopic ?? undefined,
            teamOne: {
                name: challengerClan.name,
                tag: challengerClan.tag,
                clanId: challengerClan.id,
            },
            teamTwo: {
                name: challengedClan.name,
                tag: challengedClan.tag,
                clanId: challengedClan.id,
            },
            withInviteCode: false,
        };

        const battle = await this.clanWarsService.createClanWarsBattle(
            challengerClan.ownerId,
            dto,
        );
        return battle.id;
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

        // When the counter is itself a CLAN_WARS proposal it MUST still carry
        // a format and at least one round so the resulting counter row is a
        // complete, self-contained proposal. This matches the send-side
        // validation and prevents an accepted counter from resolving to a
        // half-defined battle config.
        const counterMode = dto.mode ?? challenge.mode;
        if (counterMode === BattleMode.CLAN_WARS) {
            const counterFormat =
                dto.clanWarsFormat ?? challenge.clanWarsFormat;
            if (!counterFormat) {
                throw new BadRequestException(
                    'clanWarsFormat is required when counter mode === CLAN_WARS',
                );
            }
            const hasCounterRounds = dto.rounds && dto.rounds.length > 0;
            const hasOriginalRounds =
                Array.isArray(challenge.rounds) &&
                (challenge.rounds as unknown[]).length > 0;
            if (!hasCounterRounds && !hasOriginalRounds) {
                throw new BadRequestException(
                    'rounds (non-empty) are required when counter mode === CLAN_WARS',
                );
            }
        }

        // Reset expiry on counter
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + CHALLENGE_EXPIRY_HOURS);

        // Snapshot every counter* field from the original when the DTO
        // doesn't explicitly override it, so that `counterEnabledSkills=[]`
        // unambiguously means "no skills" (not "counter didn't touch
        // skills"). The acceptChallenge path then treats the counter row as
        // the authoritative proposal when `status === COUNTERED`.
        const updated = await this.prisma.clanChallenge.update({
            where: { id: challengeId },
            data: {
                status: ClanChallengeStatus.COUNTERED,
                counterTeamSize: dto.teamSize ?? challenge.teamSize,
                counterTimeLimitMinutes:
                    dto.timeLimitMinutes ?? challenge.timeLimitMinutes,
                counterEnabledSkills:
                    dto.enabledSkills ?? challenge.enabledSkills,
                counterPreferredTopic:
                    dto.preferredTopic ?? challenge.preferredTopic,
                counterMessage: dto.counterMessage,
                counterClanWarsFormat:
                    dto.clanWarsFormat ?? challenge.clanWarsFormat ?? null,
                counterRounds:
                    counterMode === BattleMode.CLAN_WARS
                        ? dto.rounds
                            ? (dto.rounds as unknown as object)
                            : ((challenge.rounds as unknown as object) ??
                              undefined)
                        : undefined,
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
