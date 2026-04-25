import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { useBattle } from '@/hooks/useBattle';
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

function useResizable(initialFraction: number, direction: 'horizontal' | 'vertical') {
    const [fraction, setFraction] = useState(initialFraction);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const onMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            dragging.current = true;

            const onMouseMove = (ev: MouseEvent) => {
                if (!dragging.current || !containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                let newFraction: number;
                if (direction === 'horizontal') {
                    newFraction = (ev.clientX - rect.left) / rect.width;
                } else {
                    newFraction = (ev.clientY - rect.top) / rect.height;
                }
                setFraction(Math.min(0.8, Math.max(0.2, newFraction)));
            };

            const onMouseUp = () => {
                dragging.current = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor =
                direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
        },
        [direction],
    );

    return { fraction, containerRef, onMouseDown };
}

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
    const [codeInitialized, setCodeInitialized] = useState(false);
    const [lastAction, setLastAction] = useState<'run' | 'submit' | null>(null);
    const [submitFeedbackKey, setSubmitFeedbackKey] = useState(0);
    const [timeStealUnlocked, setTimeStealUnlocked] = useState(false);
    const editorHandleRef = useRef<CodeEditorHandle>(null);
    const scrambledOnceRef = useRef(false);

    // Resizable panels
    const hSplit = useResizable(0.4, 'horizontal');
    const vSplit = useResizable(0.65, 'vertical');

    const starterCodeMap = useMemo(
        () => parseStarterCode(problem?.starterCode),
        [problem?.starterCode],
    );

    useEffect(() => {
        if (problem && !codeInitialized && starterCodeMap[language]) {
            setCode(starterCodeMap[language].body);
            setCodeInitialized(true);
        }
    }, [problem, codeInitialized, starterCodeMap, language]);

    const opponent = battle?.participants.find((p) => p.userId !== userId);
    const selfParticipant = battle?.participants.find((p) => p.userId === userId);

    // Derived skill-effect flags
    const now = Date.now();
    const isFrozen = activeEffects.some(
        (e) => e.skillType === 'FREEZE' && e.expiresAt > now,
    );

    // Time Steal unlocks after passing at least one test case (sticky for the battle).
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
    useEffect(() => {
        if (!timeStealUnlocked && localTestsPassed >= 1) {
            setTimeStealUnlocked(true);
        }
    }, [localTestsPassed, timeStealUnlocked]);

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
                ref={hSplit.containerRef}
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
                    onMouseDown={hSplit.onMouseDown}
                    className="w-1 cursor-col-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
                />

                {/* Right panel: editor + console (vertical split) */}
                <div
                    ref={vSplit.containerRef}
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
                        onMouseDown={vSplit.onMouseDown}
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
