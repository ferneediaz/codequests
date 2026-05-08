import '../src/load-server-env';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, UserSegment, CodingExperience, PrimaryGoal, HowHeard, AvatarSource, SubscriptionTier } from '@prisma/client';
import { loadAllProblems, toImportTestCases, toStarterCodeMap } from '../src/problems/authoring/problem-loader';
import { serializeStarterCode } from '../src/code-execution/starter-code';

const prisma = new PrismaClient();

// When client/e2e/.test-users.json exists (after running
// `npm run e2e:bootstrap` in the client), use the Supabase auth UUIDs
// it captured for User.id so server JWT validation (sub → User.id)
// works for the same accounts. Without it we fall back to legacy
// hardcoded ids — that path keeps non-e2e dev workflows working.
type TestUserEntry = {
    email: string;
    username: string;
    supabaseUserId: string;
    password: string;
};
type TestUsersFile = Partial<Record<'alice' | 'bob' | 'carol' | 'dave', TestUserEntry>>;

function loadTestUsers(): TestUsersFile {
    const path = resolve(__dirname, '../../client/e2e/.test-users.json');
    if (!existsSync(path)) return {};
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as TestUsersFile;
    } catch (err) {
        console.warn(`⚠️ Could not parse ${path}: ${(err as Error).message}`);
        return {};
    }
}

const testUsers = loadTestUsers();
const idFor = (key: keyof TestUsersFile, fallback: string): string =>
    testUsers[key]?.supabaseUserId ?? fallback;

/**
 * Seed non-problem fixtures (users, clans, seasons) and then import every
 * YAML problem definition under `server/problems/`.
 *
 * Problem content is intentionally NOT hard-coded in this file anymore —
 * that lives in per-file YAML so new problems can be added via PR without
 * touching TypeScript. See `server/readme.md` for the authoring workflow.
 */

async function main() {
    console.log('🌱 Starting seed...');

    const admin = await prisma.user.upsert({
        where: { email: 'admin@codequest.dev' },
        update: {},
        create: {
            id: 'admin-seed-user-001',
            email: 'admin@codequest.dev',
            username: 'admin',
            role: 'admin',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
            onboardingCompletedAt: new Date(),
            userSegment: UserSegment.PROFESSIONAL,
            codingExperience: CodingExperience.ADVANCED,
            primaryGoal: PrimaryGoal.SKILL_UP,
            howHeard: HowHeard.OTHER,
            avatarSource: AvatarSource.URL,
        },
    });

    console.log('✅ Created admin user:', admin.email);

    const aliceId = idFor('alice', 'user-seed-001');
    const bobId = idFor('bob', 'user-seed-002');
    const carolId = idFor('carol', 'user-seed-003');
    const daveId = idFor('dave', 'user-seed-004');

    // Re-keying an existing User via upsert.update would cascade across
    // every battle/clan/etc FK and is more trouble than it's worth — wipe
    // the DB before re-seeding when switching auth modes.
    //
    // Test users are PRO so the e2e suite isn't gated by the daily
    // free-game cap (each test creates a battle, and a single user is
    // re-used across multiple specs).
    const users = await Promise.all([
        prisma.user.upsert({
            where: { email: 'alice@example.com' },
            update: { subscriptionTier: SubscriptionTier.PRO },
            create: {
                id: aliceId,
                email: 'alice@example.com',
                username: 'alice_coder',
                role: 'user',
                mmr: 1200,
                wins: 15,
                losses: 10,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
                onboardingCompletedAt: new Date(),
                userSegment: UserSegment.STUDENT,
                primaryGoal: PrimaryGoal.CLASSROOM,
                howHeard: HowHeard.SCHOOL,
                subscriptionTier: SubscriptionTier.PRO,
            },
        }),
        prisma.user.upsert({
            where: { email: 'bob@example.com' },
            update: { subscriptionTier: SubscriptionTier.PRO },
            create: {
                id: bobId,
                email: 'bob@example.com',
                username: 'bob_dev',
                role: 'user',
                mmr: 1500,
                wins: 25,
                losses: 15,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
                onboardingCompletedAt: new Date(),
                userSegment: UserSegment.HOBBYIST,
                primaryGoal: PrimaryGoal.FUN,
                subscriptionTier: SubscriptionTier.PRO,
            },
        }),
        prisma.user.upsert({
            where: { email: 'carol@example.com' },
            update: { subscriptionTier: SubscriptionTier.PRO },
            create: {
                id: carolId,
                email: 'carol@example.com',
                username: 'carol_codes',
                role: 'user',
                mmr: 1300,
                wins: 12,
                losses: 8,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carol',
                onboardingCompletedAt: new Date(),
                userSegment: UserSegment.STUDENT,
                primaryGoal: PrimaryGoal.SKILL_UP,
                howHeard: HowHeard.SCHOOL,
                subscriptionTier: SubscriptionTier.PRO,
            },
        }),
        prisma.user.upsert({
            where: { email: 'dave@example.com' },
            update: { subscriptionTier: SubscriptionTier.PRO },
            create: {
                id: daveId,
                email: 'dave@example.com',
                username: 'dave_debug',
                role: 'user',
                mmr: 1400,
                wins: 18,
                losses: 9,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dave',
                onboardingCompletedAt: new Date(),
                userSegment: UserSegment.HOBBYIST,
                primaryGoal: PrimaryGoal.FUN,
                subscriptionTier: SubscriptionTier.PRO,
            },
        }),
    ]);

    console.log(`✅ Created ${users.length} sample users`);

    const clan1 = await prisma.clan.upsert({
        where: { tag: 'MIT' },
        update: {},
        create: {
            id: 'clan-seed-001',
            name: 'MIT Hackers',
            tag: 'MIT',
            ownerId: aliceId,
            mmr: 1200,
        },
    });

    const clan2 = await prisma.clan.upsert({
        where: { tag: 'HVD' },
        update: {},
        create: {
            id: 'clan-seed-002',
            name: 'Harvard Coders',
            tag: 'HVD',
            ownerId: bobId,
            mmr: 1100,
        },
    });

    await prisma.user.update({ where: { id: aliceId }, data: { clanId: clan1.id } });
    await prisma.user.update({ where: { id: carolId }, data: { clanId: clan1.id } });
    await prisma.user.update({ where: { id: bobId }, data: { clanId: clan2.id } });
    await prisma.user.update({ where: { id: daveId }, data: { clanId: clan2.id } });

    console.log(
        `✅ Created clans: ${clan1.name} [${clan1.tag}] (alice+carol), ${clan2.name} [${clan2.tag}] (bob+dave)`,
    );

    // Import problems from YAML files under server/problems/.
    // This is equivalent to running `npm run problems:import` but we keep it
    // inline here so `npm run prisma:seed` produces a fully-populated DB in a
    // single command (used by local dev and CI).
    const loaded = loadAllProblems();
    for (const { problem } of loaded) {
        const starterCode = serializeStarterCode(toStarterCodeMap(problem));
        const testRows = toImportTestCases(problem);

        await prisma.problem.upsert({
            where: { id: problem.id },
            update: {
                title: problem.title,
                description: problem.description,
                difficulty: problem.difficulty,
                tags: problem.tags,
                starterCode,
                hints: problem.hints,
                solution: problem.solution,
            },
            create: {
                id: problem.id,
                title: problem.title,
                description: problem.description,
                difficulty: problem.difficulty,
                tags: problem.tags,
                starterCode,
                hints: problem.hints,
                solution: problem.solution,
            },
        });

        await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
        await prisma.testCase.createMany({
            data: testRows.map((tc) => ({
                problemId: problem.id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: tc.hidden,
            })),
        });

        console.log(
            `✅ Seeded problem: ${problem.title} (${problem.difficulty}) — ${testRows.length} tests`,
        );
    }

    const now = new Date();
    const seasonEndDate = new Date(now);
    seasonEndDate.setMonth(seasonEndDate.getMonth() + 3);

    const season = await prisma.season.upsert({
        where: { number: 1 },
        update: {},
        create: {
            number: 1,
            name: 'Season 1',
            isActive: true,
            startDate: now,
            endDate: seasonEndDate,
        },
    });

    console.log(
        `✅ Created ${season.name} (ends ${seasonEndDate.toISOString().split('T')[0]})`,
    );

    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        throw e;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
