import {
    ParamType,
    ProblemYamlV2,
    SignatureDefinition,
    SupportedAuthoringLanguage,
} from './problem-yaml.schema';
import { LanguageStarter, StarterCodeMap } from '../../code-execution/starter-code';

/**
 * Per-language harness codegen for v2 ("signature") problems.
 *
 * The author describes the function signature; this module produces the
 * `{prefix, body, suffix}` triple that the existing Piston pipeline already
 * knows how to execute. The generated program:
 *
 *   1. Reads a single-line JSON array from stdin — that is the list of
 *      arguments for the current test case.
 *   2. Binds each array slot to a local with the name from `params[i].name`
 *      so the author's function body reads naturally.
 *   3. Calls the user's function with those arguments.
 *   4. Emits a sentinel line (`ANSWER_MARKER`) followed by the JSON of the
 *      return value (or the post-call value of the mutated arg). Everything
 *      the user printed with `console.log` / `print` lands *before* the
 *      marker, which lets the server route it to the Console tab instead of
 *      breaking grading.
 *
 * Keeping this module tiny and language-local is the whole point: adding
 * a new language means adding one template function here, not editing
 * thousands of YAMLs.
 */

/**
 * Sentinel printed by the generated suffix just before the answer. Chosen
 * to be extremely unlikely to appear in normal user output. The matching
 * split lives in `code-execution.service.ts`.
 */
export const ANSWER_MARKER = '<<<CQ_ANSWER>>>';

/** Serialize one test case's args to the single-line stdin payload. */
export function encodeTestInput(args: unknown[]): string {
    return JSON.stringify(args);
}

/** Serialize one test case's expected return value to the stored string. */
export function encodeTestExpected(expected: unknown): string {
    return JSON.stringify(expected);
}

/**
 * Build the `StarterCodeMap` that gets JSON-encoded into
 * `Problem.starterCode`. One entry per language declared in `starter`.
 */
export function generateStarterCodeMap(problem: ProblemYamlV2): StarterCodeMap {
    const out: StarterCodeMap = {};
    for (const [lang, body] of Object.entries(problem.starter)) {
        if (body === undefined) continue;
        const language = lang as SupportedAuthoringLanguage;
        out[language] = generateLanguageStarter(language, problem.signature, body);
    }
    return out;
}

function generateLanguageStarter(
    language: SupportedAuthoringLanguage,
    signature: SignatureDefinition,
    body: string,
): LanguageStarter {
    switch (language) {
        case 'javascript':
            return generateJavaScript(signature, body);
        case 'python':
            return generatePython(signature, body);
        default: {
            const never: never = language;
            throw new Error(`Unsupported language for codegen: ${never as string}`);
        }
    }
}

// =============================================================================
// JavaScript
// =============================================================================

function generateJavaScript(
    signature: SignatureDefinition,
    body: string,
): LanguageStarter {
    const fnName = signature.name.javascript;
    if (!fnName) {
        throw new Error(
            'signature.name.javascript is required when starter.javascript is provided',
        );
    }
    const argNames = signature.params.map((p) => p.name);
    const destructuring = argNames.length > 0 ? `[${argNames.join(', ')}]` : '[]';

    const prefix =
        `const __cqInput = require('fs').readFileSync(0, 'utf8');\n` +
        `const __cqArgs = __cqInput.length ? JSON.parse(__cqInput) : [];\n` +
        (argNames.length > 0
            ? `const ${destructuring} = __cqArgs;\n`
            : '');

    const answerExpr =
        signature.mutatesArg !== undefined
            ? argNames[signature.mutatesArg]
            : '__cqResult';

    const callLine =
        signature.mutatesArg !== undefined
            ? `${fnName}(${argNames.join(', ')});`
            : `const __cqResult = ${fnName}(${argNames.join(', ')});`;

    const suffix =
        `${callLine}\n` +
        `process.stdout.write('\\n${ANSWER_MARKER}\\n' + JSON.stringify(${answerExpr}));\n`;

    return { prefix, body: ensureTrailingNewline(body), suffix };
}

// =============================================================================
// Python
// =============================================================================

function generatePython(
    signature: SignatureDefinition,
    body: string,
): LanguageStarter {
    const fnName = signature.name.python;
    if (!fnName) {
        throw new Error(
            'signature.name.python is required when starter.python is provided',
        );
    }
    const argNames = signature.params.map((p) => p.name);

    const prefixLines: string[] = [
        'import sys, json',
        '',
        '__cq_input = sys.stdin.read()',
        '__cq_args = json.loads(__cq_input) if __cq_input else []',
    ];
    for (let i = 0; i < signature.params.length; i++) {
        const { name, type } = signature.params[i];
        prefixLines.push(`${name} = ${pythonCast(`__cq_args[${i}]`, type)}`);
    }
    prefixLines.push('');
    const prefix = prefixLines.join('\n');

    const callLine =
        signature.mutatesArg !== undefined
            ? `${fnName}(${argNames.join(', ')})`
            : `__cq_result = ${fnName}(${argNames.join(', ')})`;

    const answerExpr =
        signature.mutatesArg !== undefined
            ? argNames[signature.mutatesArg]
            : '__cq_result';

    const suffix =
        `${callLine}\n` +
        `sys.stdout.write('\\n${ANSWER_MARKER}\\n' + json.dumps(${pythonEncode(answerExpr, signature.returns)}, separators=(',', ':')))\n`;

    return { prefix, body: ensureTrailingNewline(body), suffix };
}

/**
 * Wrap a raw JSON-decoded python value with the cast that best matches the
 * declared type. Most types round-trip fine, but `float` is worth forcing
 * so that a whole-number JSON literal doesn't sneak through as `int`.
 * `any` / arrays / strings / bools are passed through untouched.
 */
function pythonCast(expr: string, type: ParamType): string {
    switch (type) {
        case 'float':
            return `float(${expr})`;
        case 'int':
            return `int(${expr})`;
        default:
            return expr;
    }
}

/**
 * Normalize a value about to be JSON-encoded for the answer line. Booleans
 * encode the same in Python and JSON. For `float` the explicit cast keeps
 * output deterministic (`json.dumps(1)` vs `json.dumps(1.0)`).
 */
function pythonEncode(expr: string, type: ParamType): string {
    switch (type) {
        case 'float':
            return `float(${expr})`;
        default:
            return expr;
    }
}

// =============================================================================
// Shared
// =============================================================================

function ensureTrailingNewline(s: string): string {
    if (s.length === 0) return s;
    return s.endsWith('\n') ? s : `${s}\n`;
}

/**
 * Generate a stub function body per language from a signature. Used by the
 * community contribution pipeline: contributors write their working code as
 * the reference solution; on approval the published Problem ships with this
 * stub so users see a fresh prompt rather than the answer.
 */
export function generateStubBody(
    signature: SignatureDefinition,
    language: SupportedAuthoringLanguage,
): string {
    const argNames = signature.params.map((p) => p.name);
    if (language === 'javascript') {
        const fnName = signature.name.javascript ?? 'solve';
        return (
            `function ${fnName}(${argNames.join(', ')}) {\n` +
            `  // Your code here\n` +
            `}\n`
        );
    }
    const fnName = signature.name.python ?? 'solve';
    return (
        `def ${fnName}(${argNames.join(', ')}):\n` +
        `    # Your code here\n` +
        `    pass\n`
    );
}
