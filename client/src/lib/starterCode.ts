import type { LanguageStarter, StarterCodeMap } from '@/types/api';

/**
 * Parse the JSON string on `ProblemResponse.starterCode` into a typed map.
 * Expects `{ lang: { prefix, body, suffix } }` as produced by v2 import
 * (harness codegen).
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
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const v = value as Partial<LanguageStarter>;
        out[lang] = {
            prefix: typeof v.prefix === 'string' ? v.prefix : '',
            body: typeof v.body === 'string' ? v.body : '',
            suffix: typeof v.suffix === 'string' ? v.suffix : '',
        };
    }
    return out;
}
