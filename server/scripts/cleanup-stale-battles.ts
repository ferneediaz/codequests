/// <reference types="node" />

/**
 * One-shot repair script for battles that are already stale in the database.
 *
 * Run modes:
 *   ts-node server/scripts/cleanup-stale-battles.ts          # dry-run (default)
 *   ts-node server/scripts/cleanup-stale-battles.ts --apply  # actually update
 *
 * Optional filters:
 *   --user-id=<uuid>        scope to a single user's battles
 *   --username=<name>       scope to a single user's battles (by username)
 *
 * This mirrors BattlesService.cleanupStaleBattles() but runs outside Nest so
 * it doesn't require booting the app. It intentionally uses the simplest safe
 * transition — mark the battle COMPLETED with no winner and endedAt=now —
 * because the battles in question were abandoned; nobody earned MMR and no
 * one submitted a valid winning solution. Going forward, the in-process
 * @Interval sweep will catch new rows in real time.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { BattleMode, BattleStatus, PrismaClient } from '@prisma/client';

const BATTLE_EXPIRY_GRACE_MS = 30_000; // must match BattlesService
const WAITING_PUBLIC_TTL_MS = 15 * 60 * 1000; // must match BattlesService

function loadLocalEnv() {
    const envPath = existsSync(resolve(process.cwd(), '.env'))
        ? resolve(process.cwd(), '.env')
        : resolve(__dirname, '../.env');
    if (!existsSync(envPath)) return;

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;

        const key = trimmed.slice(0, eq).trim();
        const rawValue = trimmed.slice(eq + 1).trim();
        if (!key || process.env[key] != null) continue;

        process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
}

function getArgValue(name: string): string | undefined {
    const prefix = `${name}=`;
    return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
    loadLocalEnv();

    const apply = process.argv.includes('--apply');
    const userIdArg = getArgValue('--user-id');
    const usernameArg = getArgValue('--username');
    const prisma = new PrismaClient();

    try {
        let scopedUserId = userIdArg;
        if (!scopedUserId && usernameArg) {
            const user = await prisma.user.findUnique({
                where: { username: usernameArg },
                select: { id: true },
            });
            if (!user) {
                console.error(`User "${usernameArg}" not found.`);
                process.exit(1);
            }
            scopedUserId = user.id;
        }

        const userScope = scopedUserId
            ? { participants: { some: { userId: scopedUserId } } }
            : {};

        // 1. Expired IN_PROGRESS battles.
        const inProgress = await prisma.battle.findMany({
            where: {
                status: BattleStatus.IN_PROGRESS,
                startedAt: { not: null },
                ...userScope,
            },
            select: {
                id: true,
                mode: true,
                startedAt: true,
                timeLimitMinutes: true,
                participants: {
                    select: { userId: true, user: { select: { username: true } } },
                },
            },
        });

        const now = Date.now();
        const expired = inProgress.filter((b) => {
            if (!b.startedAt) return false;
            const deadline =
                b.startedAt.getTime() +
                b.timeLimitMinutes * 60_000 +
                BATTLE_EXPIRY_GRACE_MS;
            return deadline < now;
        });

        // 2. Stale WAITING lobbies — public 1v1 w/o invite or expired invite.
        const waitingCutoff = new Date(now - WAITING_PUBLIC_TTL_MS);
        const staleWaiting = await prisma.battle.findMany({
            where: {
                status: BattleStatus.WAITING,
                AND: [
                    userScope,
                    {
                        OR: [
                            {
                                mode: BattleMode.ONE_V_ONE,
                                inviteCode: null,
                                createdAt: { lt: waitingCutoff },
                            },
                            {
                                inviteCode: { not: null },
                                inviteExpiresAt: { not: null, lt: new Date(now) },
                            },
                        ],
                    },
                ],
            },
            select: {
                id: true,
                mode: true,
                createdAt: true,
                inviteCode: true,
                inviteExpiresAt: true,
                participants: {
                    select: { userId: true, user: { select: { username: true } } },
                },
            },
        });

        const targets = [
            ...expired.map((b) => ({
                id: b.id,
                reason: `IN_PROGRESS expired (${b.mode}, started ${b.startedAt?.toISOString()}, limit ${b.timeLimitMinutes}m)`,
                users: b.participants.map((p) => p.user.username).join(', '),
            })),
            ...staleWaiting.map((b) => ({
                id: b.id,
                reason: b.inviteCode
                    ? `WAITING invite expired (${b.mode}, code=${b.inviteCode}, expires=${b.inviteExpiresAt?.toISOString()})`
                    : `WAITING public TTL exceeded (${b.mode}, created ${b.createdAt.toISOString()})`,
                users: b.participants.map((p) => p.user.username).join(', '),
            })),
        ];

        if (targets.length === 0) {
            console.log('No stale battles found.');
            return;
        }

        for (const t of targets) {
            console.log(
                `${apply ? 'Finalizing' : 'Would finalize'} battle ${t.id} [${t.users || 'no participants'}] — ${t.reason}`,
            );
        }

        if (!apply) {
            console.log(
                `\nDry run only. Re-run with --apply to finalize ${targets.length} battle(s).`,
            );
            return;
        }

        const endedAt = new Date();
        const ids = targets.map((t) => t.id);
        const result = await prisma.battle.updateMany({
            where: { id: { in: ids } },
            data: {
                status: BattleStatus.COMPLETED,
                endedAt,
            },
        });
        console.log(`\nFinalized ${result.count} stale battle(s).`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
