#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import { loadAllProblems, toStarterCodeMap } from './problem-loader';
import { serializeStarterCode } from '../../code-execution/starter-code';

/**
 * Import every YAML file under `server/problems/` into Postgres.
 *
 * Invariant per problem:
 *   - The Problem row is upserted by its stable `id`.
 *   - Test cases are replaced wholesale (delete-then-create). This keeps
 *     semantics simple: the YAML file is the source of truth, importing it
 *     always produces the same DB state regardless of prior runs.
 *
 * Exits non-zero on the first validation failure so CI can block deploys
 * on a malformed problem file.
 */
async function main() {
    const prisma = new PrismaClient();
    try {
        const loaded = loadAllProblems();
        if (loaded.length === 0) {
            console.log('[problems:import] No YAML files found, nothing to do.');
            return;
        }

        console.log(`[problems:import] Found ${loaded.length} problem(s).`);

        for (const { filename, problem } of loaded) {
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
                `  ✓ ${filename} -> ${problem.id} (${problem.difficulty}, ${problem.testCases.length} tests)`,
            );
        }

        console.log('[problems:import] Done.');
    } catch (err) {
        console.error('[problems:import] FAILED:', (err as Error).message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}
