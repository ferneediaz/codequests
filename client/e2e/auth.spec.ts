/**
 * Auth smoke tests. Covers the protected-route boundary and the
 * authenticated landing experience without depending on the OAuth UI.
 */
import { test as anonTest, expect as anonExpect } from '@playwright/test';
import { test, expect } from './fixtures/auth';

anonTest('anonymous /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await anonExpect(page).toHaveURL(/\/login$/);
});

test('alice lands on /dashboard after auth setup', async ({ alicePage }) => {
    await alicePage.goto('/dashboard');
    // Dashboard PageHero renders the username as a heading.
    await expect(
        alicePage.getByRole('heading', { name: /alice_coder/i }),
    ).toBeVisible();
});

test('logout clears session and routes back to login', async ({ alicePage }) => {
    await alicePage.goto('/dashboard');
    // Open the user dropdown in the navbar — the trigger is the avatar
    // button. Falling back to the visible username text inside it keeps
    // this resilient if the avatar swaps to an icon.
    const navbar = alicePage.getByRole('navigation');
    await navbar.getByRole('button').last().click();
    await alicePage.getByRole('menuitem', { name: /Logout/i }).click();
    await expect(alicePage).toHaveURL(/\/(login|)$/);
    // After logging out, /dashboard should bounce to /login again.
    await alicePage.goto('/dashboard');
    await expect(alicePage).toHaveURL(/\/login$/);
});
