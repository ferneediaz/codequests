import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, Send } from 'lucide-react';
import { toast } from 'sonner';
import { BattleChat } from '@/components/battle/BattleChat';
import { CodeEditor, type CodeEditorHandle } from '@/components/battle/CodeEditor';
import { ConsolePanel } from '@/components/battle/ConsolePanel';
import { ProblemPanel } from '@/components/battle/ProblemPanel';
import { Timer } from '@/components/battle/Timer';
import { SubmissionFeedback } from '@/components/feedback/SubmissionFeedback';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/queryKeys';
import { parseStarterCode } from '@/lib/starterCode';
import { battlesApi } from '@/services/battles';
import type { BattleResponse, ProblemResponse, SubmissionResult } from '@/types/api';
import { useBattleRoyale } from '@/hooks/useBattleRoyale';
import { useResizable } from '@/hooks/useResizable';
import { FinalRoundBanner } from './components/FinalRoundBanner';
import { RoundEndOverlay } from './components/RoundEndOverlay';
import { RoundIndicator } from './components/RoundIndicator';
import { ScoreAttackProblemPicker } from './components/ScoreAttackProblemPicker';
import { SpectatorBanner } from './components/SpectatorBanner';
import { StandingsBoard } from './components/StandingsBoard';

interface BattleRoyaleProps {
    battle: BattleResponse;
    currentUserId?: string;
}

const noop = () => undefined;

export function BattleRoyale({ battle, currentUserId }: BattleRoyaleProps) {
    const royale = useBattleRoyale(battle.id, battle, currentUserId);
    const hSplit = useResizable(0.4, 'horizontal');
    const vSplit = useResizable(0.65, 'vertical');
    const editorHandleRef = useRef<CodeEditorHandle>(null);
    const [language, setLanguage] = useState('javascript');
    const [code, setCode] = useState('');
    const [seedKey, setSeedKey] = useState<string | null>(null);
    const [selectedScoreProblemId, setSelectedScoreProblemId] = useState<string | null>(
        null,
    );
    const [runResultState, setRunResult] = useState<{
        roundNumber: number;
        problemId: string;
        result: SubmissionResult;
    } | null>(null);
    const [submitResultState, setSubmitResult] = useState<{
        roundNumber: number;
        problemId: string;
        result: SubmissionResult;
    } | null>(null);
    const [lastActionState, setLastAction] = useState<{
        roundNumber: number;
        action: 'run' | 'submit';
    } | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitFeedbackKey, setSubmitFeedbackKey] = useState(0);
    const [roundEndDismissedFor, setRoundEndDismissedFor] = useState<number | null>(null);

    const format = battle.battleRoyaleFormat ?? 'SAME_PROBLEM';
    const scoreAttack = format === 'SCORE_ATTACK';
    const firstPoolProblemId = royale.problemPoolItems[0]?.problemId ?? null;
    const scoreSelectionStillValid = royale.problemPoolItems.some(
        (item) => item.problemId === selectedScoreProblemId,
    );
    const activeProblemId = scoreAttack
        ? scoreSelectionStillValid
            ? selectedScoreProblemId
            : firstPoolProblemId
        : royale.roundProblemId;

    const isRoundLive =
        battle.status === 'IN_PROGRESS' &&
        royale.currentRoundDetails?.status === 'IN_PROGRESS';

    const { data: detailedRound } = useQuery({
        queryKey: queryKeys.battleRound(battle.id, royale.currentRound),
        queryFn: () => battlesApi.getRound(battle.id, royale.currentRound),
        enabled:
            battle.mode === 'BATTLE_ROYALE' &&
            royale.currentRound > 0 &&
            battle.status !== 'WAITING',
        retry: false,
    });

    const poolProblem = royale.problemPoolItems.find(
        (item) => item.problemId === activeProblemId,
    );

    const { data: fetchedProblem } = useQuery<ProblemResponse>({
        queryKey: queryKeys.problem(activeProblemId ?? ''),
        queryFn: () => battlesApi.getProblem(activeProblemId!),
        enabled: !!activeProblemId && !poolProblem?.problem,
    });

    const problem = poolProblem?.problem ?? fetchedProblem;

    const starterCodeMap = useMemo(
        () => parseStarterCode(problem?.starterCode),
        [problem?.starterCode],
    );

    if (problem) {
        const nextKey = `${problem.id}:${language}`;
        if (seedKey !== nextKey && starterCodeMap[language]) {
            setSeedKey(nextKey);
            setCode(starterCodeMap[language].body);
        }
    }

    const submissions = detailedRound?.submissions ?? [];
    const isParticipant = battle.participants.some((p) => p.userId === currentUserId);
    const canRun = !!activeProblemId && isParticipant && !royale.isEliminated;
    const canSubmit = canRun && isRoundLive;

    const handleRun = useCallback(async () => {
        if (!activeProblemId || !canRun) return;
        setIsRunning(true);
        setLastAction({ roundNumber: royale.currentRound, action: 'run' });
        try {
            const result = await battlesApi.executeProblem(activeProblemId, {
                code,
                language,
            });
            setRunResult({
                roundNumber: royale.currentRound,
                problemId: activeProblemId,
                result,
            });
        } catch {
            toast.error('Run failed.');
        } finally {
            setIsRunning(false);
        }
    }, [activeProblemId, canRun, code, language, royale.currentRound]);

    const handleSubmit = useCallback(async () => {
        if (!activeProblemId || !canSubmit) return;
        setIsSubmitting(true);
        setLastAction({ roundNumber: royale.currentRound, action: 'submit' });
        try {
            const result = await battlesApi.submitCode(battle.id, {
                code,
                language,
                problemId: activeProblemId,
            });
            setSubmitResult({
                roundNumber: royale.currentRound,
                problemId: activeProblemId,
                result,
            });
            setSubmitFeedbackKey((key) => key + 1);
        } catch {
            toast.error('Submit failed.');
        } finally {
            setIsSubmitting(false);
        }
    }, [activeProblemId, battle.id, canSubmit, code, language, royale.currentRound]);

    const lastAction =
        lastActionState?.roundNumber === royale.currentRound
            ? lastActionState.action
            : null;
    const runResult =
        runResultState?.roundNumber === royale.currentRound &&
        runResultState.problemId === activeProblemId
            ? runResultState.result
            : null;
    const submitResult =
        submitResultState?.roundNumber === royale.currentRound &&
        submitResultState.problemId === activeProblemId
            ? submitResultState.result
            : null;
    const consoleResult = lastAction === 'submit' ? submitResult : runResult;
    const visibleRoundEnd =
        royale.lastRoundEnd &&
        royale.lastRoundEnd.roundNumber !== roundEndDismissedFor
            ? royale.lastRoundEnd
            : null;

    return (
        <div className="relative flex h-[calc(100vh-3.5rem)] flex-col">
            {royale.isEliminated && <SpectatorBanner />}
            {royale.isFinalRound && isRoundLive && (
                <FinalRoundBanner key={royale.currentRound} />
            )}
            <RoundEndOverlay
                key={visibleRoundEnd?.roundNumber ?? 'hidden'}
                roundEnd={visibleRoundEnd}
                participants={battle.participants}
                onDone={() =>
                    setRoundEndDismissedFor(visibleRoundEnd?.roundNumber ?? null)
                }
            />

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-4 py-2">
                <RoundIndicator
                    currentRound={royale.currentRound}
                    totalRounds={royale.totalRounds}
                    remainingCount={royale.remainingCount}
                    eliminateCount={royale.eliminateCount}
                    isFinalRound={royale.isFinalRound}
                />
                <div className="flex items-center gap-3">
                    {royale.roundStartedAt &&
                        royale.roundTimeLimitSeconds > 0 &&
                        isRoundLive && (
                            <Timer
                                startedAt={royale.roundStartedAt}
                                timeLimitSeconds={royale.roundTimeLimitSeconds}
                                onTimeUp={noop}
                            />
                        )}
                    <Button
                        onClick={() => void handleRun()}
                        disabled={!canRun || isRunning || !code.trim()}
                        variant="outline"
                        size="sm"
                    >
                        {isRunning ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Run
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={!canSubmit || isSubmitting || !code.trim()}
                        size="sm"
                        title={
                            !canSubmit && royale.isEliminated
                                ? 'You are eliminated — submissions are disabled.'
                                : !isRoundLive
                                  ? 'Waiting for the next round to start.'
                                  : undefined
                        }
                    >
                        {isSubmitting ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Submit
                    </Button>
                </div>
            </div>

            {scoreAttack && (
                <div className="border-b border-border bg-background px-4 py-3">
                    <ScoreAttackProblemPicker
                        problems={royale.problemPoolItems}
                        activeProblemId={activeProblemId}
                        submissions={submissions}
                        currentUserId={currentUserId}
                        onSelect={setSelectedScoreProblemId}
                    />
                </div>
            )}

            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <SubmissionFeedback
                    size="lg"
                    className="bg-card/90 backdrop-blur-sm"
                    triggerKey={submitFeedbackKey}
                    status={
                        lastAction === 'submit' && submitResult
                            ? submitResult.allPassed
                                ? 'correct'
                                : 'incorrect'
                            : null
                    }
                />
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div
                    {...hSplit.containerProps}
                    className="flex flex-1 overflow-hidden"
                >
                    <div
                        className="overflow-y-auto border-r border-border"
                        style={{ width: `${hSplit.fraction * 100}%` }}
                    >
                        {problem ? (
                            <ProblemPanel problem={problem} />
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    <div
                        {...hSplit.dragHandleProps}
                        className="w-1 cursor-col-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
                    />

                    <div
                        {...vSplit.containerProps}
                        className="flex flex-1 flex-col overflow-hidden"
                    >
                        <div
                            className="overflow-hidden"
                            style={{ height: `${vSplit.fraction * 100}%` }}
                        >
                            <CodeEditor
                                ref={editorHandleRef}
                                language={language}
                                onLanguageChange={setLanguage}
                                code={code}
                                onCodeChange={setCode}
                                starterCode={problem?.starterCode ?? '{}'}
                                readOnly={royale.isEliminated}
                            />
                        </div>

                        <div
                            {...vSplit.dragHandleProps}
                            className="h-1 cursor-row-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
                        />

                        <div className="flex-1 overflow-hidden">
                            <ConsolePanel
                                testCases={problem?.testCases ?? []}
                                results={consoleResult?.results}
                                isRunning={isRunning || isSubmitting}
                                resultLabel={
                                    lastAction === 'submit'
                                        ? 'Submit'
                                        : lastAction === 'run'
                                          ? 'Run'
                                          : undefined
                                }
                            />
                        </div>
                    </div>
                </div>

                <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-background">
                    <StandingsBoard
                        standings={royale.standings}
                        format={format}
                        currentUserId={currentUserId}
                    />
                </aside>
            </div>

            {currentUserId && (
                <BattleChat battleId={battle.id} currentUserId={currentUserId} />
            )}
        </div>
    );
}
