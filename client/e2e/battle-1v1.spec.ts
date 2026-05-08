/**
 * 1v1 battle, two browser contexts.
 *
 * Flow:
 *   1. alice opens /play, picks 1v1, creates a private game → invite code.
 *   2. alice clicks "Go to Battle Lobby" → /battle/:id (lobby).
 *   3. bob opens /play, joins by code → /battle/:id (lobby).
 *   4. Both see each other's username in the lobby.
 *   5. Both click "Ready Up". Server transitions the battle to IN_PROGRESS
 *      and the in-game UI replaces the lobby for both clients.
 *   6. Both submit a stub solution. Battle completes → both see Results.
 */
import { test, expect } from './fixtures/auth';
import {
    gotoPlay,
    selectMode,
    createPrivateInviteCode,
    goToLobbyFromPlay,
    joinByCode,
    clickReady,
    waitForBattleStart,
    submitStub,
    expectResultsPage,
    expectPlayerInLobby,
} from './helpers/battle';

test('1v1 battle: alice and bob play each other end-to-end', async ({
    alicePage,
    bobPage,
}) => {
    // 1. alice configures and creates the lobby
    await gotoPlay(alicePage);
    await selectMode(alicePage, 'ONE_V_ONE');
    const inviteCode = await createPrivateInviteCode(alicePage);
    await goToLobbyFromPlay(alicePage);

    // 2. bob joins via the code
    await joinByCode(bobPage, inviteCode);
    await expect(
        bobPage.getByRole('heading', { name: /Battle Lobby/i }),
    ).toBeVisible();

    // 3. presence: each sees the other's username
    await expectPlayerInLobby(alicePage, 'bob_dev');
    await expectPlayerInLobby(bobPage, 'alice_coder');

    // 4. both ready up — order doesn't matter, the server transitions on
    //    the second ready event
    await clickReady(alicePage);
    await clickReady(bobPage);

    // 5. lobby disappears, in-game UI shows up for both
    await waitForBattleStart(alicePage);
    await waitForBattleStart(bobPage);

    // 6. both submit a stub. Server eventually completes the battle and
    //    both clients route to /results
    await submitStub(alicePage);
    await submitStub(bobPage);

    await expectResultsPage(alicePage);
    await expectResultsPage(bobPage);
});
