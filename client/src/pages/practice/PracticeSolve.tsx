import {
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { practiceApi } from '@/services/practice';
import { useResizable } from '@/hooks/useResizable';
import { ProblemPanel } from '@/components/battle/ProblemPanel';
import { CodeEditor, type CodeEditorHandle } from '@/components/battle/CodeEditor';
import { ConsolePanel } from '@/components/battle/ConsolePanel';
import { PracticeHelpPanel } from '@/components/practice/PracticeHelpPanel';
import { SubmissionFeedback } from '@/components/feedback/SubmissionFeedback';
import { parseStarterCode } from '@/lib/starterCode';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    CheckCircle2,
    Loader2,
    Play,
    Send,
    Sparkles,
} from 'lucide-react';
import type { SubmissionResult } from '@/types/api';
import type {
    PracticeLanguage,
    PracticeProblemDetail,
    PracticeSubmitResponse,
} from '@/types/practice';

export default function PracticeSolve() {
    const { problemId } = useParams<{ problemId: string }>();
    const navigate = useNavigate();

    const [language, setLanguage] = useState<PracticeLanguage>('javascript');
    const [code, setCode] = useState('');
    // Identifies the (problemId, language) pair the editor was last seeded
    // for. Updated during render via the recommended "adjust state during
    // render" pattern (avoids `react-hooks/set-state-in-effect`).
    const [seedKey, setSeedKey] = useState<string | null>(null);
    const [runResult, setRunResult] = useState<SubmissionResult | null>(null);
    const [submitResult, setSubmitResult] = useState<PracticeSubmitResponse | null>(
        null,
    );
    const [submitFeedbackKey, setSubmitFeedbackKey] = useState(0);
    const [lastAction, setLastAction] = useState<'run' | 'submit' | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const editorHandleRef = useRef<CodeEditorHandle>(null);

    const hSplit = useResizable(0.4, 'horizontal');
    const vSplit = useResizable(0.65, 'vertical');

    const { data: problem, isLoading: problemLoading } = useQuery<PracticeProblemDetail>({
        queryKey: ['practice', 'problem', problemId],
        queryFn: () => practiceApi.getProblem(problemId!),
        enabled: !!problemId,
    });

    const { data: practiceStats } = useQuery({
        queryKey: ['practice', 'stats'],
        queryFn: () => practiceApi.getStats(),
    });

    const starterCodeMap = useMemo(
        () => parseStarterCode(problem?.starterCode),
        [problem?.starterCode],
    );

    if (problem) {
        const nextKey = `${problem.id}:${language}`;
        if (seedKey !== nextKey) {
            setSeedKey(nextKey);
            setCode(starterCodeMap[language]?.body ?? '');
        }
    }

    const handleLanguageChange = (nextLang: string) => {
        if (nextLang !== 'javascript' && nextLang !== 'python') {
            toast.error('Practice supports Python and JavaScript only');
            return;
        }
        setLanguage(nextLang as PracticeLanguage);
    };

    const handleRun = useCallback(async () => {
        if (!problemId) return;
        try {
            setIsRunning(true);
            setLastAction('run');
            const { data } = await api.post<SubmissionResult>(
                `/problems/${problemId}/execute`,
                { code, language },
            );
            setRunResult(data);
        } catch (error) {
            console.error('Run failed:', error);
            toast.error('Run failed. Check your code and try again.');
        } finally {
            setIsRunning(false);
        }
    }, [problemId, code, language]);

    const handleSubmit = useCallback(async () => {
        if (!problemId) return;
        try {
            setIsSubmitting(true);
            setLastAction('submit');
            const result = await practiceApi.submitAttempt({
                problemId,
                code,
                language,
            });
            setSubmitResult(result);
            setSubmitFeedbackKey((prev) => prev + 1);

            if (result.allPassed) {
                toast.success(
                    result.saved
                        ? 'All tests passed — solution saved!'
                        : 'All tests passed!',
                );
            } else {
                toast.message(
                    `${result.passed}/${result.total} tests passed${result.saved ? ' · attempt saved' : ''
                    }`,
                );
            }
        } catch (error) {
            console.error('Submit failed:', error);
            toast.error('Submission failed. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [problemId, code, language]);

    const consoleResults = useMemo(() => {
        if (lastAction === 'submit') return submitResult;
        return runResult;
    }, [lastAction, submitResult, runResult]);

    if (problemLoading || !problem) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const isFree = practiceStats ? !practiceStats.isTracked : false;

    return (
        <div className="relative flex h-[calc(100vh-3.5rem)] flex-col">
            {/* Top bar */}
            <div className="relative flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-2">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/practice')}
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        All Problems
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Practice Ground
                    </span>
                    {submitResult?.allPassed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-500">
                            <CheckCircle2 className="h-3 w-3" /> Solved
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleRun}
                        disabled={isRunning || isSubmitting || !code.trim()}
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
                        disabled={isSubmitting || isRunning || !code.trim()}
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

            {isFree && (
                <div className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-500/5 px-4 py-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-muted-foreground">
                        Your attempts aren't saved on the free plan.
                    </span>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="ml-auto font-semibold text-yellow-500 hover:underline"
                    >
                        Upgrade to track progress →
                    </button>
                </div>
            )}

            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <SubmissionFeedback
                    size="lg"
                    className="bg-card/90 backdrop-blur-sm"
                    triggerKey={submitFeedbackKey}
                    status={
                        submitResult
                            ? submitResult.allPassed
                                ? 'correct'
                                : 'incorrect'
                            : null
                    }
                />
            </div>

            {/* Main content */}
            <div {...hSplit.containerProps} className="flex flex-1 overflow-hidden">
                <div
                    className="overflow-y-auto border-r border-border"
                    style={{ width: `${hSplit.fraction * 100}%` }}
                >
                    <ProblemPanel problem={problem} />
                    <PracticeHelpPanel
                        hints={problem.hints ?? []}
                        solution={problem.solution ?? ''}
                    />
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
                            onLanguageChange={handleLanguageChange}
                            code={code}
                            onCodeChange={setCode}
                            starterCode={problem.starterCode}
                        />
                    </div>

                    <div
                        {...vSplit.dragHandleProps}
                        className="h-1 cursor-row-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
                    />

                    <div className="flex-1 overflow-hidden">
                        <ConsolePanel
                            testCases={problem.testCases ?? []}
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
        </div>
    );
}
