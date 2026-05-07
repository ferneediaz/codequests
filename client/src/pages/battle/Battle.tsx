import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { useBattle } from '@/hooks/useBattle';
import { useResizable } from '@/hooks/useResizable';
import { ProblemPanel } from '@/components/battle/ProblemPanel';
import { CodeEditor, type CodeEditorHandle } from '@/components/battle/CodeEditor';
import { ConsolePanel } from '@/components/battle/ConsolePanel';
import { Timer } from '@/components/battle/Timer';
import { OpponentProgress } from '@/components/battle/OpponentProgress';
import { SkillBar } from '@/components/battle/SkillBar';
import { SkillEffectOverlay } from '@/components/battle/SkillEffectOverlay';
import { BattleLobby } from '@/components/battle/BattleLobby';
import { BattleChat } from '@/components/battle/BattleChat';
import { SubmissionFeedback } from '@/components/feedback/SubmissionFeedback';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Send } from 'lucide-react';
import { parseStarterCode } from '@/lib/starterCode';
import { BattleRoyale } from './royale/BattleRoyale';

export default function Battle() {
    const { id } = useParams<{ id: string }>();
    const userId = useAppSelector((state) => state.auth.user?.id);
    const {
        battle,
        problem,
        opponentProgress,
        lastSubmissionResult,
        runResult,
        isSubmitting,
        isRunning,
        usedSkills,
        activeEffects,
        submitCode,
        runCode,
        useSkill,
        completeBattle: completeBattleAction,
        readyUp,
        unready,
    } = useBattle(id!);

    const [language, setLanguage] = useState('javascript');
    const [code, setCode] = useState('');
    // We track which (problemId, language) pair the editor was last seeded
    // for so we can re-seed during render when either changes — using the
    // React-recommended "adjust state during render" pattern instead of
    // mirroring props in an effect.
    const [seedKey, setSeedKey] = useState<string | null>(null);
    const [lastAction, setLastAction] = useState<'run' | 'submit' | null>(null);
    const [submitFeedbackKey, setSubmitFeedbackKey] = useState(0);
    // Re-renders every second so countdown comparisons against
    // `effect.expiresAt` stay accurate without calling Date.now() in render.
    const [now, setNow] = useState(() => Date.now());
    const editorHandleRef = useRef<CodeEditorHandle>(null);
    const scrambledOnceRef = useRef(false);

    const hSplit = useResizable(0.4, 'horizontal');
    const vSplit = useResizable(0.65, 'vertical');

    const starterCodeMap = useMemo(
        () => parseStarterCode(problem?.starterCode),
        [problem?.starterCode],
    );

    // Seed code once per (problem, language) — happens during render the
    // first time we see a new pair.
    if (problem) {
        const nextKey = `${problem.id}:${language}`;
        if (seedKey !== nextKey && starterCodeMap[language]) {
            setSeedKey(nextKey);
            setCode(starterCodeMap[language].body);
        }
    }

    useEffect(() => {
        if (activeEffects.length === 0) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [activeEffects.length]);

    const opponent = battle?.participants.find((p) => p.userId !== userId);
    const selfParticipant = battle?.participants.find((p) => p.userId === userId);

    const isFrozen = activeEffects.some(
        (e) => e.skillType === 'FREEZE' && e.expiresAt > now,
    );

    // Time Steal unlocks after passing at least one test case.
    // Server payload uses testsPassed/totalTests, existing client type says passed/total — accept either.
    const sub = lastSubmissionResult as
        | (typeof lastSubmissionResult & { testsPassed?: number; totalTests?: number })
        | null;
    const participantTestsPassed = selfParticipant?.testsPassed ?? 0;
    const localTestsPassed = Math.max(
        sub?.testsPassed ?? sub?.passed ?? 0,
        participantTestsPassed,
    );
    const localTotalTests = sub?.totalTests ?? sub?.total ?? 0;
    const timeStealUnlocked = localTestsPassed >= 1;

    // Trigger scramble exactly once per SCRAMBLE effect reception
    useEffect(() => {
        const hasScramble = activeEffects.some(
            (e) => e.skillType === 'SCRAMBLE' && e.expiresAt > Date.now(),
        );
        if (hasScramble && !scrambledOnceRef.current) {
            scrambledOnceRef.current = true;
            editorHandleRef.current?.scrambleCode();
        } else if (!hasScramble && scrambledOnceRef.current) {
            scrambledOnceRef.current = false;
        }
    }, [activeEffects]);

    const handleRun = useCallback(async () => {
        try {
            setLastAction('run');
            await runCode(code, language);
        } catch (error) {
            console.error('Run failed:', error);
        }
    }, [code, language, runCode]);

    const handleSubmit = useCallback(async () => {
        try {
            setLastAction('submit');
            await submitCode(code, language);
            setSubmitFeedbackKey((prev) => prev + 1);
        } catch (error) {
            console.error('Submission failed:', error);
        }
    }, [code, language, submitCode]);

    const handleTimeUp = useCallback(() => {
        completeBattleAction();
    }, [completeBattleAction]);

    // Determine which results to show in console
    const consoleResults = lastAction === 'submit' ? lastSubmissionResult : runResult;
    const consoleTestCases = problem?.testCases ?? [];

    if (!battle) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (battle.status === 'WAITING') {
        return (
            <BattleLobby
                battle={battle}
                currentUserId={userId!}
                onReady={readyUp}
                onUnready={unready}
            />
        );
    }

    if (battle.mode === 'BATTLE_ROYALE') {
        return <BattleRoyale battle={battle} currentUserId={userId} />;
    }

    if (!problem) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="relative flex h-[calc(100vh-3.5rem)] flex-col">
            {/* Skill effect overlays */}
            <SkillEffectOverlay activeEffects={activeEffects} />

            {/* Top bar */}
            <div className="relative flex items-center justify-between border-b border-border bg-card px-4 py-2">
                {/* Left: opponent progress */}
                <div className="flex items-center gap-4">
                    {opponent && (
                        <OpponentProgress
                            username={opponent.username}
                            testsPassed={opponentProgress?.testsPassed ?? 0}
                            totalTests={
                                opponentProgress?.totalTests ??
                                problem.testCases?.length ??
                                0
                            }
                            label={`vs ${opponent.username}`}
                        />
                    )}
                </div>

                {/* Center: timer */}
                <div className="flex items-center gap-3">
                    {battle.startedAt && (
                        <Timer
                            startedAt={battle.startedAt}
                            timeLimitMinutes={battle.timeLimitMinutes}
                            onTimeUp={handleTimeUp}
                        />
                    )}
                </div>

                {/* Right: self progress + skills + run + submit */}
                <div className="flex items-center gap-3">
                    {selfParticipant && (
                        <OpponentProgress
                            username={selfParticipant.username}
                            testsPassed={localTestsPassed}
                            totalTests={
                                localTotalTests ||
                                problem.testCases?.length ||
                                0
                            }
                            label="You"
                            align="right"
                        />
                    )}
                    {battle.enabledSkills && opponent && (
                        <SkillBar
                            enabledSkills={battle.enabledSkills}
                            usedSkills={usedSkills}
                            opponentUserId={opponent.userId}
                            onUseSkill={useSkill}
                            timeStealUnlocked={timeStealUnlocked}
                        />
                    )}

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleRun}
                            disabled={isRunning || !code.trim()}
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
                            onClick={handleSubmit}
                            disabled={isSubmitting || !code.trim()}
                            size="sm"
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
            </div>

            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <SubmissionFeedback
                    size="lg"
                    className="bg-card/90 backdrop-blur-sm"
                    triggerKey={submitFeedbackKey}
                    status={
                        lastAction === 'submit' && lastSubmissionResult
                            ? lastSubmissionResult.allPassed
                                ? 'correct'
                                : 'incorrect'
                            : null
                    }
                />
            </div>

            {/* Main content: horizontal split */}
            <div
                {...hSplit.containerProps}
                className="flex flex-1 overflow-hidden"
            >
                {/* Left panel: Problem */}
                <div
                    className="overflow-y-auto border-r border-border"
                    style={{ width: `${hSplit.fraction * 100}%` }}
                >
                    <ProblemPanel problem={problem} />
                </div>

                {/* Horizontal resize handle */}
                <div
                    {...hSplit.dragHandleProps}
                    className="w-1 cursor-col-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
                />

                {/* Right panel: editor + console (vertical split) */}
                <div
                    {...vSplit.containerProps}
                    className="flex flex-1 flex-col overflow-hidden"
                >
                    {/* Code editor */}
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
                            starterCode={problem.starterCode}
                            readOnly={isFrozen}
                        />
                    </div>

                    {/* Vertical resize handle */}
                    <div
                        {...vSplit.dragHandleProps}
                        className="h-1 cursor-row-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
                    />

                    {/* Console panel */}
                    <div className="flex-1 overflow-hidden">
                        <ConsolePanel
                            testCases={consoleTestCases}
                            results={consoleResults?.results}
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

            {/* Floating trash-talk chat */}
            {userId && <BattleChat battleId={battle.id} currentUserId={userId} />}
        </div>
    );
}
