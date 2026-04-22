/**
 * Starter code representation.
 *
 * Historically `Problem.starterCode` stored one full program string per
 * language (JSON-encoded `{ javascript: "<full program>", ... }`). The user
 * pasted their function inside markers and submitted the whole thing.
 *
 * New shape: `{ javascript: { prefix, body, suffix }, ... }`. The editor
 * only shows the `body`; the server stitches `prefix + body + suffix` before
 * executing. This prevents users from accidentally deleting the IO harness.
 *
 * For safety during rollout we also accept the legacy string format and
 * auto-split it on the `YOUR CODE START/END` markers.
 */

export interface LanguageStarter {
    prefix: string;
    body: string;
    suffix: string;
}

export type StarterCodeMap = Record<string, LanguageStarter>;

const MARKERS: Array<{ start: string; end: string }> = [
    { start: '// ==== YOUR CODE START ====', end: '// ==== YOUR CODE END ====' },
    { start: '# ==== YOUR CODE START ====', end: '# ==== YOUR CODE END ====' },
];

/**
 * Parse the JSON string stored in `Problem.starterCode`. Returns an empty map
 * when the string is missing or malformed so callers can treat it uniformly.
 */
export function parseStarterCode(raw: string | null | undefined): StarterCodeMap {
    if (!raw) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
    }

    const out: StarterCodeMap = {};
    for (const [lang, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string') {
            out[lang] = splitLegacyProgram(value);
        } else if (value && typeof value === 'object') {
            const v = value as Partial<LanguageStarter>;
            out[lang] = {
                prefix: typeof v.prefix === 'string' ? v.prefix : '',
                body: typeof v.body === 'string' ? v.body : '',
                suffix: typeof v.suffix === 'string' ? v.suffix : '',
            };
        }
    }
    return out;
}

/**
 * Split a legacy full-program string on the YOUR CODE markers.
 * Falls back to treating the entire program as `prefix` if markers are absent.
 */
function splitLegacyProgram(program: string): LanguageStarter {
    for (const { start, end } of MARKERS) {
        const startIdx = program.indexOf(start);
        const endIdx = program.indexOf(end);
        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) continue;

        const prefix = program.slice(0, startIdx);
        const startLineEnd = program.indexOf('\n', startIdx);
        const bodyStart = startLineEnd === -1 ? startIdx + start.length : startLineEnd + 1;
        const body = program.slice(bodyStart, endIdx);
        const endLineEnd = program.indexOf('\n', endIdx);
        const suffixStart = endLineEnd === -1 ? endIdx + end.length : endLineEnd + 1;
        const suffix = program.slice(suffixStart);
        return { prefix, body, suffix };
    }
    return { prefix: program, body: '', suffix: '' };
}

/**
 * Compose the full program sent to Piston from the user's body plus the
 * problem's IO harness. A trailing newline is ensured between body and
 * suffix so the suffix never ends up glued to the last line of user code.
 */
export function stitchSource(entry: LanguageStarter, userBody: string): string {
    const body = userBody.endsWith('\n') || userBody.length === 0 ? userBody : `${userBody}\n`;
    return `${entry.prefix}${body}${entry.suffix}`;
}

/**
 * Serialize a `StarterCodeMap` into the JSON string stored in the DB column.
 */
export function serializeStarterCode(map: StarterCodeMap): string {
    return JSON.stringify(map);
}
