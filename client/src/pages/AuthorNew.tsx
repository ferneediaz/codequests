import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    Check,
    ChevronRight,
    Copy,
    Loader2,
    Play,
    Plus,
    Trash2,
} from 'lucide-react';
import api from '@/services/api';
import type { SubmissionResult } from '@/types/api';

type AuthoringLanguage = 'javascript' | 'python';
const LANGUAGES: AuthoringLanguage[] = ['javascript', 'python'];

/**
 * Mirrors `server/src/problems/authoring/problem-yaml.schema.ts#PARAM_TYPES`.
 * Keep in sync; server will reject anything outside this set.
 */
const PARAM_TYPES = [
    'int',
    'float',
    'bool',
    'string',
    'int[]',
    'float[]',
    'bool[]',
    'string[]',
    'int[][]',
    'float[][]',
    'string[][]',
    'any',
] as const;
type ParamType = (typeof PARAM_TYPES)[number];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const MONACO_LANG: Record<AuthoringLanguage, string> = {
    javascript: 'javascript',
    python: 'python',
};

const DEFAULT_STARTER: Record<AuthoringLanguage, string> = {
    javascript: `function solve(nums) {\n  // Your code here\n  return 0;\n}\n`,
    python: `def solve(nums):\n    # Your code here\n    return 0\n`,
};

/**
 * Baseline tag vocabulary. Extra tags from existing YAML files are merged in
 * on mount so the picker always offers whatever the repo already uses.
 */
const PRESET_TAGS = [
    'arrays',
    'hash-table',
    'strings',
    'two-pointers',
    'sliding-window',
    'sorting',
    'stacks',
    'queue',
    'binary-search',
    'trees',
    'graphs',
    'dp',
    'greedy',
    'heap',
    'linked-list',
    'math',
    'recursion',
    'bit-manipulation',
];

interface ParamDef {
    name: string;
    type: ParamType;
}

interface TestDraft {
    id: string;
    argsJson: string;
    expectedJson: string;
    hidden: boolean;
}

interface BuilderState {
    id: string;
    title: string;
    difficulty: Difficulty;
    tags: string[];
    description: string;
    enabled: Record<AuthoringLanguage, boolean>;
    fnName: Record<AuthoringLanguage, string>;
    params: ParamDef[];
    returns: ParamType;
    mutatesArgEnabled: boolean;
    mutatesArgIndex: number;
    starter: Record<AuthoringLanguage, string>;
    tests: TestDraft[];
    hints: string[];
    solution: string;
}

function shortId(): string {
    return Math.random().toString(36).slice(2, 8);
}

function makeTest(
    args: unknown[] = [],
    expected: unknown = null,
    hidden = false,
): TestDraft {
    return {
        id: `t-${shortId()}`,
        argsJson: JSON.stringify(args),
        expectedJson: JSON.stringify(expected),
        hidden,
    };
}

function defaultState(): BuilderState {
    return {
        id: '',
        title: '',
        difficulty: 'EASY',
        tags: [],
        description: '',
        enabled: { javascript: true, python: true },
        fnName: { javascript: '', python: '' },
        params: [{ name: 'nums', type: 'int[]' }],
        returns: 'int',
        mutatesArgEnabled: false,
        mutatesArgIndex: 0,
        starter: { ...DEFAULT_STARTER },
        tests: [makeTest([[1, 2, 3]], 0)],
        hints: [''],
        solution: '',
    };
}

// =============================================================================
// Derivation helpers
// =============================================================================

function kebabize(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function deriveSlug(title: string, nextNum: number): string {
    const kebab = kebabize(title);
    if (!kebab) return '';
    const padded = String(Math.max(1, nextNum)).padStart(3, '0');
    return `problem-${padded}-${kebab}`;
}

/**
 * Convert a JS-style identifier (camelCase, PascalCase, snake) to snake_case
 * so we can seed the python function name from the JS one.
 */
function toSnakeCase(s: string): string {
    if (!s) return '';
    return s
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();
}

/**
 * Reshape a test row's args array when the params count changes. Rows whose
 * current args JSON is unparseable or the "wrong" old length are left alone —
 * the author is probably mid-edit and we don't want to clobber their work.
 */
function reshapeTests(
    tests: TestDraft[],
    prevLen: number,
    newLen: number,
): TestDraft[] {
    if (prevLen === newLen) return tests;
    return tests.map((row) => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(row.argsJson);
        } catch {
            return row;
        }
        if (!Array.isArray(parsed) || parsed.length !== prevLen) return row;
        const reshaped =
            newLen > prevLen
                ? [...parsed, ...Array(newLen - prevLen).fill(null)]
                : parsed.slice(0, newLen);
        return { ...row, argsJson: JSON.stringify(reshaped) };
    });
}

// =============================================================================
// YAML serialization
// =============================================================================

/**
 * Emit a YAML scalar: plain (unquoted) when it is a safe simple identifier-like
 * or short phrase, otherwise JSON-stringified double-quoted form. JSON's
 * double-quoted strings are valid YAML.
 */
function yamlScalar(s: string): string {
    if (s.length === 0) return '""';
    const reserved = new Set([
        'true', 'false', 'null', 'yes', 'no', 'on', 'off', '~',
        'True', 'False', 'Null', 'TRUE', 'FALSE', 'NULL',
    ]);
    if (reserved.has(s)) return JSON.stringify(s);
    const hasSpecial = /[:#&*!|>'"%@`{}[\],\n\t]/.test(s);
    if (hasSpecial) return JSON.stringify(s);
    if (/^[-?\s]/.test(s) || /\s$/.test(s)) return JSON.stringify(s);
    if (/^-?\d+(\.\d+)?$/.test(s)) return JSON.stringify(s);
    return s;
}

/**
 * Render a literal block scalar (`|`) with the given body indentation.
 * Strips trailing whitespace to keep diffs tidy.
 */
function yamlBlock(content: string, indent: number): string {
    const body = content.replace(/\s+$/, '');
    if (body.length === 0) return '""';
    const pad = ' '.repeat(indent);
    const lines = body.split('\n').map((l) => (l.length === 0 ? '' : pad + l));
    return `|\n${lines.join('\n')}`;
}

function paramToYaml(p: ParamDef): string {
    return `{ name: ${p.name || '?'}, type: '${p.type}' }`;
}

interface ParsedTest {
    args: unknown[];
    expected: unknown;
    hidden: boolean;
}

function testToYaml(t: ParsedTest): string {
    const argsStr = JSON.stringify(t.args);
    const expStr = JSON.stringify(t.expected);
    const hiddenStr = t.hidden ? ', hidden: true' : '';
    return `{ args: ${argsStr}, expected: ${expStr}${hiddenStr} }`;
}

function buildYaml(state: BuilderState, parsedTests: ParsedTest[]): string {
    const tags = state.tags;
    const enabledLangs = LANGUAGES.filter((l) => state.enabled[l]);
    const hints = state.hints.map((h) => h.trim()).filter(Boolean);
    const lines: string[] = [];

    lines.push(`id: ${state.id || '(missing-id)'}`);
    lines.push(`title: ${yamlScalar(state.title)}`);
    lines.push(`difficulty: ${state.difficulty}`);
    if (tags.length === 0) {
        lines.push(`tags: []`);
    } else {
        lines.push(`tags:`);
        for (const t of tags) lines.push(`  - ${yamlScalar(t)}`);
    }
    lines.push(`description: ${yamlBlock(state.description, 2)}`);

    lines.push(`signature:`);
    lines.push(`  name:`);
    for (const lang of enabledLangs) {
        lines.push(`    ${lang}: ${yamlScalar(state.fnName[lang])}`);
    }
    if (state.params.length === 0) {
        lines.push(`  params: []`);
    } else {
        lines.push(`  params:`);
        for (const p of state.params) lines.push(`    - ${paramToYaml(p)}`);
    }
    lines.push(`  returns: '${state.returns}'`);
    if (state.mutatesArgEnabled) {
        lines.push(`  mutatesArg: ${state.mutatesArgIndex}`);
    }

    lines.push(`starter:`);
    for (const lang of enabledLangs) {
        lines.push(`  ${lang}: ${yamlBlock(state.starter[lang], 4)}`);
    }

    lines.push(`tests:`);
    if (parsedTests.length === 0) {
        lines.push(`  []`);
    } else {
        for (const t of parsedTests) {
            lines.push(`  - ${testToYaml(t)}`);
        }
    }

    lines.push(`hints:`);
    if (hints.length === 0) {
        lines.push(`  []`);
    } else {
        for (const h of hints) lines.push(`  - ${yamlScalar(h)}`);
    }

    lines.push(`solution: ${yamlBlock(state.solution, 2)}`);

    return lines.join('\n') + '\n';
}

// =============================================================================
// Validation
// =============================================================================

interface ValidateOptions {
    /** When true, enforce full YAML-level rules (hints 1-3, all langs, etc). */
    strict: boolean;
    /** For dry-run, only validate the language about to be executed. */
    activeLang?: AuthoringLanguage;
}

function parseTestsAndValidate(
    state: BuilderState,
    opts: ValidateOptions,
): { tests: ParsedTest[]; errors: string[] } {
    const errors: string[] = [];
    const tests: ParsedTest[] = [];

    if (opts.strict) {
        if (!/^[a-z0-9-]+$/.test(state.id)) {
            errors.push('id must be lowercase letters, numbers, and dashes only');
        }
        if (!state.title.trim()) errors.push('title is required');
        if (!state.description.trim()) errors.push('description is required');
        if (!state.solution.trim()) errors.push('solution is required');
        const enabledLangs = LANGUAGES.filter((l) => state.enabled[l]);
        if (enabledLangs.length === 0) errors.push('enable at least one language');
        for (const lang of enabledLangs) {
            if (!state.fnName[lang].trim()) {
                errors.push(`function name for ${lang} is empty`);
            }
            if (!state.starter[lang].trim()) {
                errors.push(`starter code for ${lang} is empty`);
            }
        }
        const hints = state.hints.map((h) => h.trim()).filter(Boolean);
        if (hints.length < 1) errors.push('at least 1 hint is required');
        if (hints.length > 3) errors.push('at most 3 hints are allowed');
    } else if (opts.activeLang) {
        if (!state.enabled[opts.activeLang]) {
            errors.push(`language ${opts.activeLang} is not enabled`);
        }
        if (!state.fnName[opts.activeLang].trim()) {
            errors.push(`function name for ${opts.activeLang} is empty`);
        }
        if (!state.starter[opts.activeLang].trim()) {
            errors.push(`starter code for ${opts.activeLang} is empty`);
        }
    }

    if (state.params.length === 0) {
        errors.push('add at least one parameter');
    }
    for (const p of state.params) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p.name)) {
            errors.push(`invalid param name: "${p.name}"`);
        }
    }
    if (
        state.mutatesArgEnabled &&
        (state.mutatesArgIndex < 0 || state.mutatesArgIndex >= state.params.length)
    ) {
        errors.push(
            `mutatesArg index ${state.mutatesArgIndex} is out of range (params has ${state.params.length})`,
        );
    }

    if (state.tests.length === 0) {
        errors.push('add at least one test');
    }

    for (let i = 0; i < state.tests.length; i++) {
        const row = state.tests[i];
        let args: unknown;
        let expected: unknown;
        try {
            args = JSON.parse(row.argsJson);
        } catch {
            errors.push(`test #${i + 1}: invalid args JSON`);
            continue;
        }
        if (!Array.isArray(args)) {
            errors.push(`test #${i + 1}: args must be a JSON array`);
            continue;
        }
        if (args.length !== state.params.length) {
            errors.push(
                `test #${i + 1}: expected ${state.params.length} arg(s), got ${args.length}`,
            );
        }
        try {
            expected = JSON.parse(row.expectedJson);
        } catch {
            errors.push(`test #${i + 1}: invalid expected JSON`);
            continue;
        }
        tests.push({ args: args as unknown[], expected, hidden: row.hidden });
    }

    return { tests, errors };
}

// =============================================================================
// Component
// =============================================================================

interface AuthorProblemSummary {
    filename: string;
    id: string;
    title: string;
    difficulty: string;
    tags: string[];
    testCount: number;
    languages: string[];
}

/**
 * Dev-only blank-slate problem authoring page. Two-column workbench with a
 * pinned live YAML preview: left column is the structured form, center
 * column is the starter-code editor + ad-hoc tests, right column renders
 * the current YAML on every keystroke. No filesystem writes — copy YAML and
 * paste it into a new `server/problems/*.yaml` file yourself.
 */
export default function AuthorNew() {
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
                // Author tools disabled or server unreachable — keep presets.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // --------- state patchers ---------

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

    // --------- tag helpers ---------

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

    // --------- derived ---------

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

    // --------- actions ---------

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

    // --------- render ---------

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
                        <div className="text-sm font-semibold">
                            {state.title || 'New problem'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            {state.id || '(auto-slug)'} · {state.difficulty} ·{' '}
                            {state.tags.length > 0
                                ? state.tags.join(', ')
                                : 'no tags'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleRun}
                        disabled={isRunning || availableLangs.length === 0}
                        size="sm"
                        variant="outline"
                    >
                        {isRunning ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Run tests ({effectiveActiveLang})
                    </Button>
                    <Button
                        onClick={handleCopy}
                        size="sm"
                        disabled={liveYaml.errors.length > 0}
                        title={
                            liveYaml.errors.length > 0
                                ? 'Fix validation errors first'
                                : 'Copy YAML to clipboard'
                        }
                    >
                        {copied ? (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Copy YAML
                    </Button>
                    <Button
                        onClick={() => setYamlOpen((v) => !v)}
                        size="sm"
                        variant="ghost"
                    >
                        <ChevronRight
                            className={cn(
                                'mr-1 h-3.5 w-3.5 transition-transform',
                                yamlOpen ? 'rotate-180' : '',
                            )}
                        />
                        {yamlOpen ? 'Hide YAML' : 'Show YAML'}
                    </Button>
                </div>
            </div>

            <div
                className={cn(
                    'grid flex-1 overflow-hidden',
                    yamlOpen
                        ? 'grid-cols-[minmax(320px,24rem)_minmax(480px,1fr)_minmax(0,26rem)]'
                        : 'grid-cols-[minmax(320px,24rem)_minmax(480px,1fr)]',
                )}
            >
                {/* ============== Column 1: form ============== */}
                <div className="overflow-y-auto border-r border-border bg-background p-4">
                    <Section title="Metadata">
                        <FieldGrid>
                            <Field
                                label="title"
                                hint="the display name"
                            >
                                <input
                                    value={state.title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Reverse String"
                                    className={inputClass}
                                />
                            </Field>
                            <Field
                                label="id (slug)"
                                hint={manualId ? 'manual' : 'auto from title'}
                            >
                                <input
                                    value={state.id}
                                    onChange={(e) => setIdManual(e.target.value)}
                                    placeholder={`problem-${String(
                                        nextProblemNumber,
                                    ).padStart(3, '0')}-…`}
                                    className={cn(
                                        inputClass,
                                        !manualId &&
                                            'text-muted-foreground/90 italic',
                                    )}
                                />
                            </Field>
                            <Field label="difficulty">
                                <select
                                    value={state.difficulty}
                                    onChange={(e) =>
                                        patch({
                                            difficulty: e.target.value as Difficulty,
                                        })
                                    }
                                    className={inputClass}
                                >
                                    {DIFFICULTIES.map((d) => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </FieldGrid>

                        <div className="mt-3">
                            <label className={labelClass + ' mb-1 block'}>
                                tags (click to toggle)
                            </label>
                            <TagChips
                                selected={state.tags}
                                known={knownTags}
                                onToggle={toggleTag}
                                onAdd={addCustomTag}
                            />
                        </div>
                    </Section>

                    <Section
                        title="Description"
                        right={
                            <span className="text-[10px] text-muted-foreground">
                                markdown
                            </span>
                        }
                    >
                        <textarea
                            value={state.description}
                            onChange={(e) => patch({ description: e.target.value })}
                            placeholder="Describe the problem. Use fenced code blocks for examples."
                            className="h-48 w-full resize-y rounded border border-border bg-background p-2 font-mono text-xs"
                        />
                    </Section>

                    <Section title="Signature">
                        <div className="mb-3 flex flex-wrap items-center gap-4">
                            {LANGUAGES.map((lang) => (
                                <label
                                    key={lang}
                                    className="flex items-center gap-1.5 text-xs"
                                >
                                    <input
                                        type="checkbox"
                                        checked={state.enabled[lang]}
                                        onChange={(e) =>
                                            toggleLang(lang, e.target.checked)
                                        }
                                    />
                                    {lang}
                                </label>
                            ))}
                        </div>
                        <FieldGrid>
                            {state.enabled.javascript && (
                                <Field label="javascript fn name">
                                    <input
                                        value={state.fnName.javascript}
                                        onChange={(e) =>
                                            setFnName('javascript', e.target.value)
                                        }
                                        placeholder="reverseString"
                                        className={inputClass}
                                    />
                                </Field>
                            )}
                            {state.enabled.python && (
                                <Field
                                    label="python fn name"
                                    hint={manualPyName ? 'manual' : 'auto from js'}
                                >
                                    <input
                                        value={state.fnName.python}
                                        onChange={(e) =>
                                            setFnName('python', e.target.value)
                                        }
                                        placeholder="reverse_string"
                                        className={cn(
                                            inputClass,
                                            !manualPyName &&
                                                'text-muted-foreground/90 italic',
                                        )}
                                    />
                                </Field>
                            )}
                            <Field label="returns">
                                <select
                                    value={state.returns}
                                    onChange={(e) =>
                                        patch({
                                            returns: e.target.value as ParamType,
                                        })
                                    }
                                    className={inputClass}
                                >
                                    {PARAM_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </FieldGrid>

                        <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between">
                                <label className={labelClass}>params</label>
                                <Button variant="ghost" size="xs" onClick={addParam}>
                                    <Plus className="mr-1 h-3 w-3" /> Add
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {state.params.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="w-5 text-[10px] text-muted-foreground">
                                            {i}
                                        </span>
                                        <input
                                            value={p.name}
                                            onChange={(e) =>
                                                updateParam(i, { name: e.target.value })
                                            }
                                            placeholder="name"
                                            className={inputClass + ' flex-1'}
                                        />
                                        <select
                                            value={p.type}
                                            onChange={(e) =>
                                                updateParam(i, {
                                                    type: e.target.value as ParamType,
                                                })
                                            }
                                            className={inputClass + ' flex-1'}
                                        >
                                            {PARAM_TYPES.map((t) => (
                                                <option key={t} value={t}>
                                                    {t}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => removeParam(i)}
                                            className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                                            disabled={state.params.length === 1}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-3 rounded border border-border/70 bg-muted/20 p-2">
                            <label className="flex items-center gap-2 text-xs">
                                <input
                                    type="checkbox"
                                    checked={state.mutatesArgEnabled}
                                    onChange={(e) =>
                                        patch({
                                            mutatesArgEnabled: e.target.checked,
                                        })
                                    }
                                />
                                <span className="font-medium">mutatesArg</span>
                                <span className="text-muted-foreground">
                                    (grade by a param the function mutates in place)
                                </span>
                            </label>
                            {state.mutatesArgEnabled && (
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">
                                        param index
                                    </span>
                                    <select
                                        value={state.mutatesArgIndex}
                                        onChange={(e) =>
                                            patch({
                                                mutatesArgIndex: Number(e.target.value),
                                            })
                                        }
                                        className={inputClass}
                                    >
                                        {state.params.map((p, i) => (
                                            <option key={i} value={i}>
                                                {i} — {p.name || '(unnamed)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </Section>

                    <Section title="Hints (1–3)">
                        <div className="space-y-2">
                            {state.hints.map((h, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="mt-2 w-4 text-[10px] text-muted-foreground">
                                        {i + 1}
                                    </span>
                                    <textarea
                                        value={h}
                                        onChange={(e) => updateHint(i, e.target.value)}
                                        placeholder="Progressive hint…"
                                        className="h-14 w-full resize-y rounded border border-border bg-background p-2 text-xs"
                                    />
                                    <button
                                        onClick={() => removeHint(i)}
                                        className="mt-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                                        disabled={state.hints.length === 1}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {state.hints.length < 3 && (
                                <Button variant="ghost" size="xs" onClick={addHint}>
                                    <Plus className="mr-1 h-3 w-3" /> Add hint
                                </Button>
                            )}
                        </div>
                    </Section>

                    <Section
                        title="Solution"
                        right={
                            <span className="text-[10px] text-muted-foreground">
                                markdown
                            </span>
                        }
                    >
                        <textarea
                            value={state.solution}
                            onChange={(e) => patch({ solution: e.target.value })}
                            placeholder="Reference solution write-up…"
                            className="h-40 w-full resize-y rounded border border-border bg-background p-2 font-mono text-xs"
                        />
                    </Section>
                </div>

                {/* ============== Column 2: starter code + tests ============== */}
                <div className="grid grid-rows-[1.8fr_1fr] overflow-hidden border-r border-border">
                    {/* ----- Starter code panel (hero) ----- */}
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
                            <div>
                                <div className="text-sm font-semibold">Starter code</div>
                                <div className="text-[11px] text-muted-foreground">
                                    The function body players see when they start the problem.
                                </div>
                            </div>
                            <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
                                {LANGUAGES.map((lang) => {
                                    const isActive = effectiveActiveLang === lang;
                                    const isEnabled = state.enabled[lang];
                                    return (
                                        <button
                                            key={lang}
                                            onClick={() => {
                                                if (!isEnabled) toggleLang(lang, true);
                                                setActiveLang(lang);
                                            }}
                                            className={cn(
                                                'rounded px-2 py-1 text-[11px] transition-colors',
                                                isActive
                                                    ? 'bg-primary text-primary-foreground'
                                                    : isEnabled
                                                    ? 'text-foreground hover:bg-muted'
                                                    : 'text-muted-foreground line-through opacity-60 hover:opacity-100',
                                            )}
                                            title={
                                                isEnabled
                                                    ? lang
                                                    : `enable ${lang}`
                                            }
                                        >
                                            {lang}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {availableLangs.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
                                Click a language pill above to enable it.
                            </div>
                        ) : (
                            <div className="flex-1">
                                <Editor
                                    height="100%"
                                    language={MONACO_LANG[effectiveActiveLang]}
                                    value={state.starter[effectiveActiveLang]}
                                    onChange={(v) =>
                                        updateStarter(effectiveActiveLang, v ?? '')
                                    }
                                    theme="vs-dark"
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 13,
                                        automaticLayout: true,
                                        scrollBeyondLastLine: false,
                                        tabSize:
                                            effectiveActiveLang === 'python' ? 4 : 2,
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* ----- Tests panel ----- */}
                    <div className="flex flex-col overflow-hidden border-t border-border">
                        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Tests · args (JSON array) + expected (JSON)
                            </span>
                            <div className="flex items-center gap-3">
                                {result && (
                                    <span className="text-[11px] text-muted-foreground">
                                        {result.passed}/{result.total} passed
                                    </span>
                                )}
                                <Button variant="ghost" size="xs" onClick={addTest}>
                                    <Plus className="mr-1 h-3 w-3" /> Add
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {state.tests.map((row, i) => {
                                const res = result?.results.find(
                                    (r) => r.testCaseId === `adhoc-${i}`,
                                );
                                return (
                                    <div
                                        key={row.id}
                                        className="border-b border-border p-3"
                                    >
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
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.hidden}
                                                        onChange={(e) =>
                                                            updateTest(row.id, {
                                                                hidden: e.target.checked,
                                                            })
                                                        }
                                                    />
                                                    hidden
                                                </label>
                                                <button
                                                    onClick={() => removeTest(row.id)}
                                                    className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                                                    disabled={state.tests.length === 1}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] uppercase text-muted-foreground">
                                                    args
                                                </label>
                                                <textarea
                                                    value={row.argsJson}
                                                    onChange={(e) =>
                                                        updateTest(row.id, {
                                                            argsJson: e.target.value,
                                                        })
                                                    }
                                                    className="h-14 w-full resize-y rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase text-muted-foreground">
                                                    expected
                                                </label>
                                                <textarea
                                                    value={row.expectedJson}
                                                    onChange={(e) =>
                                                        updateTest(row.id, {
                                                            expectedJson: e.target.value,
                                                        })
                                                    }
                                                    className="h-14 w-full resize-y rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                                                />
                                            </div>
                                        </div>
                                        {res && !res.passed && (
                                            <div className="mt-1 rounded bg-muted/40 p-2 text-[11px]">
                                                <div className="text-muted-foreground">
                                                    actual:
                                                </div>
                                                <pre className="whitespace-pre-wrap font-mono">
                                                    {res.actualOutput ?? ''}
                                                </pre>
                                                {res.error && (
                                                    <>
                                                        <div className="mt-1 text-muted-foreground">
                                                            error:
                                                        </div>
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
                    </div>
                </div>

                {/* ============== Column 3: live YAML preview ============== */}
                {yamlOpen && (
                    <div className="flex flex-col overflow-hidden bg-background">
                        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Live YAML preview
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    save as{' '}
                                    <code>server/problems/*.yaml</code>
                                </div>
                            </div>
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={handleCopy}
                                disabled={liveYaml.errors.length > 0}
                            >
                                {copied ? (
                                    <Check className="mr-1 h-3 w-3" />
                                ) : (
                                    <Copy className="mr-1 h-3 w-3" />
                                )}
                                Copy
                            </Button>
                        </div>
                        {liveYaml.errors.length > 0 && (
                            <div className="border-b border-destructive/40 bg-destructive/10 p-2 text-[11px]">
                                <div className="mb-1 font-semibold text-destructive">
                                    {liveYaml.errors.length} issue
                                    {liveYaml.errors.length === 1 ? '' : 's'} to fix
                                    before copying:
                                </div>
                                <ul className="list-disc space-y-0.5 pl-4 text-foreground/90">
                                    {liveYaml.errors.map((e, i) => (
                                        <li key={i}>{e}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <pre
                            className={cn(
                                'flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed',
                                liveYaml.errors.length > 0 && 'opacity-60',
                            )}
                        >
                            {liveYaml.yaml}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Small presentational helpers
// =============================================================================

const inputClass =
    'w-full rounded border border-border bg-background px-2 py-1 text-xs';
const labelClass = 'text-[10px] uppercase tracking-wide text-muted-foreground';

function Section({
    title,
    right,
    children,
}: {
    title: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="mb-5">
            <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {title}
                </h3>
                {right}
            </div>
            {children}
        </section>
    );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span
                className={cn(
                    labelClass,
                    'mb-1 flex items-center justify-between',
                )}
            >
                <span>{label}</span>
                {hint && <span className="normal-case tracking-normal italic opacity-70">{hint}</span>}
            </span>
            {children}
        </label>
    );
}

function TagChips({
    selected,
    known,
    onToggle,
    onAdd,
}: {
    selected: string[];
    known: string[];
    onToggle: (tag: string) => void;
    onAdd: (tag: string) => void;
}) {
    const [custom, setCustom] = useState('');
    const [showInput, setShowInput] = useState(false);

    const allTags = useMemo(
        () => Array.from(new Set([...known, ...selected])).sort(),
        [known, selected],
    );

    const submit = () => {
        if (custom.trim()) onAdd(custom);
        setCustom('');
        setShowInput(false);
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {allTags.map((t) => {
                const isSelected = selected.includes(t);
                return (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onToggle(t)}
                        className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                            isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                    >
                        {t}
                    </button>
                );
            })}
            {showInput ? (
                <input
                    autoFocus
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onBlur={submit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        }
                        if (e.key === 'Escape') {
                            setCustom('');
                            setShowInput(false);
                        }
                    }}
                    placeholder="custom-tag"
                    className="w-28 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-[11px]"
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setShowInput(true)}
                    className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                >
                    + custom
                </button>
            )}
        </div>
    );
}
