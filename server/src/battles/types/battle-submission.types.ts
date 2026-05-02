// Shared submission shapes used by `BattlesService`, `BattleRoyaleService`,
// and `ClanWarsService`. Lives here to break the TypeScript-side import
// cycle between the three (the Nest provider cycle is a separate concern,
// still resolved via `forwardRef`).

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
