import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Inject,
    Logger,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
    BattleMode,
    BattleRoundEndReason,
    BattleRoundStatus,
    BattleStatus,
    ClanWarsFormat,
    Difficulty,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeasonsService } from '../seasons/seasons.service';
import { ProblemsService } from '../problems/problems.service';
import {
    BATTLE_EVENTS_PORT,
    BattleEventsPort,
} from '../realtime/ports/battle-events.port';
import { CreateClanWarsBattleDto } from './dto/create-clan-wars-battle.dto';
import { ClanWarsPresetDto } from './dto/clan-wars-preset.dto';
import { SubmissionResult } from './types/battle-submission.types';
import { getRankTier, RankTier } from '../common/utils/rank-tiers';

// ============================================
// Constants
// ============================================

const ELO_K_FACTOR = 16;
const MIN_MMR = 0;
const CLAN_MMR_CHANGE = 15;

const MIN_TEAM_SIZE = 1;
const MAX_TEAM_SIZE = 10;
const MIN_ROUND_SECONDS = 10;
const MAX_ROUND_SECONDS = 7200;

const INVITE_CODE_LENGTH = 8;
const INVITE_EXPIRY_HOURS = 24;

const DIFFICULTY_POINTS: Record<Difficulty, number> = {
    EASY: 2,
    MEDIUM: 5,
    HARD: 10,
};

// ============================================
// Types
// ============================================

export interface ClanWarsTeamMemberStanding {
    userId: string;
    username?: string;
    avatarUrl?: string | null;
    mmr?: number;
    tier?: RankTier;
    cumulativePoints: number;
    roundPoints: number;
    testsPassed: number;
    totalTests: number;
    isReady: boolean;
    lastSubmittedAt: Date | null;
}

export interface ClanWarsTeamStanding {
    team: 'team-1' | 'team-2';
    clanId: string | null;
    name: string;
    tag: string | null;
    captainId: string | null;
    cumulativePoints: number;
    roundPoints: number;
    roundsWon: number;
    testsPassed: number;
    totalTests: number;
    lastSubmittedAt: Date | null;
    members: ClanWarsTeamMemberStanding[];
}

// Light-weight shape for round-end ranking. Declared at module scope so both
// the service method and the private helper can refer to it.
type RankSubmission = {
    userId: string;
    allPassed: boolean;
    testsPassed: number;
    pointsEarned: number;
    submittedAt: Date;
};

// ============================================
// Service
// ============================================

@Injectable()
export class ClanWarsService {
    private readonly logger = new Logger(ClanWarsService.name);

    constructor(
        private prisma: PrismaService,
        private codeExecutionService: CodeExecutionService,
        private subscriptionsService: SubscriptionsService,
        private seasonsService: SeasonsService,
        private problemsService: ProblemsService,
        private scheduler: SchedulerRegistry,
        @Inject(BATTLE_EVENTS_PORT)
        private gateway: BattleEventsPort,
    ) { }

    // ========================================
    // Presets
    // ========================================

    /**
     * Server-owned reference presets. Clients can use these as-is or mutate
     * them before POSTing. Presets are NOT enforced server-side.
     */
    getPresets(): ClanWarsPresetDto[] {
        return [
            {
                id: '3v3-same-problem-3r',
                name: '3v3 Same Problem (3 rounds)',
                description:
                    '3 players per team, 3 rounds of the same problem per round.',
                clanWarsFormat: ClanWarsFormat.SAME_PROBLEM,
                teamSize: 3,
                rounds: [
                    { timeLimitSeconds: 300 },
                    { timeLimitSeconds: 300 },
                    { timeLimitSeconds: 300 },
                ],
            },
            {
                id: '3v3-score-attack-3r',
                name: '3v3 Score Attack (3 rounds)',
                description:
                    '3 players per team, 3 rounds of score attack. Rack up points from a problem pool.',
                clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
                teamSize: 3,
                rounds: [
                    { timeLimitSeconds: 600 },
                    { timeLimitSeconds: 600 },
                    { timeLimitSeconds: 600 },
                ],
            },
            {
                id: '5v5-score-attack-4r',
                name: '5v5 Score Attack (4 rounds)',
                description:
                    '5 players per team, 4 long rounds of score attack. Team with the highest cumulative score wins.',
                clanWarsFormat: ClanWarsFormat.SCORE_ATTACK,
                teamSize: 5,
                rounds: [
                    { timeLimitSeconds: 900 },
                    { timeLimitSeconds: 900 },
                    { timeLimitSeconds: 900 },
                    { timeLimitSeconds: 900 },
                ],
            },
        ];
    }

    // ========================================
    // Config validation (pure)
    // ========================================

    /**
     * Validates a CreateClanWarsBattleDto *shape* (ignoring DB-dependent checks).
     *
     * Rules enforced:
     *  - clanWarsFormat provided
     *  - teamSize in [1, 10]
     *  - rounds.length >= 1
     *  - every timeLimitSeconds in [10, 7200] and is an integer
     *
     * Unlike Battle Royale there is no elimination constraint — teams
     * accumulate points across rounds and the cumulative-score winner takes
     * the match.
     */
    validateConfig(dto: CreateClanWarsBattleDto): void {
        if (!dto.clanWarsFormat) {
            throw new BadRequestException(
                'clanWarsFormat is required for Clan Wars',
            );
        }
        if (
            dto.teamSize === undefined ||
            dto.teamSize === null ||
            !Number.isInteger(dto.teamSize)
        ) {
            throw new BadRequestException('teamSize is required for Clan Wars');
        }
        if (dto.teamSize < MIN_TEAM_SIZE || dto.teamSize > MAX_TEAM_SIZE) {
            throw new BadRequestException(
                `teamSize must be between ${MIN_TEAM_SIZE} and ${MAX_TEAM_SIZE}`,
            );
        }
        const rounds = dto.rounds;
        if (!rounds || rounds.length < 1) {
            throw new BadRequestException(
                'rounds must contain at least one round configuration',
            );
        }
        for (let i = 0; i < rounds.length; i++) {
            const r = rounds[i];
            if (!Number.isInteger(r.timeLimitSeconds)) {
                throw new BadRequestException(
                    `Round ${i + 1}: timeLimitSeconds must be an integer`,
                );
            }
            if (
                r.timeLimitSeconds < MIN_ROUND_SECONDS ||
                r.timeLimitSeconds > MAX_ROUND_SECONDS
            ) {
                throw new BadRequestException(
                    `Round ${i + 1}: timeLimitSeconds must be between ${MIN_ROUND_SECONDS} and ${MAX_ROUND_SECONDS}`,
                );
            }
        }
    }

    // ========================================
    // Create
    // ========================================

    /**
     * Create a Clan Wars battle (lobby).
     *
     * - Subscription gate for the creator
     * - Config validation
     * - For SAME_PROBLEM: verify enough distinct problems are available
     * - For SCORE_ATTACK: validate explicit problemIds if provided
     * - Creator joins team-1 as captain
     * - If team config carries clanId, the creator must be a member of that clan
     * - Optional invite code for the lobby (defaults ON because temp-clan
     *   matches need an invite path; the client can opt out)
     */
    async createClanWarsBattle(userId: string, dto: CreateClanWarsBattleDto) {
        const canPlay = await this.subscriptionsService.canPlay(userId);
        if (!canPlay) {
            throw new ForbiddenException(
                'Daily free game limit reached. Upgrade to Pro for unlimited games.',
            );
        }

        this.validateConfig(dto);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { clan: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const format = dto.clanWarsFormat;
        const rounds = dto.rounds;

        // Resolve team-1 / team-2 clan metadata
        const teamOneClanId = dto.teamOne?.clanId ?? null;
        const teamTwoClanId = dto.teamTwo?.clanId ?? null;

        // If team-1 is an official clan, the creator must be a member of it.
        if (teamOneClanId) {
            if (user.clanId !== teamOneClanId) {
                throw new BadRequestException(
                    'You must be a member of the team-1 clan to create this battle',
                );
            }
        }
        if (teamOneClanId && teamTwoClanId && teamOneClanId === teamTwoClanId) {
            throw new BadRequestException(
                'Team-1 and team-2 cannot be the same clan',
            );
        }

        // Resolve display labels for team-1 (official clan → use clan name/tag;
        // temp clan → dto-provided labels).
        let teamOneName = dto.teamOne?.name ?? null;
        let teamOneTag = dto.teamOne?.tag ?? null;
        if (teamOneClanId) {
            const clan = await this.prisma.clan.findUnique({
                where: { id: teamOneClanId },
                select: { id: true, name: true, tag: true },
            });
            if (!clan) {
                throw new NotFoundException(
                    `Team-1 clan ${teamOneClanId} not found`,
                );
            }
            teamOneName = teamOneName ?? clan.name;
            teamOneTag = teamOneTag ?? clan.tag;
        }
        if (!teamOneName) {
            // Temp clan w/o name — default to "Team 1"
            teamOneName = 'Team 1';
        }

        let teamTwoName = dto.teamTwo?.name ?? null;
        let teamTwoTag = dto.teamTwo?.tag ?? null;
        if (teamTwoClanId) {
            const clan = await this.prisma.clan.findUnique({
                where: { id: teamTwoClanId },
                select: { id: true, name: true, tag: true },
            });
            if (!clan) {
                throw new NotFoundException(
                    `Team-2 clan ${teamTwoClanId} not found`,
                );
            }
            teamTwoName = teamTwoName ?? clan.name;
            teamTwoTag = teamTwoTag ?? clan.tag;
        }
        if (!teamTwoName) {
            teamTwoName = 'Team 2';
        }

        // DB-level problem checks
        if (format === ClanWarsFormat.SAME_PROBLEM) {
            const available = await this.prisma.problem.count();
            if (available < rounds.length) {
                throw new BadRequestException(
                    `Not enough distinct problems available (${available}) to cover ${rounds.length} SAME_PROBLEM rounds`,
                );
            }
        } else if (format === ClanWarsFormat.SCORE_ATTACK) {
            if (dto.problemIds && dto.problemIds.length > 0) {
                const found = await this.prisma.problem.count({
                    where: { id: { in: dto.problemIds } },
                });
                if (found !== dto.problemIds.length) {
                    throw new BadRequestException(
                        'One or more problemIds do not exist',
                    );
                }
            } else {
                const count = await this.prisma.problem.count();
                if (count === 0) {
                    throw new BadRequestException(
                        'No problems available to build a SCORE_ATTACK pool',
                    );
                }
            }
        }

        const activeSeason = await this.seasonsService.getActiveSeason();

        // Invite code — defaults ON for Clan Wars because the lobby is typically
        // assembled ad-hoc (temp clans, captain invites). The caller can opt
        // out explicitly by passing withInviteCode: false.
        let inviteCode: string | null = null;
        let inviteExpiresAt: Date | null = null;
        const withInvite = dto.withInviteCode !== false;
        if (withInvite) {
            inviteCode = await this.generateInviteCode();
            inviteExpiresAt = new Date(
                Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
            );
        }

        const battle = await this.prisma.battle.create({
            data: {
                mode: BattleMode.CLAN_WARS,
                clanWarsFormat: format,
                teamSize: dto.teamSize,
                currentRound: 0,
                timeLimitMinutes: 5, // unused for CW but required by schema default
                enabledSkills: dto.enabledSkills || [],
                inviteCode,
                inviteExpiresAt,
                seasonId: activeSeason?.id || null,
                status: BattleStatus.WAITING,
                teamOneName,
                teamOneTag,
                teamTwoName,
                teamTwoTag,
                teamOneClanId,
                teamTwoClanId,
                teamOneCaptainId: userId,
                teamTwoCaptainId: null,
                isInIntermission: false,
                participants: {
                    create: {
                        userId,
                        totalTests: 0,
                        teamId: 'team-1',
                    },
                },
                rounds: {
                    create: rounds.map((r, idx) => ({
                        roundNumber: idx + 1,
                        timeLimitSeconds: r.timeLimitSeconds,
                        // eliminateCount is irrelevant for Clan Wars but the
                        // schema column is NOT NULL — store 0.
                        eliminateCount: 0,
                        status: BattleRoundStatus.PENDING,
                    })),
                },
            },
        });

        // Persist SCORE_ATTACK pool if explicit problemIds were provided.
        if (
            format === ClanWarsFormat.SCORE_ATTACK &&
            dto.problemIds &&
            dto.problemIds.length > 0
        ) {
            const poolProblems = await this.prisma.problem.findMany({
                where: { id: { in: dto.problemIds } },
                select: { id: true, difficulty: true },
            });
            await this.prisma.problemPool.create({
                data: {
                    battleId: battle.id,
                    items: {
                        create: poolProblems.map((p) => ({
                            problemId: p.id,
                            pointValue: DIFFICULTY_POINTS[p.difficulty],
                        })),
                    },
                },
            });
        }

        return this.getClanWarsDetails(battle.id);
    }

    /**
     * Generate a unique 8-char alphanumeric invite code for a Clan Wars lobby.
     * Mirrors the same allowed alphabet as BattlesService.generateInviteCode to
     * keep codes interchangeable across modes.
     */
    private async generateInviteCode(): Promise<string> {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const maxAttempts = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const bytes = randomBytes(INVITE_CODE_LENGTH);
            let code = '';
            for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
                code += chars[bytes[i] % chars.length];
            }
            const existing = await this.prisma.battle.findFirst({
                where: {
                    inviteCode: code,
                    status: { not: BattleStatus.COMPLETED },
                },
            });
            if (!existing) {
                return code;
            }
        }
        throw new BadRequestException(
            'Failed to generate unique invite code. Please try again.',
        );
    }

    // ========================================
    // Join
    // ========================================

    /**
     * Join an existing Clan Wars lobby.
     *
     * - Subscription gate
     * - `team` selects 'team-1' or 'team-2'. Each side has `teamSize` slots.
     * - If the selected side has an official clan (`teamXClanId != null`), the
     *   joiner must be a member of that clan.
     * - First joiner to team-2 becomes team-2 captain and can supply labels /
     *   an official clanId via `teamMeta`.
     */
    async joinClanWarsBattle(
        userId: string,
        battleId: string,
        opts: {
            team: 'team-1' | 'team-2';
            viaInvite?: boolean;
            teamMeta?: { name?: string; tag?: string; clanId?: string };
        },
    ) {
        const canPlay = await this.subscriptionsService.canPlay(userId);
        if (!canPlay) {
            throw new ForbiddenException(
                'Daily free game limit reached. Upgrade to Pro for unlimited games.',
            );
        }

        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (battle.mode !== BattleMode.CLAN_WARS) {
            throw new BadRequestException('Battle is not a Clan Wars battle');
        }
        if (battle.status !== BattleStatus.WAITING) {
            throw new BadRequestException('Battle is not accepting new players');
        }
        if (battle.inviteCode && !opts.viaInvite) {
            throw new BadRequestException(
                'This battle requires an invite code to join',
            );
        }
        if (opts.team !== 'team-1' && opts.team !== 'team-2') {
            throw new BadRequestException(
                'team must be either "team-1" or "team-2"',
            );
        }
        if (!battle.teamSize) {
            throw new BadRequestException(
                'Clan Wars battle is missing teamSize',
            );
        }

        // Load the joiner once; clan gate needs their clanId but the capacity
        // + captain TOCTOU fix requires re-reading the battle inside the tx.
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, clanId: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // Resolve optional clan metadata for the team-2 first-joiner case
        // BEFORE entering the tx so that any clan lookup that throws does so
        // outside a transaction.
        const meta = opts.teamMeta ?? {};
        let metaClan: { id: string; name: string; tag: string | null } | null =
            null;
        if (
            opts.team === 'team-2' &&
            !battle.teamTwoClanId &&
            !battle.teamTwoCaptainId &&
            meta.clanId
        ) {
            if (user.clanId !== meta.clanId) {
                throw new ForbiddenException(
                    'You must be a member of the clan you assign to team-2',
                );
            }
            if (meta.clanId === battle.teamOneClanId) {
                throw new BadRequestException(
                    'Team-1 and team-2 cannot be the same clan',
                );
            }
            const clan = await this.prisma.clan.findUnique({
                where: { id: meta.clanId },
                select: { id: true, name: true, tag: true },
            });
            if (!clan) {
                throw new NotFoundException(`Clan ${meta.clanId} not found`);
            }
            metaClan = clan;
        }

        await this.prisma.$transaction(async (tx) => {
            // Re-read battle + participants inside the tx so two callers
            // can't both pass the capacity check against a stale snapshot
            // and end up double-booking a team slot or captain.
            const fresh = await tx.battle.findUnique({
                where: { id: battleId },
                include: { participants: true },
            });
            if (!fresh) {
                throw new NotFoundException(
                    `Battle with ID ${battleId} not found`,
                );
            }
            if (fresh.status !== BattleStatus.WAITING) {
                throw new BadRequestException(
                    'Battle is not accepting new players',
                );
            }
            if (!fresh.teamSize) {
                throw new BadRequestException(
                    'Clan Wars battle is missing teamSize',
                );
            }

            if (fresh.participants.some((p) => p.userId === userId)) {
                throw new BadRequestException(
                    'You are already in this battle',
                );
            }

            const freshTeamMembers = fresh.participants.filter(
                (p) => p.teamId === opts.team,
            );
            if (freshTeamMembers.length >= fresh.teamSize) {
                throw new BadRequestException(
                    `${opts.team} is already full (${freshTeamMembers.length}/${fresh.teamSize})`,
                );
            }

            // Clan gate for official-clan sides (re-check against fresh state
            // in case the battle's team clan was just assigned).
            const sideClanId =
                opts.team === 'team-1'
                    ? fresh.teamOneClanId
                    : fresh.teamTwoClanId;
            if (sideClanId && user.clanId !== sideClanId) {
                throw new ForbiddenException(
                    `You must be a member of the ${opts.team} clan to join this side`,
                );
            }

            // First joiner to team-2 becomes captain. Because we checked
            // inside the tx, only one concurrent joiner can hit this branch.
            const becomesTeam2Captain =
                opts.team === 'team-2' &&
                !fresh.teamTwoCaptainId &&
                freshTeamMembers.length === 0;

            await tx.battleParticipant.create({
                data: {
                    battleId,
                    userId,
                    totalTests: 0,
                    teamId: opts.team,
                },
            });

            if (becomesTeam2Captain) {
                let teamTwoName = fresh.teamTwoName;
                let teamTwoTag = fresh.teamTwoTag;
                let teamTwoClanId = fresh.teamTwoClanId;

                if (metaClan && !teamTwoClanId) {
                    teamTwoClanId = metaClan.id;
                    teamTwoName = teamTwoName ?? metaClan.name;
                    teamTwoTag = teamTwoTag ?? metaClan.tag;
                } else if (meta.name) {
                    teamTwoName = meta.name;
                    if (meta.tag !== undefined) teamTwoTag = meta.tag;
                }

                await tx.battle.update({
                    where: { id: battleId },
                    data: {
                        teamTwoCaptainId: userId,
                        teamTwoName,
                        teamTwoTag,
                        teamTwoClanId,
                    },
                });
            }
        });

        return this.getClanWarsDetails(battleId);
    }

    // ========================================
    // Start
    // ========================================

    /**
     * Called from BattlesService.readyUp when all participants are ready and
     * the mode is CLAN_WARS. Requires both teams to be full.
     */
    async startClanWars(battleId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                rounds: { orderBy: { roundNumber: 'asc' } },
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (battle.mode !== BattleMode.CLAN_WARS) {
            throw new BadRequestException('Battle is not a Clan Wars battle');
        }
        if (battle.status !== BattleStatus.WAITING) {
            throw new BadRequestException('Battle is not in waiting state');
        }
        if (!battle.teamSize) {
            throw new BadRequestException(
                'Clan Wars battle is missing teamSize',
            );
        }

        const team1Count = battle.participants.filter(
            (p) => p.teamId === 'team-1',
        ).length;
        const team2Count = battle.participants.filter(
            (p) => p.teamId === 'team-2',
        ).length;
        if (team1Count !== battle.teamSize || team2Count !== battle.teamSize) {
            throw new BadRequestException(
                `Both teams must be full before starting (team-1: ${team1Count}/${battle.teamSize}, team-2: ${team2Count}/${battle.teamSize})`,
            );
        }

        // Race-safe claim: only one concurrent caller wins the WAITING→
        // IN_PROGRESS flip. The others see count === 0 and no-op, which
        // prevents duplicate startRound calls + duplicate game-count
        // increments if ready-up fires twice on the edge of the transition.
        const claim = await this.prisma.battle.updateMany({
            where: {
                id: battleId,
                status: BattleStatus.WAITING,
                mode: BattleMode.CLAN_WARS,
            },
            data: {
                status: BattleStatus.IN_PROGRESS,
                startedAt: new Date(),
                currentRound: 1,
                isInIntermission: false,
            },
        });
        if (claim.count === 0) {
            // Someone else already started it — nothing to do.
            return;
        }

        try {
            await this.startRound(battleId, 1);
        } catch (err) {
            // Roll back the WAITING→IN_PROGRESS flip so the lobby can be
            // retried instead of being stranded in IN_PROGRESS with no
            // running round.
            await this.prisma.battle.updateMany({
                where: {
                    id: battleId,
                    status: BattleStatus.IN_PROGRESS,
                    currentRound: 1,
                },
                data: {
                    status: BattleStatus.WAITING,
                    startedAt: null,
                    currentRound: 0,
                },
            });
            throw err;
        }

        // Only after the round actually started do we charge daily-game
        // counts; if startRound failed above the players aren't billed.
        for (const p of battle.participants) {
            await this.subscriptionsService.incrementGamesPlayed(p.userId);
        }
    }

    /**
     * Flip a round to IN_PROGRESS, pick a problem for SAME_PROBLEM rounds,
     * schedule the round timer, and broadcast round_start. Also clears the
     * intermission flag in case a previous round ended.
     */
    async startRound(battleId: string, roundNumber: number) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                rounds: { orderBy: { roundNumber: 'asc' } },
                participants: true,
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        const round = battle.rounds.find((r) => r.roundNumber === roundNumber);
        if (!round) {
            throw new NotFoundException(`Round ${roundNumber} not found`);
        }
        if (round.status !== BattleRoundStatus.PENDING) {
            throw new BadRequestException(
                `Round ${roundNumber} is not PENDING (status=${round.status})`,
            );
        }

        // SAME_PROBLEM: pick a problem not yet used in this battle.
        let problemId: string | null = null;
        if (battle.clanWarsFormat === ClanWarsFormat.SAME_PROBLEM) {
            const usedIds = battle.rounds
                .filter((r) => r.problemId)
                .map((r) => r.problemId as string);
            const where: any = usedIds.length ? { id: { notIn: usedIds } } : {};
            const eligibleCount = await this.prisma.problem.count({ where });
            if (eligibleCount === 0) {
                throw new BadRequestException(
                    `No distinct problem available for round ${roundNumber}`,
                );
            }
            const skip = Math.floor(Math.random() * eligibleCount);
            const candidate = await this.prisma.problem.findFirst({
                where,
                skip,
                orderBy: { id: 'asc' },
            });
            if (!candidate) {
                throw new BadRequestException(
                    `No distinct problem available for round ${roundNumber}`,
                );
            }
            problemId = candidate.id;
        }

        const startedAt = new Date();
        await this.prisma.battleRound.update({
            where: { id: round.id },
            data: {
                status: BattleRoundStatus.IN_PROGRESS,
                startedAt,
                problemId,
            },
        });

        // Make sure the intermission flag is cleared and currentRound is set.
        await this.prisma.battle.update({
            where: { id: battleId },
            data: {
                currentRound: roundNumber,
                isInIntermission: false,
            },
        });

        this.gateway.emitClanWarsRoundStart(battleId, {
            battleId,
            roundNumber,
            totalRounds: battle.rounds.length,
            problemId,
            timeLimitSeconds: round.timeLimitSeconds,
            startedAt,
            participantUserIds: battle.participants.map((p) => p.userId),
        });

        this.scheduleRoundTimer(battleId, roundNumber, round.timeLimitSeconds);
    }

    private scheduleRoundTimer(
        battleId: string,
        roundNumber: number,
        timeLimitSeconds: number,
    ) {
        const name = this.timerName(battleId, roundNumber);
        this.clearRoundTimer(battleId, roundNumber);
        const timeout = setTimeout(
            () => {
                void this.handleRoundTimer(battleId, roundNumber).catch((err) =>
                    this.logger.error(
                        `Round timer handler failed for ${name}: ${(err as Error).message}`,
                    ),
                );
            },
            timeLimitSeconds * 1000,
        );
        this.scheduler.addTimeout(name, timeout);
    }

    private timerName(battleId: string, roundNumber: number): string {
        return `clan-wars:${battleId}:${roundNumber}`;
    }

    private clearRoundTimer(battleId: string, roundNumber: number) {
        const name = this.timerName(battleId, roundNumber);
        try {
            if (this.scheduler.doesExist('timeout', name)) {
                this.scheduler.deleteTimeout(name);
            }
        } catch {
            // defensive no-op
        }
    }

    // ========================================
    // Submit
    // ========================================

    /**
     * Submit a solution during a Clan Wars round.
     * - Validates battle/round state and participant eligibility
     * - Validates the problem matches the round (SAME_PROBLEM) or pool (SCORE_ATTACK)
     * - Runs code and upserts the submission (keeping best per user+problem)
     * - Emits team standings
     * - May end the round early for SAME_PROBLEM when one team fully sweeps
     */
    async submitClanWarsRound(
        battleId: string,
        userId: string,
        code: string,
        language: string,
        problemId?: string,
    ): Promise<SubmissionResult> {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                rounds: { orderBy: { roundNumber: 'asc' } },
                problemPool: { include: { items: true } },
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (battle.mode !== BattleMode.CLAN_WARS) {
            throw new BadRequestException('Battle is not a Clan Wars battle');
        }
        if (battle.status !== BattleStatus.IN_PROGRESS) {
            throw new BadRequestException('Battle is not in progress');
        }
        if (battle.isInIntermission) {
            throw new BadRequestException(
                'Battle is currently in intermission between rounds',
            );
        }

        const participant = battle.participants.find((p) => p.userId === userId);
        if (!participant) {
            throw new ForbiddenException(
                'You are not a participant in this battle',
            );
        }

        const round = battle.rounds.find(
            (r) => r.status === BattleRoundStatus.IN_PROGRESS,
        );
        if (!round) {
            throw new BadRequestException('No round is currently in progress');
        }

        // Resolve target problem + potential point value
        let targetProblemId: string;
        let pointsIfAllPassed = 0;
        if (battle.clanWarsFormat === ClanWarsFormat.SAME_PROBLEM) {
            if (!round.problemId) {
                throw new BadRequestException(
                    'Round is missing a problem — internal state error',
                );
            }
            if (problemId && problemId !== round.problemId) {
                throw new BadRequestException(
                    'Submitted problemId does not match the current round problem',
                );
            }
            targetProblemId = round.problemId;
            pointsIfAllPassed = 0;
        } else {
            // SCORE_ATTACK
            if (!problemId) {
                throw new BadRequestException(
                    'problemId is required for SCORE_ATTACK submissions',
                );
            }
            if (!battle.problemPool) {
                const exists = await this.prisma.problem.findUnique({
                    where: { id: problemId },
                    select: { id: true, difficulty: true },
                });
                if (!exists) {
                    throw new BadRequestException('Problem not found');
                }
                targetProblemId = exists.id;
                pointsIfAllPassed = DIFFICULTY_POINTS[exists.difficulty];
            } else {
                const item = battle.problemPool.items.find(
                    (i) => i.problemId === problemId,
                );
                if (!item) {
                    throw new BadRequestException(
                        'Problem is not part of the SCORE_ATTACK pool',
                    );
                }
                targetProblemId = item.problemId;
                pointsIfAllPassed = item.pointValue;
            }
        }

        const execResult = await this.codeExecutionService.executeCode(
            targetProblemId,
            code,
            language,
        );
        const pointsEarned = execResult.allPassed ? pointsIfAllPassed : 0;

        // Upsert-best submission (same semantics as BR). Participant points are
        // incremented only by the delta.
        const existing = await this.prisma.battleRoundSubmission.findUnique({
            where: {
                roundId_userId_problemId: {
                    roundId: round.id,
                    userId,
                    problemId: targetProblemId,
                },
            },
        });

        let pointsDelta = 0;
        if (!existing) {
            await this.prisma.battleRoundSubmission.create({
                data: {
                    roundId: round.id,
                    userId,
                    problemId: targetProblemId,
                    code,
                    language,
                    testsPassed: execResult.passed,
                    totalTests: execResult.total,
                    allPassed: execResult.allPassed,
                    pointsEarned,
                },
            });
            pointsDelta = pointsEarned;
        } else {
            const isImprovement =
                pointsEarned > existing.pointsEarned ||
                (pointsEarned === existing.pointsEarned &&
                    execResult.allPassed &&
                    !existing.allPassed) ||
                (pointsEarned === existing.pointsEarned &&
                    execResult.allPassed === existing.allPassed &&
                    execResult.passed > existing.testsPassed);
            if (isImprovement) {
                await this.prisma.battleRoundSubmission.update({
                    where: { id: existing.id },
                    data: {
                        code,
                        language,
                        testsPassed: execResult.passed,
                        totalTests: execResult.total,
                        allPassed: execResult.allPassed,
                        pointsEarned,
                        submittedAt: new Date(),
                    },
                });
                pointsDelta = pointsEarned - existing.pointsEarned;
            }
        }

        // Participant row shows the player's LATEST code/language/submittedAt
        // (so the UI can restore their editor) but tracks BEST
        // testsPassed/totalTests across attempts. This prevents a later,
        // worse submission from regressing the team-standings display (and
        // the SAME_PROBLEM round-tiebreak that reads participant.testsPassed).
        const bestTestsPassed = Math.max(
            participant.testsPassed ?? 0,
            execResult.passed,
        );
        const bestTotalTests = Math.max(
            participant.totalTests ?? 0,
            execResult.total,
        );
        await this.prisma.battleParticipant.update({
            where: { id: participant.id },
            data: {
                code,
                language,
                testsPassed: bestTestsPassed,
                totalTests: bestTotalTests,
                submittedAt: new Date(),
                pointsEarned: { increment: pointsDelta },
            },
        });

        const standings = await this.getTeamStandings(battleId);
        this.gateway.emitClanWarsTeamStandings(battleId, {
            battleId,
            roundNumber: round.roundNumber,
            teams: standings,
        });

        await this.evaluateRoundEnd(battleId, round.id);

        return {
            testsPassed: execResult.passed,
            totalTests: execResult.total,
            allPassed: execResult.allPassed,
            pointsAwarded: pointsEarned,
            results: execResult.results.map((r) => ({
                testCaseId: r.testCaseId,
                passed: r.passed,
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
                error: r.error,
            })),
        };
    }

    // ========================================
    // Round end evaluation / advancement
    // ========================================

    /**
     * Called after each submission. For SAME_PROBLEM only: ends the round
     * early when every alive member of either team has an allPassed=true
     * submission for the round problem (team sweep). SCORE_ATTACK relies on
     * the timer.
     */
    async evaluateRoundEnd(battleId: string, roundId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true, rounds: true },
        });
        if (!battle) return;
        if (battle.status !== BattleStatus.IN_PROGRESS) return;
        if (battle.clanWarsFormat !== ClanWarsFormat.SAME_PROBLEM) return;

        const round = battle.rounds.find((r) => r.id === roundId);
        if (!round || round.status !== BattleRoundStatus.IN_PROGRESS) return;

        const team1 = battle.participants.filter((p) => p.teamId === 'team-1');
        const team2 = battle.participants.filter((p) => p.teamId === 'team-2');
        if (team1.length === 0 || team2.length === 0) return;

        const passed = await this.prisma.battleRoundSubmission.findMany({
            where: { roundId, allPassed: true },
            select: { userId: true },
        });
        const passedIds = new Set(passed.map((s) => s.userId));

        const team1Sweep = team1.every((p) => passedIds.has(p.userId));
        const team2Sweep = team2.every((p) => passedIds.has(p.userId));

        if (team1Sweep || team2Sweep) {
            await this.endRoundAndAdvance(
                battleId,
                roundId,
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );
        }
    }

    /**
     * SchedulerRegistry callback. If the round is still IN_PROGRESS, ends it
     * with reason = TIMER. Otherwise no-op (race-safe with early end).
     */
    async handleRoundTimer(battleId: string, roundNumber: number) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { rounds: true },
        });
        if (!battle) return;
        if (battle.status !== BattleStatus.IN_PROGRESS) return;
        const round = battle.rounds.find((r) => r.roundNumber === roundNumber);
        if (!round) return;
        if (round.status !== BattleRoundStatus.IN_PROGRESS) return;

        await this.endRoundAndAdvance(
            battleId,
            round.id,
            BattleRoundEndReason.TIMER,
        );
    }

    /**
     * Atomically:
     *  1. Race-safely flip the round PENDING/IN_PROGRESS → COMPLETED.
     *  2. Clear the round timer.
     *  3. Emit clan_wars.round_end with the latest team standings.
     *  4. If more rounds remain, enter intermission (strict ready-up).
     *     If the final round just ended, call finalizeClanWars.
     */
    async endRoundAndAdvance(
        battleId: string,
        roundId: string,
        reason: BattleRoundEndReason,
    ) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                rounds: { orderBy: { roundNumber: 'asc' } },
                participants: true,
            },
        });
        if (!battle) return;
        const round = battle.rounds.find((r) => r.id === roundId);
        if (!round) return;
        if (round.status === BattleRoundStatus.COMPLETED) return;

        // Race-safe: only one caller wins the conditional flip.
        const wonRace = await this.prisma.$transaction(async (tx) => {
            const flip = await tx.battleRound.updateMany({
                where: {
                    id: round.id,
                    status: { not: BattleRoundStatus.COMPLETED },
                },
                data: {
                    status: BattleRoundStatus.COMPLETED,
                    endedAt: new Date(),
                    endedReason: reason,
                },
            });
            return flip.count > 0;
        });
        if (!wonRace) return;

        this.clearRoundTimer(battleId, round.roundNumber);

        const standings = await this.getTeamStandings(battleId);
        const roundWinner = this.pickRoundWinner(standings);
        this.gateway.emitClanWarsRoundEnd(battleId, {
            battleId,
            roundNumber: round.roundNumber,
            endedReason: reason,
            roundWinner,
            teams: standings,
        });

        const nextRound = battle.rounds.find(
            (r) => r.roundNumber === round.roundNumber + 1,
        );
        if (!nextRound) {
            await this.finalizeClanWars(battleId);
            return;
        }

        await this.enterIntermission(battleId, round.roundNumber, nextRound.roundNumber);
    }

    /**
     * Pick the round winner based on format-specific rules.
     *
     * SAME_PROBLEM: whichever team has more distinct `allPassed=true`
     *   submissions (the team member count). Tie → null.
     * SCORE_ATTACK: whichever team earned more `roundPoints`. Tie → null.
     */
    private pickRoundWinner(
        standings: ClanWarsTeamStanding[],
    ): 'team-1' | 'team-2' | null {
        const t1 = standings.find((s) => s.team === 'team-1');
        const t2 = standings.find((s) => s.team === 'team-2');
        if (!t1 || !t2) return null;
        if (t1.roundPoints > t2.roundPoints) return 'team-1';
        if (t2.roundPoints > t1.roundPoints) return 'team-2';
        // For SAME_PROBLEM roundPoints is always 0, so fall through to the
        // tests-passed signal as a coarse tie-break at the round level.
        if (t1.testsPassed > t2.testsPassed) return 'team-1';
        if (t2.testsPassed > t1.testsPassed) return 'team-2';
        return null;
    }

    // ========================================
    // Intermission (strict ready-up between rounds)
    // ========================================

    /**
     * Transition the battle into an intermission between rounds.
     * Resets every participant's `isReady` flag and sets
     * `isInIntermission = true`. Emits `clan_wars.round_intermission`.
     *
     * There is NO auto-advance timer. The next round only starts once every
     * participant has readied up (see `readyForNextRound`).
     */
    async enterIntermission(
        battleId: string,
        justEndedRound: number,
        nextRoundNumber: number,
    ) {
        await this.prisma.$transaction(async (tx) => {
            await tx.battleParticipant.updateMany({
                where: { battleId },
                data: { isReady: false },
            });
            await tx.battle.update({
                where: { id: battleId },
                data: { isInIntermission: true },
            });
        });

        this.gateway.emitClanWarsRoundIntermission(battleId, {
            battleId,
            justEndedRound,
            nextRoundNumber,
            readyUserIds: [],
        });
    }

    /**
     * Mark a participant ready for the next round. When every participant is
     * ready, atomically clear `isInIntermission` and start the next round
     * exactly once (race-safe via a conditional `updateMany`).
     *
     * @returns `{ allReady }` — whether the next round was triggered.
     */
    async readyForNextRound(battleId: string, userId: string) {
        const { allReady, nextRoundNumber } = await this.prisma.$transaction(
            async (tx) => {
                const battle = await tx.battle.findUnique({
                    where: { id: battleId },
                    include: { participants: true },
                });
                if (!battle) {
                    throw new NotFoundException(
                        `Battle with ID ${battleId} not found`,
                    );
                }
                if (battle.mode !== BattleMode.CLAN_WARS) {
                    throw new BadRequestException(
                        'Battle is not a Clan Wars battle',
                    );
                }
                if (battle.status !== BattleStatus.IN_PROGRESS) {
                    throw new BadRequestException(
                        'Battle is not in progress',
                    );
                }
                if (!battle.isInIntermission) {
                    throw new BadRequestException(
                        'Battle is not currently in intermission',
                    );
                }
                const participant = battle.participants.find(
                    (p) => p.userId === userId,
                );
                if (!participant) {
                    throw new ForbiddenException(
                        'You are not a participant in this battle',
                    );
                }
                if (participant.isReady) {
                    throw new BadRequestException(
                        'You are already ready for the next round',
                    );
                }

                await tx.battleParticipant.update({
                    where: { id: participant.id },
                    data: { isReady: true },
                });

                // Re-read participants INSIDE the tx so concurrent callers
                // don't each see a stale "other player not ready" snapshot
                // and both return allReady=false (stranding the battle).
                const freshParticipants = await tx.battleParticipant.findMany({
                    where: { battleId },
                    select: { userId: true, isReady: true },
                });
                const allParticipantsReady = freshParticipants.every(
                    (p) => p.isReady,
                );

                const nextRoundNumber = battle.currentRound + 1;
                let allReady = false;

                if (allParticipantsReady) {
                    // Race-safe flip: only one caller clears intermission.
                    const flip = await tx.battle.updateMany({
                        where: {
                            id: battleId,
                            isInIntermission: true,
                            currentRound: battle.currentRound,
                        },
                        data: {
                            isInIntermission: false,
                            currentRound: nextRoundNumber,
                        },
                    });
                    allReady = flip.count > 0;
                }

                return { allReady, nextRoundNumber };
            },
        );

        // Re-read participants to include the fresh isReady state in the
        // broadcast payload.
        const fresh = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
        });
        const readyUserIds =
            fresh?.participants.filter((p) => p.isReady).map((p) => p.userId) ??
            [];

        this.gateway.emitClanWarsPlayerReadyNextRound(battleId, {
            battleId,
            userId,
            nextRoundNumber,
            readyUserIds,
            allReady,
        });

        if (allReady) {
            await this.startRound(battleId, nextRoundNumber);
        }

        return { allReady };
    }

    /**
     * Unmark a participant's ready status during intermission. Fails if the
     * intermission has already resolved (all-ready flip has fired).
     */
    async unreadyForNextRound(battleId: string, userId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (battle.mode !== BattleMode.CLAN_WARS) {
            throw new BadRequestException('Battle is not a Clan Wars battle');
        }
        if (battle.status !== BattleStatus.IN_PROGRESS) {
            throw new BadRequestException('Battle is not in progress');
        }
        if (!battle.isInIntermission) {
            throw new BadRequestException(
                'Battle is not currently in intermission',
            );
        }
        const participant = battle.participants.find((p) => p.userId === userId);
        if (!participant) {
            throw new ForbiddenException(
                'You are not a participant in this battle',
            );
        }
        if (!participant.isReady) {
            throw new BadRequestException(
                'You are not currently ready for the next round',
            );
        }

        await this.prisma.battleParticipant.update({
            where: { id: participant.id },
            data: { isReady: false },
        });

        const fresh = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
        });
        const readyUserIds =
            fresh?.participants.filter((p) => p.isReady).map((p) => p.userId) ??
            [];
        const nextRoundNumber = (fresh?.currentRound ?? battle.currentRound) + 1;

        this.gateway.emitClanWarsPlayerReadyNextRound(battleId, {
            battleId,
            userId,
            nextRoundNumber,
            readyUserIds,
            allReady: false,
        });
    }

    // ========================================
    // Finalize + MMR
    // ========================================

    /**
     * Determine the winning team by cumulative team score. Tie-break order:
     *  1. More rounds won.
     *  2. Earliest lastSubmittedAt.
     *  3. 'team-1'.
     *
     * Then apply clan MMR (for official-clan teams only) and per-user MMR
     * subject to the PRO/trial gate. Emits `battle.completed`.
     */
    async finalizeClanWars(battleId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
        });
        if (!battle) return;
        if (battle.status === BattleStatus.COMPLETED) return;

        const standings = await this.getTeamStandings(battleId);
        const t1 = standings.find((s) => s.team === 'team-1');
        const t2 = standings.find((s) => s.team === 'team-2');
        let winningTeam: 'team-1' | 'team-2' | null = null;
        if (t1 && t2) {
            if (t1.cumulativePoints !== t2.cumulativePoints) {
                winningTeam =
                    t1.cumulativePoints > t2.cumulativePoints
                        ? 'team-1'
                        : 'team-2';
            } else if (t1.roundsWon !== t2.roundsWon) {
                winningTeam = t1.roundsWon > t2.roundsWon ? 'team-1' : 'team-2';
            } else if (t1.lastSubmittedAt && t2.lastSubmittedAt) {
                winningTeam =
                    t1.lastSubmittedAt <= t2.lastSubmittedAt
                        ? 'team-1'
                        : 'team-2';
            } else if (t1.lastSubmittedAt && !t2.lastSubmittedAt) {
                winningTeam = 'team-1';
            } else if (!t1.lastSubmittedAt && t2.lastSubmittedAt) {
                winningTeam = 'team-2';
            } else {
                winningTeam = 'team-1';
            }
        }

        await this.prisma.battle.update({
            where: { id: battleId },
            data: {
                status: BattleStatus.COMPLETED,
                winnerId: null,
                winningTeam,
                endedAt: new Date(),
                isInIntermission: false,
            },
        });

        await this.applyClanWarsMmr(battleId, winningTeam);

        const finalBattle = await this.getClanWarsDetails(battleId);
        this.gateway.emitBattleCompleted(battleId, finalBattle);
    }

    /**
     * Pair-wise Elo between team-1 and team-2 using their average MMR as the
     * team rating. Each winner member gets +change, each loser -change,
     * subject to the same PRO/trial gate as other modes.
     *
     * For official-clan teams (teamXClanId != null): bump clan MMR by
     * ±CLAN_MMR_CHANGE and wins/losses++. Temp-clan teams skip clan persistence.
     */
    async applyClanWarsMmr(
        battleId: string,
        winningTeam: 'team-1' | 'team-2' | null,
    ) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: { include: { user: true } },
            },
        });
        if (!battle) return;

        const team1 = battle.participants.filter((p) => p.teamId === 'team-1');
        const team2 = battle.participants.filter((p) => p.teamId === 'team-2');

        const avg = (xs: { user: { mmr: number } }[]) =>
            xs.length === 0
                ? 0
                : xs.reduce((s, p) => s + p.user.mmr, 0) / xs.length;
        const R1 = avg(team1);
        const R2 = avg(team2);
        const E1 = 1 / (1 + Math.pow(10, (R2 - R1) / 400));

        let S1: number;
        if (winningTeam === null) S1 = 0.5;
        else S1 = winningTeam === 'team-1' ? 1 : 0;

        const team1Delta = Math.round(ELO_K_FACTOR * (S1 - E1));
        const team2Delta = -team1Delta;

        const applyTeam = async (
            members: typeof team1,
            delta: number,
            isWinner: boolean,
        ) => {
            for (const p of members) {
                const hasProAccess =
                    p.user.subscriptionTier === 'PRO' ||
                    (p.user.trialEndsAt &&
                        new Date(p.user.trialEndsAt) > new Date());
                await this.prisma.battleParticipant.update({
                    where: { id: p.id },
                    data: { mmrChange: hasProAccess ? delta : 0 },
                });
                if (hasProAccess) {
                    const newMmr = Math.max(MIN_MMR, p.user.mmr + delta);
                    await this.prisma.user.update({
                        where: { id: p.userId },
                        data: {
                            mmr: newMmr,
                            wins: isWinner ? { increment: 1 } : undefined,
                            losses:
                                !isWinner && winningTeam !== null
                                    ? { increment: 1 }
                                    : undefined,
                        },
                    });
                    try {
                        await this.seasonsService.updatePeakMmr(p.userId, newMmr);
                        if (winningTeam !== null) {
                            await this.seasonsService.incrementSeasonStats(
                                p.userId,
                                isWinner,
                            );
                        }
                    } catch (err) {
                        this.logger.warn(
                            `Season update failed for ${p.userId}: ${(err as Error).message}`,
                        );
                    }
                }
            }
        };

        const team1Won = winningTeam === 'team-1';
        const team2Won = winningTeam === 'team-2';
        await applyTeam(team1, team1Delta, team1Won);
        await applyTeam(team2, team2Delta, team2Won);

        // Clan persistence gate — only for official clans. We read-then-write
        // the clan row so we can floor the resulting MMR at MIN_MMR (the
        // same floor user MMR uses). `{ increment }` alone would let clan
        // MMR go negative which is not a valid state for leaderboards.
        const updateClan = async (
            clanId: string,
            delta: number,
            isWinner: boolean,
            isLoser: boolean,
        ) => {
            const clan = await this.prisma.clan.findUnique({
                where: { id: clanId },
                select: { mmr: true },
            });
            if (!clan) return;
            const newMmr = Math.max(MIN_MMR, clan.mmr + delta);
            await this.prisma.clan.update({
                where: { id: clanId },
                data: {
                    mmr: newMmr,
                    wins: isWinner ? { increment: 1 } : undefined,
                    losses: isLoser ? { increment: 1 } : undefined,
                },
            });
        };

        if (battle.teamOneClanId) {
            const delta = team1Won
                ? CLAN_MMR_CHANGE
                : team2Won
                    ? -CLAN_MMR_CHANGE
                    : 0;
            await updateClan(battle.teamOneClanId, delta, team1Won, team2Won);
        }
        if (battle.teamTwoClanId) {
            const delta = team2Won
                ? CLAN_MMR_CHANGE
                : team1Won
                    ? -CLAN_MMR_CHANGE
                    : 0;
            await updateClan(battle.teamTwoClanId, delta, team2Won, team1Won);
        }
    }

    // ========================================
    // Read models
    // ========================================

    /**
     * Compute per-team standings including cumulative points, current-round
     * points, tests-passed totals, and round-win counts (for tie-breaks).
     */
    async getTeamStandings(battleId: string): Promise<ClanWarsTeamStanding[]> {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatarUrl: true,
                                mmr: true,
                            },
                        },
                    },
                },
                rounds: { orderBy: { roundNumber: 'asc' } },
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (battle.mode !== BattleMode.CLAN_WARS) {
            throw new BadRequestException('Battle is not a Clan Wars battle');
        }

        const allSubs = await this.prisma.battleRoundSubmission.findMany({
            where: { round: { battleId } },
            select: {
                userId: true,
                pointsEarned: true,
                testsPassed: true,
                allPassed: true,
                submittedAt: true,
                roundId: true,
            },
        });

        const currentRound = battle.rounds.find(
            (r) => r.status === BattleRoundStatus.IN_PROGRESS,
        );

        // Per-user aggregations across the whole battle
        const cumByUser = new Map<
            string,
            { points: number; lastSubmittedAt: Date | null }
        >();
        const roundPtsByUser = new Map<string, number>();
        for (const s of allSubs) {
            const cur = cumByUser.get(s.userId) || {
                points: 0,
                lastSubmittedAt: null,
            };
            cur.points += s.pointsEarned;
            if (!cur.lastSubmittedAt || s.submittedAt > cur.lastSubmittedAt) {
                cur.lastSubmittedAt = s.submittedAt;
            }
            cumByUser.set(s.userId, cur);
            if (currentRound && s.roundId === currentRound.id) {
                roundPtsByUser.set(
                    s.userId,
                    (roundPtsByUser.get(s.userId) || 0) + s.pointsEarned,
                );
            }
        }

        // Round wins per team (for tie-breaks). Uses same format-specific
        // rules as pickRoundWinner but evaluated per completed round.
        const team1Ids = new Set(
            battle.participants
                .filter((p) => p.teamId === 'team-1')
                .map((p) => p.userId),
        );
        const team2Ids = new Set(
            battle.participants
                .filter((p) => p.teamId === 'team-2')
                .map((p) => p.userId),
        );
        let team1RoundsWon = 0;
        let team2RoundsWon = 0;
        for (const r of battle.rounds) {
            if (r.status !== BattleRoundStatus.COMPLETED) continue;
            const roundSubs = allSubs.filter((s) => s.roundId === r.id);
            let t1 = 0;
            let t2 = 0;
            if (battle.clanWarsFormat === ClanWarsFormat.SAME_PROBLEM) {
                // Count distinct passing members per team
                const passingIds = new Set(
                    roundSubs.filter((s) => s.allPassed).map((s) => s.userId),
                );
                for (const id of passingIds) {
                    if (team1Ids.has(id)) t1++;
                    else if (team2Ids.has(id)) t2++;
                }
            } else {
                for (const s of roundSubs) {
                    if (team1Ids.has(s.userId)) t1 += s.pointsEarned;
                    else if (team2Ids.has(s.userId)) t2 += s.pointsEarned;
                }
            }
            if (t1 > t2) team1RoundsWon++;
            else if (t2 > t1) team2RoundsWon++;
        }

        const buildTeam = (
            team: 'team-1' | 'team-2',
            name: string,
            tag: string | null,
            clanId: string | null,
            captainId: string | null,
            roundsWon: number,
        ): ClanWarsTeamStanding => {
            const members = battle.participants.filter(
                (p) => p.teamId === team,
            );
            const memberStandings: ClanWarsTeamMemberStanding[] = members.map(
                (p) => {
                    const cum = cumByUser.get(p.userId) || {
                        points: 0,
                        lastSubmittedAt: null,
                    };
                    return {
                        userId: p.userId,
                        username: p.user.username,
                        avatarUrl: p.user.avatarUrl,
                        mmr: p.user.mmr,
                        tier: getRankTier(p.user.mmr),
                        cumulativePoints: cum.points,
                        roundPoints: roundPtsByUser.get(p.userId) || 0,
                        testsPassed: p.testsPassed,
                        totalTests: p.totalTests,
                        isReady: p.isReady,
                        lastSubmittedAt: cum.lastSubmittedAt,
                    };
                },
            );
            const cumulativePoints = memberStandings.reduce(
                (s, m) => s + m.cumulativePoints,
                0,
            );
            const roundPoints = memberStandings.reduce(
                (s, m) => s + m.roundPoints,
                0,
            );
            const testsPassed = memberStandings.reduce(
                (s, m) => s + m.testsPassed,
                0,
            );
            const totalTests = memberStandings.reduce(
                (s, m) => s + m.totalTests,
                0,
            );
            const lastSubmittedAt = memberStandings.reduce<Date | null>(
                (acc, m) =>
                    m.lastSubmittedAt &&
                        (!acc || m.lastSubmittedAt > acc)
                        ? m.lastSubmittedAt
                        : acc,
                null,
            );
            return {
                team,
                clanId,
                name,
                tag,
                captainId,
                cumulativePoints,
                roundPoints,
                roundsWon,
                testsPassed,
                totalTests,
                lastSubmittedAt,
                members: memberStandings,
            };
        };

        return [
            buildTeam(
                'team-1',
                battle.teamOneName || 'Team 1',
                battle.teamOneTag,
                battle.teamOneClanId,
                battle.teamOneCaptainId,
                team1RoundsWon,
            ),
            buildTeam(
                'team-2',
                battle.teamTwoName || 'Team 2',
                battle.teamTwoTag,
                battle.teamTwoClanId,
                battle.teamTwoCaptainId,
                team2RoundsWon,
            ),
        ];
    }

    /**
     * Full Clan Wars battle details: base battle row + participants + rounds.
     */
    async getClanWarsDetails(battleId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatarUrl: true,
                                mmr: true,
                                clan: {
                                    select: { id: true, tag: true, name: true },
                                },
                            },
                        },
                    },
                },
                rounds: { orderBy: { roundNumber: 'asc' } },
                problem: {
                    select: { id: true, title: true, difficulty: true },
                },
                problemPool: {
                    include: {
                        items: {
                            include: {
                                problem: {
                                    select: {
                                        id: true,
                                        title: true,
                                        difficulty: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        return {
            ...battle,
            participants: battle.participants.map((p) => ({
                ...p,
                user: {
                    ...p.user,
                    tier: getRankTier(p.user.mmr),
                },
            })),
        };
    }
}
