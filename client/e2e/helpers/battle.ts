/**
 * Page-object-style helpers for the Play / Battle / Results flow.
 * Centralizes selectors so spec files stay readable and one selector
 * change doesn't require touching every spec.
 *
 * All helpers use semantic queries (`getByRole`, `getByText`) by default
 * and only fall back to `data-testid` when the underlying component
 * gives us nothing else stable.
 */
import { expect, type Page } from '@playwright/test';

export type Mode = 'ONE_V_ONE' | 'BATTLE_ROYALE' | 'GROUP';

const MODE_BUTTON_LABEL: Record<Mode, RegExp> = {
    // The ModeSelector renders a <button> per mode with its label as a
    // heading. The full mode label varies, so we anchor on the heading
    // text — adjust here if MODES in pages/battle/constants.ts changes.
    ONE_V_ONE: /1v1|one v one|head[- ]to[- ]head/i,
    BATTLE_ROYALE: /battle royale|royale/i,
    GROUP: /clan war|group/i,
};

export async function gotoPlay(page: Page) {
    await page.goto('/play');
    await expect(page.getByRole('heading', { name: /Configure your/i })).toBeVisible();
}

export async function selectMode(page: Page, mode: Mode) {
    // Each mode tile is a button containing an h3 with the label.
    const tile = page
        .locator('button', { has: page.getByRole('heading', { name: MODE_BUTTON_LABEL[mode] }) })
        .first();
    await tile.click();
}

/**
 * Click "Create Private Game" / "Create Royale Lobby" / "Create Clan Wars
 * Lobby" depending on the currently-selected mode, then return the invite
 * code shown in the panel.
 */
export async function createPrivateInviteCode(page: Page): Promise<string> {
    const createBtn = page.getByRole('button', {
        name: /Create (Private Game|Royale Lobby|Clan Wars Lobby)/i,
    });
    await createBtn.click();
    // After creation, the panel renders the code inside a <code> element.
    const codeEl = page.locator('code').filter({ hasText: /^[A-Z0-9-]{4,}$/ }).first();
    try {
        await expect(codeEl).toBeVisible({ timeout: 15_000 });
    } catch (err) {
        // Surface the toast (paywall, validation error, etc.) so a failure
        // here is actionable instead of a generic locator timeout.
        const toasts = await page.locator('[data-sonner-toast]').allInnerTexts();
        throw new Error(
            `createPrivateInviteCode timed out. toasts=${JSON.stringify(toasts)} — ${(err as Error).message}`,
        );
    }
    const code = (await codeEl.innerText()).trim();
    if (!code) throw new Error('Empty invite code after create');
    return code;
}

/**
 * On the Play page, paste a code into the "Join by Code" input and click
 * Join. Resolves once the URL navigates to /battle/:id (or /invite path).
 *
 * `modeHint` matters because InvitePanel routes to a different join API
 * based on the currently-selected mode: GROUP → /clan-wars/invite/:code/join
 * (which assigns the joiner to a team), everything else → /invite/:code/join.
 * Joining a CW battle while the page sits on the default ONE_V_ONE mode
 * silently lands the joiner in the lobby with no team and breaks ready-up.
 */
export async function joinByCode(page: Page, inviteCode: string, modeHint?: Mode) {
    await gotoPlay(page);
    if (modeHint === 'GROUP' || modeHint === 'BATTLE_ROYALE') {
        await selectMode(page, modeHint);
    }
    const input = page.getByPlaceholder(/Invite code/i);
    await input.fill(inviteCode);
    await page.getByRole('button', { name: /^Join$/ }).click();
    await expect(page).toHaveURL(/\/battle\/[^/]+/, { timeout: 15_000 });
}

/**
 * From the post-create state on Play, click "Go to Battle Lobby".
 * Resolves once on /battle/:id and the lobby card is visible.
 */
export async function goToLobbyFromPlay(page: Page) {
    await page.getByRole('button', { name: /Go to Battle Lobby/i }).click();
    await expect(page).toHaveURL(/\/battle\/[^/]+/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Battle Lobby/i })).toBeVisible();
}

export async function clickReady(page: Page) {
    const readyBtn = page.getByRole('button', { name: /^Ready Up$/i });
    await readyBtn.waitFor({ state: 'visible' });
    // The button is disabled until the lobby is full enough; the spec
    // should ensure the right number of players have joined first.
    await expect(readyBtn).toBeEnabled({ timeout: 15_000 });
    await readyBtn.click();
}

/**
 * Wait for the battle to leave the WAITING state — i.e. the lobby
 * disappears and the in-game UI (Run/Submit buttons) renders.
 */
export async function waitForBattleStart(page: Page) {
    await expect(page.getByRole('button', { name: /^Submit$/ })).toBeVisible({
        timeout: 30_000,
    });
}

/**
 * Submit a deliberately-failing stub solution. We don't want to couple the
 * test to per-problem reference solutions — just proving the round-trip
 * end-to-end (editor → /submit → result) is enough.
 *
 * Monaco doesn't expose a textarea you can `fill`; we use the underlying
 * editor model via `window.monaco` if present, otherwise fall back to a
 * keyboard sequence after focusing the editor.
 */
export async function submitStub(page: Page, stub = '// e2e stub — failing on purpose\n') {
    // Replace contents of the Monaco editor.
    await page.evaluate((value) => {
        const w = window as unknown as {
            monaco?: { editor: { getEditors(): Array<{ setValue: (v: string) => void }> } };
        };
        const editor = w.monaco?.editor.getEditors()[0];
        if (editor) editor.setValue(value);
    }, stub);

    const submit = page.getByRole('button', { name: /^Submit$/ });
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();
}

/**
 * After submitting, the server eventually completes the battle and the
 * client navigates to /battle/:id/results — assert we got there.
 */
export async function expectResultsPage(page: Page) {
    await expect(page).toHaveURL(/\/battle\/[^/]+\/results/, { timeout: 60_000 });
}

/**
 * Lobby-only assertion: a participant with the given username appears in
 * the player list. Useful for "did the opponent's join propagate?" checks.
 */
export async function expectPlayerInLobby(page: Page, username: string) {
    await expect(
        page.getByText(new RegExp(`\\b${username}\\b`, 'i')).first(),
    ).toBeVisible({ timeout: 15_000 });
}

/**
 * Direct-API join for Clan Wars with explicit team assignment. The
 * InvitePanel's "Join by Code" doesn't pass `?team=` — it always defaults
 * to team-2 — so we'd over-fill team-2 if every joiner went through the
 * UI. This helper hits `/battles/clan-wars/invite/:code/join?team=N`
 * directly using the in-page Supabase access token, then navigates the
 * page to /battle/:id so the rest of the spec runs against the lobby.
 */
const API_BASE = process.env.VITE_API_URL ?? 'http://localhost:3000/api';

export async function joinClanWarsAs(
    page: Page,
    inviteCode: string,
    team: 1 | 2,
): Promise<string> {
    await page.goto('/dashboard');
    await page.waitForFunction(
        () =>
            typeof (window as unknown as { __supabase?: unknown }).__supabase !==
            'undefined',
    );
    const result = await page.evaluate(
        async ([apiBase, code, t]) => {
            const sb = (
                window as unknown as {
                    __supabase: {
                        auth: {
                            getSession: () => Promise<{
                                data: { session: { access_token: string } | null };
                            }>;
                        };
                    };
                }
            ).__supabase;
            const session = (await sb.auth.getSession()).data.session;
            if (!session) throw new Error('No session');
            const res = await fetch(
                `${apiBase}/battles/clan-wars/invite/${code}/join?team=${t}`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}),
                },
            );
            const body = await res.text();
            return { status: res.status, body };
        },
        [API_BASE, inviteCode, team] as [string, string, 1 | 2],
    );
    if (result.status >= 400) {
        throw new Error(
            `joinClanWarsAs failed (team=${team}): ${result.status} ${result.body}`,
        );
    }
    const parsed = JSON.parse(result.body) as { id: string };
    await page.goto(`/battle/${parsed.id}`);
    await expect(page.getByRole('heading', { name: /Battle Lobby/i })).toBeVisible();
    return parsed.id;
}
