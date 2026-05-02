// Shared submission shapes used by `BattlesService`, `BattleRoyaleService`,
// and `ClanWarsService`. Lives here to break the TypeScript-side import
// cycle between the three. The Nest provider graph between them is now a
// plain (non-cyclic) DAG — they're co-located in `BattlesModule` and only
// the gateway-bound port (`BATTLE_EVENTS_PORT`) connects them to the
// realtime layer.

export interface SubmissionResult {
    testsPassed: number;
    totalTests: number;
    allPassed: boolean;
    pointsAwarded: number;
    results: Array<{
        testCaseId: string;
        passed: boolean;
        input: string;
        expectedOutput: string;
        actualOutput: string | null;
        error: string | null;
    }>;
}
