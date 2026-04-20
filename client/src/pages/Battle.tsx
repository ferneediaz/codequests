import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { useBattle } from '@/hooks/useBattle';
import { ProblemPanel } from '@/components/battle/ProblemPanel';
import { CodeEditor } from '@/components/battle/CodeEditor';
import { Timer } from '@/components/battle/Timer';
import { OpponentProgress } from '@/components/battle/OpponentProgress';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';

export default function Battle() {
    const { id } = useParams<{ id: string }>();
    const userId = useAppSelector((state) => state.auth.user?.id);
    const {
        battle,
        problem,
        opponentProgress,
        lastSubmissionResult,
        isSubmitting,
        submitCode,
        completeBattle: completeBattleAction,
    } = useBattle(id!);

    const [language, setLanguage] = useState('javascript');
    const [code, setCode] = useState('');
    const [codeInitialized, setCodeInitialized] = useState(false);

    // Initialize code from starter code when problem loads
    const starterCodeMap = useMemo(() => {
        if (!problem?.starterCode) return {};
        try {
            return JSON.parse(problem.starterCode) as Record<string, string>;
        } catch {
            return {};
        }
    }, [problem?.starterCode]);

    // Set initial code once problem loads
    if (problem && !codeInitialized && starterCodeMap[language]) {
        setCode(starterCodeMap[language]);
        setCodeInitialized(true);
    }

    const opponent = battle?.participants.find((p) => p.userId !== userId);

    const handleSubmit = useCallback(async () => {
        try {
            await submitCode(code, language);
        } catch (error) {
            console.error('Submission failed:', error);
        }
    }, [code, language, submitCode]);

    const handleTimeUp = useCallback(() => {
        completeBattleAction();
    }, [completeBattleAction]);

    if (!battle || !problem) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (battle.status === 'WAITING') {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <div className="text-center">
                    <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                    <p className="text-lg text-foreground">Waiting for opponent...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            {/* Top bar: timer + opponent progress */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
                <div className="flex items-center gap-4">
                    {opponent && opponentProgress ? (
                        <OpponentProgress
                            username={opponent.username}
                            testsPassed={opponentProgress.testsPassed}
                            totalTests={opponentProgress.totalTests}
                        />
                    ) : opponent ? (
                        <span className="text-sm text-muted-foreground">
                            vs {opponent.username}
                        </span>
                    ) : null}
                </div>

                <div className="flex items-center gap-4">
                    {battle.startedAt && (
                        <Timer
                            startedAt={battle.startedAt}
                            timeLimitMinutes={battle.timeLimitMinutes}
                            onTimeUp={handleTimeUp}
                        />
                    )}
                </div>

                <div>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !code.trim()}
                        size="sm"
                    >
                        {isSubmitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        Submit
                    </Button>
                </div>
            </div>

            {/* Main content: problem + editor */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Problem */}
                <div className="w-2/5 overflow-y-auto border-r border-border">
                    <ProblemPanel
                        problem={problem}
                        submissionResults={lastSubmissionResult?.results}
                    />
                </div>

                {/* Right: Editor */}
                <div className="flex w-3/5 flex-col">
                    <CodeEditor
                        language={language}
                        onLanguageChange={setLanguage}
                        code={code}
                        onCodeChange={setCode}
                        starterCode={problem.starterCode}
                    />

                    {/* Submission result summary */}
                    {lastSubmissionResult && (
                        <div
                            className={`border-t px-4 py-2 text-sm ${lastSubmissionResult.allPassed
                                    ? 'border-green-500/50 bg-green-500/10 text-green-400'
                                    : 'border-red-500/50 bg-red-500/10 text-red-400'
                                }`}
                        >
                            {lastSubmissionResult.allPassed
                                ? `All tests passed! (${lastSubmissionResult.passed}/${lastSubmissionResult.total})`
                                : `${lastSubmissionResult.passed}/${lastSubmissionResult.total} tests passed`}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
