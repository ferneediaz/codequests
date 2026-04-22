import { PrismaClient } from '@prisma/client';
import {
    loadAllProblems,
    toStarterCodeMap,
} from '../src/problems/authoring/problem-loader';
import { serializeStarterCode } from '../src/code-execution/starter-code';

const prisma = new PrismaClient();

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
        },
    });

    console.log('✅ Created admin user:', admin.email);

    const users = await Promise.all([
        prisma.user.upsert({
            where: { email: 'alice@example.com' },
            update: {},
            create: {
                id: 'user-seed-001',
                email: 'alice@example.com',
                username: 'alice_coder',
                role: 'user',
                mmr: 1200,
                wins: 15,
                losses: 10,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
            },
        }),
        prisma.user.upsert({
            where: { email: 'bob@example.com' },
            update: {},
            create: {
                id: 'user-seed-002',
                email: 'bob@example.com',
                username: 'bob_dev',
                role: 'user',
                mmr: 1500,
                wins: 25,
                losses: 15,
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
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
            ownerId: 'user-seed-001',
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
            ownerId: 'user-seed-002',
            mmr: 1100,
        },
    });

    await prisma.user.update({
        where: { id: 'user-seed-001' },
        data: { clanId: clan1.id },
    });

    await prisma.user.update({
        where: { id: 'user-seed-002' },
        data: { clanId: clan2.id },
    });

    console.log(
        `✅ Created clans: ${clan1.name} [${clan1.tag}], ${clan2.name} [${clan2.tag}]`,
    );

    // Import problems from YAML files under server/problems/.
    // This is equivalent to running `npm run problems:import` but we keep it
    // inline here so `npm run prisma:seed` produces a fully-populated DB in a
    // single command (used by local dev and CI).
    const loaded = loadAllProblems();
    for (const { problem } of loaded) {
        const starterCode = serializeStarterCode(toStarterCodeMap(problem));

        await prisma.problem.upsert({
            where: { id: problem.id },
            update: {
                title: problem.title,
                description: problem.description,
                difficulty: problem.difficulty,
                tags: problem.tags,
                starterCode,
            },
            create: {
                id: problem.id,
                title: problem.title,
                description: problem.description,
                difficulty: problem.difficulty,
                tags: problem.tags,
                starterCode,
            },
        });

        await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
        await prisma.testCase.createMany({
            data: problem.testCases.map((tc) => ({
                problemId: problem.id,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: tc.hidden,
            })),
        });

        console.log(
            `✅ Seeded problem: ${problem.title} (${problem.difficulty}) — ${problem.testCases.length} tests`,
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
