import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { problemSubmissionsApi } from '@/services/problemSubmissions';
import type { SubmissionResult } from '@/types/api';
import type { ProblemSubmission } from '@/types/submission';
import { LANGUAGES, PRESET_TAGS } from './constants';
import {
    buildYaml,
    defaultState,
    deriveSlug,
    kebabize,
    makeTest,
    parseTestsAndValidate,
    reshapeTests,
    toSnakeCase,
} from './utils';
import type {
    AuthoringLanguage,
    AuthorProblemSummary,
    BuilderState,
    ParamDef,
    ParamType,
    TestDraft,
} from './types';

/**
 * Form mode controls which action button is primary in the header and how
 * `Submit` is wired:
 *   - 'yaml-copy': dev iteration. Copy YAML → contributor pastes into a
 *     `server/problems/*.yaml` file. Existing behavior; kept behind
 *     `import.meta.env.DEV` in routing.
 *   - 'submit': community contribution. Sends the structured payload to
 *     `POST /problem-submissions` for admin review.
 *   - 'edit': contributor revising a NEEDS_CHANGES submission. PATCHes the
 *     existing submission row.
 */
export type AuthorFormMode = 'yaml-copy' | 'submit' | 'edit';

export interface UseAuthorFormOptions {
    mode?: AuthorFormMode;
    /** Required when `mode === 'edit'` — the submission row to load + patch. */
    submissionId?: string;
}

function submissionToBuilderState(
    submission: ProblemSubmission,
): BuilderState {
    const sig = submission.signature as {
        name?: { javascript?: string; python?: string };
        params?: ParamDef[];
        returns?: ParamType;
        mutatesArg?: number;
    };
    const ref = submission.referenceCode ?? {};
    const enabledLangs: Record<AuthoringLanguage, boolean> = {
        javascript: typeof ref.javascript === 'string' && ref.javascript.length > 0,
        python: typeof ref.python === 'string' && ref.python.length > 0,
    };
    if (!enabledLangs.javascript && !enabledLangs.python) {
        // Treat both as enabled if reference code is empty (shouldn't happen
        // for valid submissions, but keeps the form usable).
        enabledLangs.javascript = true;
        enabledLangs.python = true;
    }
    const fnName: Record<AuthoringLanguage, string> = {
        javascript: sig.name?.javascript ?? '',
        python: sig.name?.python ?? '',
    };
    const params = Array.isArray(sig.params) ? sig.params : [];
    return {
        id: submission.id,
        title: submission.title,
        difficulty: submission.difficulty,
        tags: submission.tags ?? [],
        description: submission.description,
        enabled: enabledLangs,
        fnName,
        params: params.length > 0 ? params : [{ name: 'arg0', type: 'int' }],
        returns: sig.returns ?? 'int',
        mutatesArgEnabled: typeof sig.mutatesArg === 'number',
        mutatesArgIndex: sig.mutatesArg ?? 0,
        starter: {
            javascript: ref.javascript ?? '',
            python: ref.python ?? '',
        },
        tests:
            submission.tests.length > 0
                ? submission.tests.map((t) =>
                      makeTest(t.args, t.expected, Boolean(t.hidden)),
                  )
                : [makeTest([], null)],
        hints: submission.hints.length > 0 ? submission.hints : [''],
        solution: submission.solution,
    };
}

export function useAuthorForm(options: UseAuthorFormOptions = {}) {
    const { mode = 'yaml-copy', submissionId } = options;
    const navigate = useNavigate();
    const [state, setState] = useState<BuilderState>(() => defaultState());
    const [activeLang, setActiveLang] = useState<AuthoringLanguage>('javascript');
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<SubmissionResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [yamlOpen, setYamlOpen] = useState(true);

    // Auto-derive manual-override flags; once the user edits a field by hand
    // we stop overwriting it from another source.
    const [manualId, setManualId] = useState(false);
    const [manualPyName, setManualPyName] = useState(false);

    // Seeded from /author/problems (if ENABLE_AUTHOR_TOOLS=true).
    const [knownTags, setKnownTags] = useState<string[]>(PRESET_TAGS);
    const [nextProblemNumber, setNextProblemNumber] = useState<number>(1);

    useEffect(() => {
        let cancelled = false;
        api.get<AuthorProblemSummary[]>('/author/problems')
            .then(({ data }) => {
                if (cancelled) return;
                const serverTags = Array.from(
                    new Set(data.flatMap((p) => p.tags ?? [])),
                );
                setKnownTags((prev) =>
                    Array.from(new Set([...prev, ...serverTags])).sort(),
                );
                const nums = data
                    .map((p) => {
                        const m = p.filename.match(/^(\d+)-/);
                        return m ? parseInt(m[1]!, 10) : 0;
                    })
                    .filter((n) => !Number.isNaN(n));
                const next = (nums.length === 0 ? 0 : Math.max(...nums)) + 1;
                setNextProblemNumber(next);
            })
            .catch(() => {
                // Author tools disabled or server unreachable - keep presets.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const patch = useCallback((p: Partial<BuilderState>) => {
        setState((prev) => ({ ...prev, ...p }));
    }, []);

    const setTitle = (v: string) => {
        setState((prev) => {
            const next = { ...prev, title: v };
            if (!manualId) {
                next.id = deriveSlug(v, nextProblemNumber);
            }
            return next;
        });
    };

    const setIdManual = (v: string) => {
        setManualId(true);
        patch({ id: v });
    };

    const setFnName = (lang: AuthoringLanguage, v: string) => {
        setState((prev) => {
            const fnName = { ...prev.fnName, [lang]: v };
            if (lang === 'javascript' && !manualPyName) {
                fnName.python = toSnakeCase(v);
            }
            return { ...prev, fnName };
        });
        if (lang === 'python') setManualPyName(true);
    };

    const toggleLang = (lang: AuthoringLanguage, enabled: boolean) =>
        setState((prev) => ({
            ...prev,
            enabled: { ...prev.enabled, [lang]: enabled },
        }));

    const updateStarter = (lang: AuthoringLanguage, v: string) =>
        setState((prev) => ({ ...prev, starter: { ...prev.starter, [lang]: v } }));

    const addParam = () =>
        setState((prev) => {
            const newParams = [
                ...prev.params,
                {
                    name: `arg${prev.params.length}`,
                    type: 'int' as ParamType,
                },
            ];
            const newTests = reshapeTests(
                prev.tests,
                prev.params.length,
                newParams.length,
            );
            return { ...prev, params: newParams, tests: newTests };
        });

    const removeParam = (idx: number) =>
        setState((prev) => {
            if (prev.params.length <= 1) return prev;
            const newParams = prev.params.filter((_, i) => i !== idx);
            const newTests = reshapeTests(
                prev.tests,
                prev.params.length,
                newParams.length,
            );
            return {
                ...prev,
                params: newParams,
                tests: newTests,
                mutatesArgIndex: Math.min(
                    prev.mutatesArgIndex,
                    Math.max(0, newParams.length - 1),
                ),
            };
        });

    const updateParam = (idx: number, p: Partial<ParamDef>) =>
        setState((prev) => ({
            ...prev,
            params: prev.params.map((pp, i) => (i === idx ? { ...pp, ...p } : pp)),
        }));

    const addTest = () =>
        setState((prev) => {
            const skeleton = Array(prev.params.length).fill(null);
            return { ...prev, tests: [...prev.tests, makeTest(skeleton, null)] };
        });

    const removeTest = (id: string) =>
        setState((prev) => ({
            ...prev,
            tests:
                prev.tests.length === 1
                    ? prev.tests
                    : prev.tests.filter((t) => t.id !== id),
        }));

    const updateTest = (id: string, p: Partial<TestDraft>) =>
        setState((prev) => ({
            ...prev,
            tests: prev.tests.map((t) => (t.id === id ? { ...t, ...p } : t)),
        }));

    const updateHint = (idx: number, v: string) =>
        setState((prev) => ({
            ...prev,
            hints: prev.hints.map((h, i) => (i === idx ? v : h)),
        }));

    const addHint = () =>
        setState((prev) =>
            prev.hints.length >= 3 ? prev : { ...prev, hints: [...prev.hints, ''] },
        );

    const removeHint = (idx: number) =>
        setState((prev) => ({
            ...prev,
            hints:
                prev.hints.length === 1
                    ? prev.hints
                    : prev.hints.filter((_, i) => i !== idx),
        }));

    const toggleTag = (tag: string) =>
        setState((prev) => ({
            ...prev,
            tags: prev.tags.includes(tag)
                ? prev.tags.filter((t) => t !== tag)
                : [...prev.tags, tag],
        }));

    const addCustomTag = (raw: string) => {
        const tag = kebabize(raw);
        if (!tag) return;
        setKnownTags((prev) =>
            prev.includes(tag) ? prev : [...prev, tag].sort(),
        );
        setState((prev) =>
            prev.tags.includes(tag) ? prev : { ...prev, tags: [...prev.tags, tag] },
        );
    };

    const availableLangs = useMemo(
        () => LANGUAGES.filter((l) => state.enabled[l]),
        [state.enabled],
    );

    const effectiveActiveLang: AuthoringLanguage = useMemo(() => {
        if (state.enabled[activeLang]) return activeLang;
        return availableLangs[0] ?? activeLang;
    }, [activeLang, availableLangs, state.enabled]);

    const liveYaml = useMemo(() => {
        const { tests, errors } = parseTestsAndValidate(state, { strict: true });
        return { yaml: buildYaml(state, tests), errors };
    }, [state]);

    const handleRun = useCallback(async () => {
        const { tests, errors } = parseTestsAndValidate(state, {
            strict: false,
            activeLang: effectiveActiveLang,
        });
        if (errors.length > 0) {
            toast.error(errors[0]);
            return;
        }

        const signature: Record<string, unknown> = {
            name: { [effectiveActiveLang]: state.fnName[effectiveActiveLang] },
            params: state.params,
            returns: state.returns,
        };
        if (state.mutatesArgEnabled) {
            signature.mutatesArg = state.mutatesArgIndex;
        }

        try {
            setIsRunning(true);
            const { data } = await api.post<SubmissionResult>('/author/dry-run', {
                language: effectiveActiveLang,
                signature,
                body: state.starter[effectiveActiveLang],
                tests: tests.map((t) => ({ args: t.args, expected: t.expected })),
            });
            setResult(data);
            if (data.allPassed) {
                toast.success(`${data.passed}/${data.total} tests passed`);
            } else {
                toast.message(`${data.passed}/${data.total} tests passed`);
            }
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { message?: string } };
                message?: string;
            };
            const msg =
                anyErr?.response?.data?.message ??
                anyErr?.message ??
                'Dry run failed';
            toast.error(msg);
        } finally {
            setIsRunning(false);
        }
    }, [state, effectiveActiveLang]);

    const handleCopy = async () => {
        if (liveYaml.errors.length > 0) {
            toast.error(liveYaml.errors[0]);
            return;
        }
        try {
            await navigator.clipboard.writeText(liveYaml.yaml);
            setCopied(true);
            toast.success('YAML copied to clipboard');
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Clipboard write failed');
        }
    };

    // -------------------------------------------------------------------------
    // Submission flow (used in mode='submit' and mode='edit')
    // -------------------------------------------------------------------------

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Prefill builder state from an existing NEEDS_CHANGES submission when in
    // edit mode. The route remounts on `submissionId` changes (the page is
    // keyed in `routes/contribute.tsx`), so we don't need to reset
    // `prefillLoaded` mid-effect — the initial state already starts `false`
    // for edit mode and the async setStates inside `.then()/.catch()` do not
    // run synchronously inside the effect body.
    const [prefillLoaded, setPrefillLoaded] = useState(mode !== 'edit');
    const [prefillError, setPrefillError] = useState<string | null>(null);
    useEffect(() => {
        if (mode !== 'edit' || !submissionId) return;
        let cancelled = false;
        problemSubmissionsApi
            .getOne(submissionId)
            .then((submission) => {
                if (cancelled) return;
                setState(submissionToBuilderState(submission));
                setPrefillLoaded(true);
            })
            .catch((err: { response?: { data?: { message?: string } }; message?: string }) => {
                if (cancelled) return;
                setPrefillError(
                    err.response?.data?.message ??
                        err.message ??
                        'Failed to load submission',
                );
                setPrefillLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [mode, submissionId]);

    const buildSubmissionPayload = useCallback(() => {
        const { tests, errors } = parseTestsAndValidate(state, { strict: true });
        if (errors.length > 0) return { ok: false as const, error: errors[0]! };
        const enabled = LANGUAGES.filter((l) => state.enabled[l]);
        if (enabled.length === 0) {
            return { ok: false as const, error: 'enable at least one language' };
        }

        const referenceCode: Record<string, string> = {};
        for (const lang of enabled) referenceCode[lang] = state.starter[lang];

        const signature: Record<string, unknown> = {
            name: enabled.reduce<Record<string, string>>((acc, lang) => {
                acc[lang] = state.fnName[lang];
                return acc;
            }, {}),
            params: state.params,
            returns: state.returns,
        };
        if (state.mutatesArgEnabled) {
            signature.mutatesArg = state.mutatesArgIndex;
        }

        return {
            ok: true as const,
            payload: {
                title: state.title,
                description: state.description,
                difficulty: state.difficulty,
                tags: state.tags,
                signature,
                referenceCode,
                tests: tests.map((t) => ({
                    args: t.args,
                    expected: t.expected,
                    hidden: t.hidden,
                })),
                hints: state.hints.map((h) => h.trim()).filter(Boolean),
                solution: state.solution,
            },
        };
    }, [state]);

    const handleSubmit = useCallback(async () => {
        const built = buildSubmissionPayload();
        if (!built.ok) {
            toast.error(built.error);
            return;
        }
        try {
            setIsSubmitting(true);
            await problemSubmissionsApi.create(built.payload);
            toast.success('Submitted for review');
            navigate('/contribute/mine');
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { message?: string } };
                message?: string;
            };
            toast.error(
                anyErr.response?.data?.message ??
                    anyErr.message ??
                    'Failed to submit',
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [buildSubmissionPayload, navigate]);

    const handleSubmitEdit = useCallback(async () => {
        if (!submissionId) return;
        const built = buildSubmissionPayload();
        if (!built.ok) {
            toast.error(built.error);
            return;
        }
        try {
            setIsSubmitting(true);
            await problemSubmissionsApi.updateOwn(submissionId, built.payload);
            toast.success('Resubmitted for review');
            navigate('/contribute/mine');
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { message?: string } };
                message?: string;
            };
            toast.error(
                anyErr.response?.data?.message ??
                    anyErr.message ??
                    'Failed to resubmit',
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [buildSubmissionPayload, navigate, submissionId]);

    return {
        mode,
        state,
        activeLang,
        setActiveLang,
        isRunning,
        isSubmitting,
        prefillLoaded,
        prefillError,
        result,
        copied,
        yamlOpen,
        setYamlOpen,
        manualId,
        manualPyName,
        knownTags,
        nextProblemNumber,
        patch,
        setTitle,
        setIdManual,
        setFnName,
        toggleLang,
        updateStarter,
        addParam,
        removeParam,
        updateParam,
        addTest,
        removeTest,
        updateTest,
        updateHint,
        addHint,
        removeHint,
        toggleTag,
        addCustomTag,
        availableLangs,
        effectiveActiveLang,
        liveYaml,
        handleRun,
        handleCopy,
        handleSubmit,
        handleSubmitEdit,
    };
}

export type AuthorForm = ReturnType<typeof useAuthorForm>;
