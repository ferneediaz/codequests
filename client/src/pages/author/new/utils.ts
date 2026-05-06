import { DEFAULT_STARTER, LANGUAGES } from './constants';
import type {
    BuilderState,
    ParamDef,
    ParsedTest,
    TestDraft,
    ValidateOptions,
} from './types';

function shortId(): string {
    return Math.random().toString(36).slice(2, 8);
}

export function makeTest(
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

export function defaultState(): BuilderState {
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

export function kebabize(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export function deriveSlug(title: string, nextNum: number): string {
    const kebab = kebabize(title);
    if (!kebab) return '';
    const padded = String(Math.max(1, nextNum)).padStart(3, '0');
    return `problem-${padded}-${kebab}`;
}

/**
 * Convert a JS-style identifier (camelCase, PascalCase, snake) to snake_case
 * so we can seed the python function name from the JS one.
 */
export function toSnakeCase(s: string): string {
    if (!s) return '';
    return s
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();
}

/**
 * Reshape a test row's args array when the params count changes. Rows whose
 * current args JSON is unparseable or the "wrong" old length are left alone,
 * because the author is probably mid-edit.
 */
export function reshapeTests(
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

/**
 * Emit a YAML scalar: plain (unquoted) when it is a safe simple identifier-like
 * or short phrase, otherwise JSON-stringified double-quoted form. JSON's
 * double-quoted strings are valid YAML.
 */
function yamlScalar(s: string): string {
    if (s.length === 0) return '""';
    const reserved = new Set([
        'true',
        'false',
        'null',
        'yes',
        'no',
        'on',
        'off',
        '~',
        'True',
        'False',
        'Null',
        'TRUE',
        'FALSE',
        'NULL',
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

function testToYaml(t: ParsedTest): string {
    const argsStr = JSON.stringify(t.args);
    const expStr = JSON.stringify(t.expected);
    const hiddenStr = t.hidden ? ', hidden: true' : '';
    return `{ args: ${argsStr}, expected: ${expStr}${hiddenStr} }`;
}

export function buildYaml(state: BuilderState, parsedTests: ParsedTest[]): string {
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

export function parseTestsAndValidate(
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
