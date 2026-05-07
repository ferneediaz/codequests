import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Check,
    Loader2,
    MessageSquare,
    Pencil,
    Play,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownContent } from '@/components/MarkdownContent';
import { SubmissionStatusBadge } from '@/components/admin/SubmissionStatusBadge';
import { problemSubmissionsApi } from '@/services/problemSubmissions';
import type { SubmissionResult } from '@/types/api';
import type {
    CreateSubmissionPayload,
    ProblemSubmission,
} from '@/types/submission';

type AuthoringLanguage = 'javascript' | 'python';
const LANGUAGES: AuthoringLanguage[] = ['javascript', 'python'];

const DIFFICULTY_LABEL = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' } as const;
const DIFFICULTY_OPTIONS: ProblemSubmission['difficulty'][] = ['EASY', 'MEDIUM', 'HARD'];

type Action = 'approve' | 'reject' | 'requestChanges' | null;

const ACTION_META: Record<
    Exclude<Action, null>,
    { title: string; verb: string; notesRequired: boolean }
> = {
    approve: { title: 'Approve & publish', verb: 'Approve', notesRequired: false },
    reject: { title: 'Reject submission', verb: 'Reject', notesRequired: true },
    requestChanges: {
        title: 'Request changes',
        verb: 'Send to contributor',
        notesRequired: true,
    },
};

interface InlineEdits {
    title: string;
    description: string;
    difficulty: ProblemSubmission['difficulty'];
    tags: string;
    hints: string;
    solution: string;
}

function emptyEdits(): InlineEdits {
    return {
        title: '',
        description: '',
        difficulty: 'EASY',
        tags: '',
        hints: '',
        solution: '',
    };
}

function fromSubmission(s: ProblemSubmission): InlineEdits {
    return {
        title: s.title,
        description: s.description,
        difficulty: s.difficulty,
        tags: s.tags.join(', '),
        hints: s.hints.join('\n'),
        solution: s.solution,
    };
}

export default function ReviewSandbox() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const qc = useQueryClient();

    const submissionQuery = useQuery({
        queryKey: ['problemSubmission', id] as const,
        enabled: !!id,
        queryFn: () => problemSubmissionsApi.getOne(id!),
    });
    const submission = submissionQuery.data;

    const availableLangs = useMemo<AuthoringLanguage[]>(() => {
        if (!submission) return LANGUAGES;
        return LANGUAGES.filter(
            (l) =>
                typeof submission.referenceCode?.[l] === 'string' &&
                submission.referenceCode[l].length > 0,
        );
    }, [submission]);

    // Derived language: prefer the user's selection but fall back to the
    // first available language so we never render an editor for a language
    // the contributor didn't include. Computing during render keeps us out
    // of `setState`-in-effect anti-patterns.
    const [userLanguage, setUserLanguage] = useState<AuthoringLanguage>('javascript');
    const language = useMemo<AuthoringLanguage>(() => {
        if (availableLangs.includes(userLanguage)) return userLanguage;
        return availableLangs[0] ?? userLanguage;
    }, [availableLangs, userLanguage]);

    // Body editor: defaults to the contributor's reference code for the
    // active language. Admin tweaks while running tests are kept locally
    // (NOT sent through approve — to amend reference code, use Request
    // Changes). The override is keyed on `submissionId:language` so a
    // language switch reverts to the contributor's pristine code.
    const [bodyOverride, setBodyOverride] = useState<{ key: string; value: string } | null>(null);
    const seedKey = `${submission?.id ?? ''}:${language}`;
    const referenceForLang = submission?.referenceCode?.[language] ?? '';
    const body =
        bodyOverride && bodyOverride.key === seedKey
            ? bodyOverride.value
            : referenceForLang;
    const setBody = useCallback(
        (value: string) => setBodyOverride({ key: seedKey, value }),
        [seedKey],
    );

    const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState<SubmissionResult | null>(null);
    const [activeAction, setActiveAction] = useState<Action>(null);
    const [actionNotes, setActionNotes] = useState('');
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // Inline edits for "Edit & Approve". Like body, kept as an override
    // keyed by submission id; the source-of-truth view (when not edited)
    // mirrors the persisted submission directly.
    const [editMode, setEditMode] = useState(false);
    const [editOverride, setEditOverride] = useState<{ key: string; edits: InlineEdits } | null>(
        null,
    );
    const editKey = submission?.id ?? '';
    const edits =
        editOverride && editOverride.key === editKey
            ? editOverride.edits
            : submission
              ? fromSubmission(submission)
              : emptyEdits();
    const updateEdits = useCallback(
        (updater: (prev: InlineEdits) => InlineEdits) =>
            setEditOverride((prev) => {
                const base = prev && prev.key === editKey ? prev.edits : edits;
                return { key: editKey, edits: updater(base) };
            }),
        [edits, editKey],
    );

    const handleRun = useCallback(async () => {
        if (!submission) return;
        try {
            setIsRunning(true);
            const data = await problemSubmissionsApi.dryRun(submission.id, language);
            setRunResult(data);
            if (data.allPassed) {
                toast.success(`${data.passed}/${data.total} tests passed`);
            } else {
                toast.message(`${data.passed}/${data.total} tests passed`);
            }
        } catch (err) {
            const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
            toast.error(anyErr.response?.data?.message ?? anyErr.message ?? 'Dry run failed');
        } finally {
            setIsRunning(false);
        }
    }, [language, submission]);

    const buildEditsPayload = useCallback((): CreateSubmissionPayload => {
        if (!submission) {
            throw new Error('Submission not loaded');
        }
        const tags = edits.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        const hints = edits.hints
            .split('\n')
            .map((h) => h.trim())
            .filter(Boolean);
        return {
            title: edits.title,
            description: edits.description,
            difficulty: edits.difficulty,
            tags,
            signature: submission.signature,
            referenceCode: submission.referenceCode,
            tests: submission.tests,
            hints,
            solution: edits.solution,
        };
    }, [edits, submission]);

    const handleConfirmAction = useCallback(async () => {
        if (!submission || !activeAction) return;
        const meta = ACTION_META[activeAction];
        if (meta.notesRequired && actionNotes.trim().length === 0) {
            toast.error('Please write a note for the contributor.');
            return;
        }
        try {
            setIsSubmittingAction(true);
            if (activeAction === 'approve') {
                const body = editMode
                    ? { notes: actionNotes || undefined, edits: buildEditsPayload() }
                    : { notes: actionNotes || undefined };
                await problemSubmissionsApi.approve(submission.id, body);
                toast.success('Submission approved and published');
            } else if (activeAction === 'reject') {
                await problemSubmissionsApi.reject(submission.id, actionNotes);
                toast.success('Submission rejected');
            } else {
                await problemSubmissionsApi.requestChanges(submission.id, actionNotes);
                toast.success('Changes requested');
            }
            qc.invalidateQueries({ queryKey: ['adminSubmissions'] });
            qc.invalidateQueries({ queryKey: ['problemSubmission', submission.id] });
            navigate('/admin/review');
        } catch (err) {
            const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
            toast.error(anyErr.response?.data?.message ?? anyErr.message ?? 'Action failed');
        } finally {
            setIsSubmittingAction(false);
        }
    }, [activeAction, actionNotes, buildEditsPayload, editMode, navigate, qc, submission]);

    if (submissionQuery.isLoading || !submission) {
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
                    <Link to="/admin/review">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-1.5 h-4 w-4" /> Queue
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            {editMode ? (
                                <input
                                    value={edits.title}
                                    onChange={(e) =>
                                        updateEdits((p) => ({ ...p, title: e.target.value }))
                                    }
                                    className="rounded border border-border bg-background px-2 py-0.5 text-sm"
                                />
                            ) : (
                                submission.title
                            )}
                            <SubmissionStatusBadge status={submission.status} />
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            @{submission.submittedBy?.username ?? 'unknown'} ·{' '}
                            {DIFFICULTY_LABEL[submission.difficulty]} ·{' '}
                            {submission.tags.length > 0 ? submission.tags.join(', ') : 'no tags'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={language}
                        onChange={(e) =>
                            setUserLanguage(e.target.value as AuthoringLanguage)
                        }
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                        {availableLangs.map((lang) => (
                            <option key={lang} value={lang}>
                                {lang}
                            </option>
                        ))}
                    </select>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRun}
                        disabled={isRunning}
                    >
                        {isRunning ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Run all tests
                    </Button>
                    <Button
                        variant={editMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEditMode((v) => !v)}
                        title="Tweak title/description/tags/difficulty/hints/solution before approving"
                    >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        {editMode ? 'Editing' : 'Edit & approve'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setActiveAction('requestChanges');
                            setActionNotes('');
                        }}
                    >
                        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                        Request changes
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            setActiveAction('reject');
                            setActionNotes('');
                        }}
                    >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Reject
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            setActiveAction('approve');
                            setActionNotes('');
                        }}
                    >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Approve
                    </Button>
                </div>
            </div>

            {activeAction && (
                <ActionBar
                    title={ACTION_META[activeAction].title}
                    verb={ACTION_META[activeAction].verb}
                    notesRequired={ACTION_META[activeAction].notesRequired}
                    notes={actionNotes}
                    onNotesChange={setActionNotes}
                    onCancel={() => setActiveAction(null)}
                    onConfirm={handleConfirmAction}
                    isSubmitting={isSubmittingAction}
                />
            )}

            <div className="grid flex-1 grid-cols-[minmax(360px,1fr)_minmax(420px,1.4fr)_minmax(280px,1fr)] overflow-hidden">
                {/* Left: description + reference solution writeup + admin edits */}
                <div className="overflow-y-auto border-r border-border bg-background p-4">
                    <h2 className="mb-2 text-sm font-semibold">Description</h2>
                    {editMode ? (
                        <div className="space-y-3">
                            <textarea
                                value={edits.description}
                                onChange={(e) =>
                                    updateEdits((p) => ({ ...p, description: e.target.value }))
                                }
                                className="h-48 w-full rounded border border-border bg-background p-2 font-mono text-xs"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={edits.difficulty}
                                    onChange={(e) =>
                                        updateEdits((p) => ({
                                            ...p,
                                            difficulty: e.target
                                                .value as ProblemSubmission['difficulty'],
                                        }))
                                    }
                                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                                >
                                    {DIFFICULTY_OPTIONS.map((d) => (
                                        <option key={d} value={d}>
                                            {DIFFICULTY_LABEL[d]}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    value={edits.tags}
                                    onChange={(e) =>
                                        updateEdits((p) => ({ ...p, tags: e.target.value }))
                                    }
                                    placeholder="tags, comma, separated"
                                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                                />
                            </div>
                            <label className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                                Hints (one per line, max 3)
                            </label>
                            <textarea
                                value={edits.hints}
                                onChange={(e) =>
                                    updateEdits((p) => ({ ...p, hints: e.target.value }))
                                }
                                className="h-24 w-full rounded border border-border bg-background p-2 font-mono text-xs"
                            />
                            <label className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                                Reference solution writeup (markdown)
                            </label>
                            <textarea
                                value={edits.solution}
                                onChange={(e) =>
                                    updateEdits((p) => ({ ...p, solution: e.target.value }))
                                }
                                className="h-40 w-full rounded border border-border bg-background p-2 font-mono text-xs"
                            />
                        </div>
                    ) : (
                        <>
                            <MarkdownContent markdown={submission.description} />
                            <div className="mt-6 border-t border-border pt-4">
                                <h2 className="mb-2 text-sm font-semibold">
                                    Reference solution writeup
                                </h2>
                                <MarkdownContent markdown={submission.solution} />
                            </div>
                            {submission.hints.length > 0 && (
                                <div className="mt-6 border-t border-border pt-4">
                                    <h2 className="mb-2 text-sm font-semibold">Hints</h2>
                                    <ol className="ml-4 list-decimal space-y-1 text-sm text-foreground/90">
                                        {submission.hints.map((h, i) => (
                                            <li key={i}>{h}</li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                        </>
                    )}
                    {submission.reviewNotes && (
                        <div className="mt-6 border-t border-border pt-4">
                            <h2 className="mb-2 text-sm font-semibold">Last reviewer note</h2>
                            <p className="rounded bg-muted/40 p-2 text-xs text-foreground/80">
                                {submission.reviewNotes}
                            </p>
                        </div>
                    )}
                </div>

                {/* Center: contributor's reference code (admin can tweak this run, but it
                    isn't sent through approve — to change reference code, request changes). */}
                <div className="flex flex-col overflow-hidden">
                    <div className="border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Reference solution ({language}) — runs against all tests, including hidden
                    </div>
                    <div className="flex-1">
                        <Editor
                            height="100%"
                            language={language === 'python' ? 'python' : 'javascript'}
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
                </div>

                {/* Right: tests + run results */}
                <div className="flex flex-col overflow-hidden border-l border-border">
                    <div className="border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Tests ({submission.tests.length})
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {submission.tests.map((t, i) => {
                            const r = runResult?.results?.[i];
                            return (
                                <div key={i} className="border-b border-border p-3">
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-muted-foreground">
                                            #{i + 1}
                                            {t.hidden && (
                                                <span className="ml-2 rounded bg-muted px-1 py-0.5 text-[10px] uppercase text-muted-foreground">
                                                    hidden
                                                </span>
                                            )}
                                            {r && (
                                                <span
                                                    className={
                                                        r.passed
                                                            ? 'ml-2 text-green-500'
                                                            : 'ml-2 text-red-500'
                                                    }
                                                >
                                                    {r.passed ? 'PASS' : 'FAIL'}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="text-[10px] uppercase text-muted-foreground">args</div>
                                    <pre className="mb-1 whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-mono text-xs">
                                        {JSON.stringify(t.args)}
                                    </pre>
                                    <div className="text-[10px] uppercase text-muted-foreground">expected</div>
                                    <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-mono text-xs">
                                        {JSON.stringify(t.expected)}
                                    </pre>
                                    {r && !r.passed && (
                                        <div className="mt-2 rounded bg-destructive/10 p-2 text-[11px] text-destructive">
                                            <div>actual: {r.actualOutput ?? '<no output>'}</div>
                                            {r.error && <div className="mt-1">error: {r.error}</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {runResult && (
                        <div className="border-t border-border px-3 py-2 text-xs">
                            {runResult.passed}/{runResult.total} passed
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface ActionBarProps {
    title: string;
    verb: string;
    notesRequired: boolean;
    notes: string;
    onNotesChange: (v: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
    isSubmitting: boolean;
}

function ActionBar({
    title,
    verb,
    notesRequired,
    notes,
    onNotesChange,
    onCancel,
    onConfirm,
    isSubmitting,
}: ActionBarProps) {
    return (
        <Card className="m-3 border-primary/40">
            <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{title}</div>
                    <Button variant="ghost" size="sm" onClick={onCancel}>
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
                <textarea
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder={
                        notesRequired
                            ? 'Required note for the contributor (what to fix, why, etc.)'
                            : 'Optional note for the contributor'
                    }
                    className="h-20 w-full rounded border border-border bg-background p-2 text-xs"
                />
                <div className="flex justify-end">
                    <Button onClick={onConfirm} disabled={isSubmitting} size="sm">
                        {isSubmitting && (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                        {verb}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
