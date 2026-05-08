import { test, expect } from '@playwright/test';

// Smoke tests for the public surface. These don't require auth — anything
// that hits the API only fails the assertion if the server is also up,
// otherwise the page-rendering assertions still pass.

test('landing page renders hero and CTA', async ({ page }) => {
    await page.goto('/');
    await expect(
        page.getByRole('heading', { name: /Competitive coding/i }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: /Start Battling/i }).first(),
    ).toBeVisible();
});

test('landing CTA navigates to /login', async ({ page }) => {
    await page.goto('/');
    await page
        .getByRole('link', { name: /Start Battling/i })
        .first()
        .click();
    await expect(page).toHaveURL(/\/login$/);
});

test('leaderboard page mounts with tabs', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(
        page.getByRole('heading', { name: /Leaderboard/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Global/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Clans/i })).toBeVisible();
    // Friends tab is disabled for anonymous viewers. The friends sidebar
    // also has a Friends-related button, so anchor on exact label.
    const friendsBtn = page.getByRole('button', { name: 'Friends', exact: true });
    await expect(friendsBtn).toBeVisible();
    await expect(friendsBtn).toBeDisabled();
});
