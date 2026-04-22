import { z } from 'zod';

/**
 * Schema for a YAML problem definition in `server/problems/*.yaml`.
 *
 * Two authoring formats are accepted side-by-side:
 *
 * v1 ("harness") — legacy. The author writes the full IO harness per
 * language: `prefix` (reads stdin) + `body` (function shell) + `suffix`
 * (calls the function, prints the answer). Test cases are raw stdin/stdout
 * strings. Duplicative to maintain at scale.
 *
 * v2 ("signature") — LeetCode-style. The author declares a typed function
 * signature, the per-language `starter` function body, and structured
 * `tests` (actual arg values + expected return). The server generates the
 * IO harness from the signature, so authors never touch stdin/stdout.
 *
 * The two shapes are discriminated by the presence of a top-level
 * `signature` field. Both compile down to the same on-disk storage
 * (`starterCode` JSON + `TestCase` rows), so the DB never needs to know
 * which format was used.
 */

// =============================================================================
// v1 (legacy harness) schema
// =============================================================================

const LanguageStarterSchema = z.object({
    prefix: z.string(),
    body: z.string(),
    suffix: z.string(),
});

const TestCaseSchema = z.object({
    input: z.string(),
    expectedOutput: z.string(),
    hidden: z.boolean().default(false),
});

export const DifficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD']);

export const SUPPORTED_LANGUAGES = ['javascript', 'python'] as const;
export type SupportedAuthoringLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const BaseProblemSchema = z.object({
    id: z
        .string()
        .min(1)
        .regex(
            /^[a-z0-9-]+$/,
            'id must be lowercase letters, numbers, and dashes only',
        ),
    title: z.string().min(1),
    difficulty: DifficultyEnum,
    tags: z.array(z.string()).default([]),
    description: z.string().min(1),
});

/**
 * Helper: build a "pick one or more of the supported languages" schema.
 * zod v4's `z.record(z.enum(...))` treats every enum key as required, so
 * we use an explicit object-with-optionals + a non-empty refinement.
 */
function languageMapSchema<T extends z.ZodTypeAny>(valueSchema: T) {
    return z
        .object({
            javascript: valueSchema.optional(),
            python: valueSchema.optional(),
        })
        .refine(
            (v) => Object.values(v).some((entry) => entry !== undefined),
            { message: 'At least one supported language entry is required' },
        );
}

export const ProblemYamlV1Schema = BaseProblemSchema.extend({
    languages: languageMapSchema(LanguageStarterSchema),
    testCases: z.array(TestCaseSchema).min(1, 'At least one test case required'),
});

// =============================================================================
// v2 (signature) schema
// =============================================================================

/**
 * Supported parameter/return types for generated harnesses.
 *
 * Both JS and Python consume/emit JSON natively, so at runtime these names
 * are documentation for the author plus a hint for the codegen to pick the
 * right helper (e.g. `float` forces `float()` cast in Python to avoid
 * accidental `int` when the JSON literal happens to be whole).
 *
 * `any` is an escape hatch for problems where the argument shape is
 * richer than the cheap type system here (e.g. heterogeneous tuples).
 */
export const PARAM_TYPES = [
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
export type ParamType = (typeof PARAM_TYPES)[number];

const ParamTypeSchema = z.enum(PARAM_TYPES);

const SignatureNameSchema = languageMapSchema(z.string().min(1));

const ParamSchema = z.object({
    name: z
        .string()
        .min(1)
        .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'param name must be a valid identifier'),
    type: ParamTypeSchema,
});

const SignatureSchema = z.object({
    name: SignatureNameSchema,
    params: z.array(ParamSchema),
    returns: ParamTypeSchema,
    /**
     * Index into `params` of an argument that the user's function mutates
     * in-place (e.g. `reverseString`). When set, the generated suffix
     * ignores the function's return value and emits the post-call value of
     * that argument instead.
     */
    mutatesArg: z.number().int().nonnegative().optional(),
});

const StructuredTestCaseSchema = z.object({
    args: z.array(z.any()),
    expected: z.any(),
    hidden: z.boolean().default(false),
});

export const ProblemYamlV2Schema = BaseProblemSchema.extend({
    signature: SignatureSchema,
    starter: languageMapSchema(z.string()),
    tests: z.array(StructuredTestCaseSchema).min(1, 'At least one test required'),
}).superRefine((doc, ctx) => {
    const langs = Object.keys(doc.starter).filter(
        (lang) => doc.starter[lang as SupportedAuthoringLanguage] !== undefined,
    );
    for (const lang of langs) {
        if (!doc.signature.name[lang as SupportedAuthoringLanguage]) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['signature', 'name', lang],
                message: `Missing function name for language '${lang}' (starter provided for it)`,
            });
        }
    }
    if (doc.signature.mutatesArg !== undefined) {
        if (doc.signature.mutatesArg >= doc.signature.params.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['signature', 'mutatesArg'],
                message: `mutatesArg=${doc.signature.mutatesArg} is out of range (params has ${doc.signature.params.length} entries)`,
            });
        }
    }
    for (let i = 0; i < doc.tests.length; i++) {
        const t = doc.tests[i];
        if (t.args.length !== doc.signature.params.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['tests', i, 'args'],
                message: `Expected ${doc.signature.params.length} arg(s) to match signature.params, got ${t.args.length}`,
            });
        }
    }
});

// =============================================================================
// Union + helpers
// =============================================================================

/**
 * The union accepted by the importer/loader. Discriminated by presence of
 * the top-level `signature` key: v2 when present, v1 otherwise.
 */
export const ProblemYamlSchema = z.union([
    ProblemYamlV2Schema,
    ProblemYamlV1Schema,
]);

export type ProblemYamlV1 = z.infer<typeof ProblemYamlV1Schema>;
export type ProblemYamlV2 = z.infer<typeof ProblemYamlV2Schema>;
export type ProblemYaml = ProblemYamlV1 | ProblemYamlV2;
export type LanguageStarterDefinition = z.infer<typeof LanguageStarterSchema>;
export type TestCaseDefinition = z.infer<typeof TestCaseSchema>;
export type SignatureDefinition = z.infer<typeof SignatureSchema>;
export type StructuredTestCase = z.infer<typeof StructuredTestCaseSchema>;

/**
 * Narrow a parsed problem to v2. Useful for importer/controller code that
 * wants to branch on format.
 */
export function isV2Problem(problem: ProblemYaml): problem is ProblemYamlV2 {
    return 'signature' in problem;
}
