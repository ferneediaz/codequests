/**
 * Clan Wars (mode = GROUP / DB mode = CLAN_WARS), 2v2.
 *
 * Seed setup (server/prisma/seed.ts):
 *   - alice + carol → MIT clan (alice is owner)
 *   - bob + dave    → Harvard clan (bob is owner)
 *
 * Flow:
 *   1. alice opens /play, picks Clan Wars, shrinks team size to 2.
 *   2. alice creates a clan-wars lobby. Her MIT clan auto-assigns to
 *      team-1 (see InvitePanel's `teamOne: { clanId: cfg.myClanId }`).
 *   3. carol joins team-1 (MIT); bob+dave join team-2 (Harvard). The
 *      InvitePanel's join-by-code button always defaults to team-2, so
 *      we hit /battles/clan-wars/invite/:code/join?team=N directly.
 *   4. All four ready up.
 *   5. Lobby UI shows everyone with the "Ready" badge — the server
 *      transitions the battle out of WAITING at this point.
 *
 * NOTE: We deliberately don't wait for an in-game Submit button — the
 * client doesn't yet have a CLAN_WARS branch in Battle.tsx, so the page
 * just shows a loader after the transition. Verifying all-ready is
 * enough to prove the multi-client harness, the server fix for BR
 * invite codes, and the team routing all work together.
 */
import { test, expect } from './fixtures/auth';
import {
    gotoPlay,
    selectMode,
    createPrivateInviteCode,
    goToLobbyFromPlay,
    joinClanWarsAs,
    clickReady,
} from './helpers/battle';

test('clan wars: MIT 2v2 Harvard, lobby fills and round 1 starts', async ({
    alicePage,
    bobPage,
    carolPage,
    davePage,
}) => {
    // 1. alice configures a 2v2 (default is 3v3, shrink once)
    await gotoPlay(alicePage);
    await selectMode(alicePage, 'GROUP');
    await alicePage
        .getByRole('button', { name: /Decrease team size/i })
        .click();

    // 2. create the lobby and grab its invite code
    const inviteCode = await createPrivateInviteCode(alicePage);
    await goToLobbyFromPlay(alicePage);

    // 3. the other three join. Sequential is fine — each join just hits
    //    POST /battles/:id/clan-wars/join under the hood.
    // bob (Harvard owner) → team-2 captain; dave (Harvard) → team-2; carol
    // (MIT) → team-1. The InvitePanel's Join button always defaults to
    // team-2, so we hit the API directly to set teams correctly for 2v2.
    await joinClanWarsAs(bobPage, inviteCode, 2);
    await joinClanWarsAs(carolPage, inviteCode, 1);
    await joinClanWarsAs(davePage, inviteCode, 2);

    // 4. CW doesn't fan out a player_joined socket event, so each page's
    //    `useBattle` cache is stale. Reload them all to refetch the
    //    participants. We don't assert per-username visibility here — the
    //    ready-up step below requires the lobby to be full, which the
    //    server enforces and is the meaningful end-state for the test.
    await Promise.all(
        [alicePage, bobPage, carolPage, davePage].map((p) => p.reload()),
    );

    // sanity: dave's view should list 4 players after reload
    await expect(
        davePage.getByRole('heading', { name: /Players \(4\)/i }),
    ).toBeVisible({ timeout: 20_000 });

    // 5. All four ready up. clickReady waits for the button to be enabled,
    //    which only happens once the lobby is full.
    await clickReady(alicePage);
    await clickReady(bobPage);
    await clickReady(carolPage);
    await clickReady(davePage);

    // 6. Once every participant is ready, the server transitions the
    //    battle out of WAITING and Battle.tsx replaces the BattleLobby
    //    component (for CW it currently renders a spinner — the in-game
    //    UI for CW is still being built). The lobby's "Battle Lobby"
    //    heading disappearing proves the harness is wired end-to-end:
    //    creates → joins → readies → server start → client transition.
    await expect(
        davePage.getByRole('heading', { name: /Battle Lobby/i }),
    ).toBeHidden({ timeout: 15_000 });
});
