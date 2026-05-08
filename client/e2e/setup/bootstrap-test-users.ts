/**
 * One-time admin bootstrap for the e2e test suite.
 *
 * Uses the Supabase service-role key to upsert four test users
 * (alice/bob/carol/dave) with email-confirmed accounts and a known
 * shared password. Writes the resulting Supabase auth UUIDs to
 * `client/e2e/.test-users.json`, which `server/prisma/seed.ts` reads
 * so Prisma `User.id` matches the JWT `sub` claim used by the server.
 *
 * Run once per Supabase project (or after the project is wiped):
 *   cd client && npm run e2e:bootstrap
 *
 * Idempotent: if a user already exists we just look up their id.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(here, '../..');

// Pull SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / E2E_TEST_USER_PASSWORD
// from client/.env.test — separate file so bootstrap secrets don't leak
// into Vite's runtime envs.
loadEnv({ path: resolve(clientRoot, '.env.test') });

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_TEST_USER_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE || !PASSWORD) {
    console.error(
        'Missing env. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ' +
            'E2E_TEST_USER_PASSWORD in client/.env.test (see e2e/.env.test.example).',
    );
    process.exit(1);
}

const TEST_USERS = [
    { key: 'alice', email: 'alice@example.com', username: 'alice_coder' },
    { key: 'bob', email: 'bob@example.com', username: 'bob_dev' },
    { key: 'carol', email: 'carol@example.com', username: 'carol_codes' },
    { key: 'dave', email: 'dave@example.com', username: 'dave_debug' },
] as const;

type TestUserKey = (typeof TEST_USERS)[number]['key'];
type TestUsersFile = Record<
    TestUserKey,
    { email: string; username: string; supabaseUserId: string; password: string }
>;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email: string): Promise<string | null> {
    // listUsers paginates; for 4 known emails one page is plenty.
    const { data, error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return match?.id ?? null;
}

async function ensureUser(email: string): Promise<string> {
    const existing = await findUserIdByEmail(email);
    if (existing) {
        // Reset password every run so a forgotten/changed env value can't
        // wedge the suite — the service key already implies full control.
        const { error } = await admin.auth.admin.updateUserById(existing, {
            password: PASSWORD,
            email_confirm: true,
        });
        if (error) throw error;
        return existing;
    }
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
    });
    if (error) throw error;
    if (!data.user) throw new Error(`createUser returned no user for ${email}`);
    return data.user.id;
}

async function main() {
    const out: Partial<TestUsersFile> = {};
    for (const u of TEST_USERS) {
        const id = await ensureUser(u.email);
        out[u.key] = {
            email: u.email,
            username: u.username,
            supabaseUserId: id,
            password: PASSWORD!,
        };
        console.log(`✅ ${u.key.padEnd(6)} ${u.email.padEnd(22)} ${id}`);
    }
    const target = resolve(clientRoot, 'e2e/.test-users.json');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
    console.log(`\n📝 Wrote ${target}`);
    console.log('Next: cd ../server && npm run prisma:seed');
}

main().catch((err) => {
    console.error('❌ bootstrap failed:', err);
    process.exit(1);
});
