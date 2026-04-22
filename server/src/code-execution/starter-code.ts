/**
 * Starter code representation.
 *
 * `Problem.starterCode` is a JSON string:
 * `{ javascript: { prefix, body, suffix }, python: { ... } }`.
 * The client editor shows only `body`; the server stitches
 * `prefix + userBody + suffix` before Piston runs.
 *
 * Only this object shape is supported (v2 import output).
 */

export interface LanguageStarter {
    prefix: string;
    body: string;
    suffix: string;
}

export type StarterCodeMap = Record<string, LanguageStarter>;

/**
 * Parse the JSON string stored in `Problem.starterCode`. Returns an empty
 * map when the string is missing, malformed, or not an object of harnesses.
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
