import type { LanguageStarter, StarterCodeMap } from '@/types/api';

const MARKERS: Array<{ start: string; end: string }> = [
    { start: '// ==== YOUR CODE START ====', end: '// ==== YOUR CODE END ====' },
    { start: '# ==== YOUR CODE START ====', end: '# ==== YOUR CODE END ====' },
];

/**
 * Parse the JSON string on `ProblemResponse.starterCode` into a typed map.
 * Accepts both the new `{prefix, body, suffix}` shape and the legacy flat
 * `{ lang: fullProgram }` shape, auto-splitting the latter on the YOUR CODE
 * markers so old DB rows keep rendering correctly.
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
