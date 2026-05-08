/**
 * Playwright setup project: signs each test user in by calling
 * `window.__supabase.auth.signInWithPassword(...)` from inside the page.
 * The app's Supabase client (services/supabase.ts) exposes itself as
 * `window.__supabase` in dev mode, so the SDK persists the session to
 * localStorage in whatever format this @supabase/supabase-js version
 * expects — no guessing about storage key shape.
 *
 * Why not OAuth? Supabase OAuth requires real GitHub/Google in a real
 * browser — infeasible headless. signInWithPassword issues the same
 * Supabase-signed JWT, so the server's JwtStrategy can't tell the
 * difference.
 */
import { test as setup, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '..', '.env.test') });
loadEnv({ path: resolve(here, '..', '.env') });

const PASSWORD = process.env.E2E_TEST_USER_PASSWORD;
if (!PASSWORD) {
    throw new Error(
        'Missing E2E_TEST_USER_PASSWORD in client/.env.test (see e2e/.env.test.example).',
    );
}

const TEST_USERS_PATH = resolve(here, '.test-users.json');
if (!existsSync(TEST_USERS_PATH)) {
    throw new Error(
        `Missing ${TEST_USERS_PATH}. Run \`npm run e2e:bootstrap\` first.`,
    );
}
const testUsers = JSON.parse(readFileSync(TEST_USERS_PATH, 'utf8')) as Record<
    'alice' | 'bob' | 'carol' | 'dave',
    { email: string; username: string; supabaseUserId: string; password: string }
>;

const AUTH_DIR = resolve(here, '.auth');
mkdirSync(AUTH_DIR, { recursive: true });

async function signInAndSave(
    key: keyof typeof testUsers,
    page: Page,
    context: BrowserContext,
) {
    const user = testUsers[key];

    // Land on a page that loads the bundle so window.__supabase is defined.
    await page.goto('/login');
    await page.waitForFunction(
        () =>
            typeof (window as unknown as { __supabase?: unknown }).__supabase !==
            'undefined',
        undefined,
        { timeout: 30_000 },
    );

    const result = await page.evaluate(
        async ([email, password]) => {
            const sb = (
                window as unknown as {
                    __supabase: {
                        auth: {
                            signInWithPassword: (args: {
                                email: string;
                                password: string;
                            }) => Promise<{ error: { message: string } | null }>;
                        };
                    };
                }
            ).__supabase;
            const { error } = await sb.auth.signInWithPassword({ email, password });
            return error ? error.message : null;
        },
        [user.email, PASSWORD!],
    );
    if (result) throw new Error(`signIn ${key} (${user.email}) failed: ${result}`);

    // useAuth's onAuthStateChange runs AFTER signIn — but it only sets the
    // token and connects the socket, it does NOT call /auth/me. To hydrate
    // the user (and prove the JWT works against the API), navigate to
    // /dashboard which forces a fresh useAuth.initAuth → /auth/me.
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
        timeout: 15_000,
    });

    await context.storageState({ path: resolve(AUTH_DIR, `${key}.json`) });
}

setup('auth: alice', async ({ page, context }) => {
    await signInAndSave('alice', page, context);
});
setup('auth: bob', async ({ page, context }) => {
    await signInAndSave('bob', page, context);
});
setup('auth: carol', async ({ page, context }) => {
    await signInAndSave('carol', page, context);
});
setup('auth: dave', async ({ page, context }) => {
    await signInAndSave('dave', page, context);
});
