import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import api from '@/services/api';
import type { SubmissionResult } from '@/types/api';

type AuthoringLanguage = 'javascript' | 'python';
const LANGUAGES: AuthoringLanguage[] = ['javascript', 'python'];

interface LanguageStarter {
    prefix: string;
    body: string;
    suffix: string;
}

interface ProblemYaml {
    id: string;
    title: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    tags: string[];
    description: string;
    languages: Partial<Record<AuthoringLanguage, LanguageStarter>>;
    testCases: Array<{ input: string; expectedOutput: string; hidden?: boolean }>;
}

interface TestRow {
    id: string;
    input: string;
    expectedOutput: string;
}

const MONACO_LANG: Record<AuthoringLanguage, string> = {
    javascript: 'javascript',
    python: 'python',
};

function newRow(input = '', expected = ''): TestRow {
    return {
        id: `row-${Math.random().toString(36).slice(2, 8)}`,
        input,
        expectedOutput: expected,
    };
}

/**
 * Dev-only page for iterating on a YAML problem file. The server exposes
 * `/api/author/*` only when `ENABLE_AUTHOR_TOOLS=true`, so this page 404s
 * in production even if a user navigates to it.
 */
export default function AuthorPreview() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    const [problem, setProblem] = useState<ProblemYaml | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [language, setLanguage] = useState<AuthoringLanguage>('javascript');
    const [body, setBody] = useState('');
    const [rows, setRows] = useState<TestRow[]>([newRow()]);
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<SubmissionResult | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!slug) return;
        let cancelled = false;
        setLoadError(null);
        api.get<ProblemYaml>(`/author/problems/${slug}`)
            .then(({ data }) => {
                if (cancelled) return;
                setProblem(data);
                initializedRef.current = false;
            })
            .catch((err) => {
                if (cancelled) return;
                const status = err?.response?.status;
                setLoadError(
                    status === 404
                        ? 'Problem not found or author tools are disabled (set ENABLE_AUTHOR_TOOLS=true on the server).'
                        : err?.message ?? 'Failed to load problem',
                );
            });
        return () => {
            cancelled = true;
        };
    }, [slug]);

    // Seed body + test-case rows from the YAML the first time the problem loads
    // or whenever the author switches language.
    useEffect(() => {
        if (!problem) return;
        const entry = problem.languages[language];
        if (!entry) return;
        setBody(entry.body);
        if (!initializedRef.current) {
            setRows(
                problem.testCases.length > 0
                    ? problem.testCases.map((tc) => newRow(tc.input, tc.expectedOutput))
                    : [newRow()],
            );
            initializedRef.current = true;
        }
    }, [problem, language]);

    const currentStarter = useMemo<LanguageStarter | null>(() => {
        if (!problem) return null;
        return problem.languages[language] ?? null;
    }, [problem, language]);

    const handleRun = useCallback(async () => {
        if (!currentStarter) return;
        const nonEmpty = rows.filter((r) => r.input.length > 0 || r.expectedOutput.length > 0);
        if (nonEmpty.length === 0) {
            toast.error('Add at least one test case with input or expected output');
            return;
        }
        try {
            setIsRunning(true);
            const { data } = await api.post<SubmissionResult>('/author/dry-run', {
                language,
                prefix: currentStarter.prefix,
                body,
                suffix: currentStarter.suffix,
                testCases: nonEmpty.map((r) => ({
                    input: r.input,
                    expectedOutput: r.expectedOutput,
                })),
            });
            setResult(data);
            if (data.allPassed) {
                toast.success(`${data.passed}/${data.total} tests passed`);
            } else {
                toast.message(`${data.passed}/${data.total} tests passed`);
            }
        } catch (err) {
            const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
            const msg = anyErr?.response?.data?.message ?? anyErr?.message ?? 'Dry run failed';
            toast.error(msg);
        } finally {
            setIsRunning(false);
        }
    }, [currentStarter, rows, body, language]);

    const addRow = () => setRows((prev) => [...prev, newRow()]);
    const removeRow = (id: string) =>
        setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
    const updateRow = (id: string, patch: Partial<TestRow>) =>
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    if (loadError) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-md text-sm text-muted-foreground">{loadError}</p>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    Go back
                </Button>
            </div>
        );
    }

    if (!problem || !currentStarter) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
                <div className="flex items-center gap-3">
                    <Link to="/author">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-1.5 h-4 w-4" /> All drafts
                        </Button>
                    </Link>
                    <div>
                        <div className="text-sm font-semibold">{problem.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                            {problem.id} · {problem.difficulty} · {problem.tags.join(', ') || 'no tags'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as AuthoringLanguage)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                        {LANGUAGES.filter((l) => problem.languages[l]).map((lang) => (
                            <option key={lang} value={lang}>
                                {lang}
                            </option>
                        ))}
                    </select>
                    <Button onClick={handleRun} disabled={isRunning} size="sm">
                        {isRunning ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Run all tests
                    </Button>
                </div>
            </div>

            <div className="grid flex-1 grid-cols-[1fr_1.2fr_1fr] overflow-hidden">
                <div className="overflow-y-auto border-r border-border bg-background p-4">
                    <h2 className="mb-2 text-sm font-semibold">Description</h2>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {problem.description}
                    </pre>
                </div>

                <div className="flex flex-col overflow-hidden">
                    <div className="border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Prefix (read-only)
                    </div>
                    <div className="h-32 shrink-0 border-b border-border">
                        <Editor
                            height="100%"
                            language={MONACO_LANG[language]}
                            value={currentStarter.prefix}
                            theme="vs-dark"
                            options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 12,
                                lineNumbers: 'off',
                                scrollBeyondLastLine: false,
                            }}
                        />
                    </div>
                    <div className="border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-primary">
                        Body (editable)
                    </div>
                    <div className="flex-1">
                        <Editor
                            height="100%"
                            language={MONACO_LANG[language]}
                            value={body}
                            onChange={(v) => setBody(v ?? '')}
                            theme="vs-dark"
                            options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                automaticLayout: true,
                                scrollBeyondLastLine: false,
                                tabSize: language === 'python' ? 4 : 2,
                            }}
                        />
                    </div>
                    <div className="border-y border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Suffix (read-only)
                    </div>
                    <div className="h-28 shrink-0">
                        <Editor
                            height="100%"
                            language={MONACO_LANG[language]}
                            value={currentStarter.suffix}
                            theme="vs-dark"
                            options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 12,
                                lineNumbers: 'off',
                                scrollBeyondLastLine: false,
                            }}
                        />
                    </div>
                </div>

                <div className="flex flex-col overflow-hidden border-l border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Test cases ({rows.length})
                        </span>
                        <Button variant="ghost" size="sm" onClick={addRow}>
                            <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {rows.map((row, i) => {
                            const res = result?.results.find((r) => r.testCaseId === `adhoc-${i}`);
                            return (
                                <div key={row.id} className="border-b border-border p-3">
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-muted-foreground">
                                            #{i + 1}
                                            {res && (
                                                <span
                                                    className={
                                                        res.passed
                                                            ? 'ml-2 text-green-500'
                                                            : 'ml-2 text-red-500'
                                                    }
                                                >
                                                    {res.passed ? 'PASS' : 'FAIL'}
                                                </span>
                                            )}
                                        </span>
                                        <button
                                            onClick={() => removeRow(row.id)}
                                            className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                                            disabled={rows.length === 1}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <label className="text-[10px] uppercase text-muted-foreground">
                                        stdin
                                    </label>
                                    <textarea
                                        value={row.input}
                                        onChange={(e) => updateRow(row.id, { input: e.target.value })}
                                        className="mb-1 h-14 w-full resize-y rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                                    />
                                    <label className="text-[10px] uppercase text-muted-foreground">
                                        expected stdout
                                    </label>
                                    <textarea
                                        value={row.expectedOutput}
                                        onChange={(e) =>
                                            updateRow(row.id, { expectedOutput: e.target.value })
                                        }
                                        className="h-10 w-full resize-y rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                                    />
                                    {res && !res.passed && (
                                        <div className="mt-1 rounded bg-muted/40 p-2 text-[11px]">
                                            <div className="text-muted-foreground">actual:</div>
                                            <pre className="whitespace-pre-wrap font-mono">
                                                {res.actualOutput ?? ''}
                                            </pre>
                                            {res.error && (
                                                <>
                                                    <div className="mt-1 text-muted-foreground">error:</div>
                                                    <pre className="whitespace-pre-wrap font-mono text-red-400">
                                                        {res.error}
                                                    </pre>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {result && (
                        <div className="border-t border-border px-3 py-2 text-xs">
                            {result.passed}/{result.total} passed
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
