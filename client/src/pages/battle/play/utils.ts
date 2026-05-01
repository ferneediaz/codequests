import type { RoundConfig } from '@/types/api';
import {
    BR_MAX_PLAYERS,
    BR_MAX_ROUND_SECONDS,
    BR_MIN_PLAYERS,
    BR_MIN_ROUNDS,
    BR_MIN_ROUND_SECONDS,
    CW_MAX_ROUND_SECONDS,
    CW_MAX_TEAM_SIZE,
    CW_MIN_ROUND_SECONDS,
    CW_MIN_TEAM_SIZE,
} from './constants';

export interface RoyaleValidationError {
    roundIndex?: number;
    message: string;
}

/**
 * Build a sensible default round list for a given lobby size that satisfies
 * server constraints: rounds.length >= 2, sum(eliminateCount) === maxPlayers-1,
 * last round eliminateCount === 1, no over-elimination.
 *
 * Strategy: front-load eliminations so the list fits in a small number of rounds
 * (3 rounds for most sizes), always finishing with a 1v1 round.
 */
export function buildDefaultRounds(maxPlayers: number): RoundConfig[] {
    const totalToEliminate = Math.max(0, maxPlayers - 1);
    if (totalToEliminate <= 1) {
        // maxPlayers === 2 is not allowed server-side, but if a caller ever
        // passes one through, fall back to a still-valid 2-round skeleton.
        return [
            { timeLimitSeconds: 300, eliminateCount: 0 },
            { timeLimitSeconds: 300, eliminateCount: 1 },
        ];
    }

    if (maxPlayers === 3) {
        return [
            { timeLimitSeconds: 300, eliminateCount: 1 },
            { timeLimitSeconds: 300, eliminateCount: 1 },
        ];
    }

    const preFinal = totalToEliminate - 1;
    const r1 = Math.ceil(preFinal / 2);
    const r2 = preFinal - r1;
    return [
        { timeLimitSeconds: 300, eliminateCount: r1 },
        { timeLimitSeconds: 300, eliminateCount: r2 },
        { timeLimitSeconds: 300, eliminateCount: 1 },
    ];
}

/**
 * Pure client-side validation that mirrors server `validateConfig` in
 * `battle-royale.service.ts`. Returns an empty array when the config is valid.
 */
export function validateRoyaleConfig(cfg: {
    maxPlayers: number;
    rounds: RoundConfig[];
}): RoyaleValidationError[] {
    const errors: RoyaleValidationError[] = [];
    const { maxPlayers, rounds } = cfg;

    if (
        !Number.isInteger(maxPlayers) ||
        maxPlayers < BR_MIN_PLAYERS ||
        maxPlayers > BR_MAX_PLAYERS
    ) {
        errors.push({
            message: `Lobby size must be an integer between ${BR_MIN_PLAYERS} and ${BR_MAX_PLAYERS}.`,
        });
    }

    if (!rounds || rounds.length < BR_MIN_ROUNDS) {
        errors.push({
            message: `Battle Royale requires at least ${BR_MIN_ROUNDS} rounds and must end with a 1v1 finale.`,
        });
    }

    if (rounds && rounds.length > Math.max(0, maxPlayers - 1)) {
        errors.push({
            message: `Too many rounds (${rounds.length}) for a ${maxPlayers}-player lobby. Maximum is ${maxPlayers - 1}.`,
        });
    }

    let sum = 0;
    let remaining = maxPlayers;
    rounds?.forEach((r, i) => {
        if (!Number.isInteger(r.timeLimitSeconds)) {
            errors.push({
                roundIndex: i,
                message: `Round ${i + 1}: time must be a whole number of seconds.`,
            });
        }
        if (
            r.timeLimitSeconds < BR_MIN_ROUND_SECONDS ||
            r.timeLimitSeconds > BR_MAX_ROUND_SECONDS
        ) {
            errors.push({
                roundIndex: i,
                message: `Round ${i + 1}: time must be between ${BR_MIN_ROUND_SECONDS}s and ${BR_MAX_ROUND_SECONDS}s.`,
            });
        }
        if (!Number.isInteger(r.eliminateCount) || r.eliminateCount < 0) {
            errors.push({
                roundIndex: i,
                message: `Round ${i + 1}: eliminations must be a non-negative whole number.`,
            });
        }
        sum += r.eliminateCount;
        remaining -= r.eliminateCount;
        if (remaining < 1) {
            errors.push({
                roundIndex: i,
                message: `Round ${i + 1}: over-elimination — no players would remain after this round.`,
            });
        }
    });

    if (rounds && rounds.length >= 1 && sum !== maxPlayers - 1) {
        errors.push({
            message: `Total eliminations (${sum}) must equal lobby size − 1 (${maxPlayers - 1}).`,
        });
    }

    if (
        rounds &&
        rounds.length >= 1 &&
        rounds[rounds.length - 1].eliminateCount !== 1
    ) {
        errors.push({
            message:
                'The final round must eliminate exactly 1 player (1v1 finale).',
        });
    }

    return errors;
}

/**
 * Compute remaining-players progression for the round builder UI.
 * Returns an array aligned with `rounds` where each entry is the number of
 * players that START that round.
 */
export function computeRoyaleProgression(
    rounds: RoundConfig[],
    maxPlayers: number,
): number[] {
    const out: number[] = [];
    let remaining = maxPlayers;
    for (const r of rounds) {
        out.push(remaining);
        remaining = Math.max(0, remaining - (r.eliminateCount || 0));
    }
    return out;
}

export function formatSeconds(n: number): string {
    if (!Number.isFinite(n) || n < 0) return '—';
    if (n < 60) return `${n}s`;
    const m = Math.floor(n / 60);
    const s = n % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export function buildDefaultClanWarRounds(): { timeLimitSeconds: number }[] {
    return [
        { timeLimitSeconds: 300 },
        { timeLimitSeconds: 300 },
        { timeLimitSeconds: 300 },
    ];
}

export function validateClanWarsConfig(cfg: {
    teamSize: number;
    rounds: { timeLimitSeconds: number }[];
}): string[] {
    const errors: string[] = [];
    if (
        !Number.isInteger(cfg.teamSize) ||
        cfg.teamSize < CW_MIN_TEAM_SIZE ||
        cfg.teamSize > CW_MAX_TEAM_SIZE
    ) {
        errors.push(
            `Team size must be between ${CW_MIN_TEAM_SIZE} and ${CW_MAX_TEAM_SIZE}.`,
        );
    }
    if (!cfg.rounds.length) {
        errors.push('At least one round is required.');
    }
    cfg.rounds.forEach((r, i) => {
        if (!Number.isInteger(r.timeLimitSeconds)) {
            errors.push(`Round ${i + 1}: time must be a whole number.`);
            return;
        }
        if (
            r.timeLimitSeconds < CW_MIN_ROUND_SECONDS ||
            r.timeLimitSeconds > CW_MAX_ROUND_SECONDS
        ) {
            errors.push(
                `Round ${i + 1}: time must be between ${CW_MIN_ROUND_SECONDS}s and ${CW_MAX_ROUND_SECONDS}s.`,
            );
        }
    });
    return errors;
}
