/**
 * Per-user authenticated context fixtures. Each fixture opens a fresh
 * Playwright BrowserContext seeded with the storageState saved by
 * `auth.setup.ts`, then closes it at end of test. Specs that need
 * multiple players just declare multiple fixtures — Playwright tears
 * them all down automatically.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *   test('1v1', async ({ alicePage, bobPage }) => { ... });
 */
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = resolve(here, '..', '.auth');

type UserKey = 'alice' | 'bob' | 'carol' | 'dave';

async function openAs(
    key: UserKey,
    browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
        storageState: resolve(AUTH_DIR, `${key}.json`),
    });
    const page = await context.newPage();
    return { context, page };
}

type Fixtures = {
    aliceContext: BrowserContext;
    alicePage: Page;
    bobContext: BrowserContext;
    bobPage: Page;
    carolContext: BrowserContext;
    carolPage: Page;
    daveContext: BrowserContext;
    davePage: Page;
};

export const test = base.extend<Fixtures>({
    aliceContext: async ({ browser }, use) => {
        const { context } = await openAs('alice', browser);
        await use(context);
        await context.close();
    },
    alicePage: async ({ aliceContext }, use) => {
        await use(aliceContext.pages()[0] ?? (await aliceContext.newPage()));
    },
    bobContext: async ({ browser }, use) => {
        const { context } = await openAs('bob', browser);
        await use(context);
        await context.close();
    },
    bobPage: async ({ bobContext }, use) => {
        await use(bobContext.pages()[0] ?? (await bobContext.newPage()));
    },
    carolContext: async ({ browser }, use) => {
        const { context } = await openAs('carol', browser);
        await use(context);
        await context.close();
    },
    carolPage: async ({ carolContext }, use) => {
        await use(carolContext.pages()[0] ?? (await carolContext.newPage()));
    },
    daveContext: async ({ browser }, use) => {
        const { context } = await openAs('dave', browser);
        await use(context);
        await context.close();
    },
    davePage: async ({ daveContext }, use) => {
        await use(daveContext.pages()[0] ?? (await daveContext.newPage()));
    },
});

export { expect };
