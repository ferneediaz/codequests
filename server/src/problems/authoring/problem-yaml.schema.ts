import { z } from 'zod';

/**
 * Schema for a YAML problem definition in `server/problems/*.yaml`.
 *
 * v2 (signature) — the only supported format. The author declares a typed
 * function signature, the per-language `starter` function body, and
 * structured `tests` (args + expected return). The server generates the IO
 * harness from the signature via `harness-codegen.ts`.
 */

const LanguageStarterSchema = z.object({
    prefix: z.string(),
    body: z.string(),
    suffix: z.string(),
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

/**
 * Supported parameter/return types for generated harnesses.
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
    'linked-list',
    'linked-list[]',
    'binary-tree',
    'binary-tree[]',
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
    hints: z
        .array(z.string().min(1))
        .min(1, 'Provide at least 1 hint')
        .max(3, 'At most 3 hints are allowed'),
    solution: z.string().min(1),
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

/** Alias — all problems on disk are v2. */
export const ProblemYamlSchema = ProblemYamlV2Schema;

export type ProblemYamlV2 = z.infer<typeof ProblemYamlV2Schema>;
export type ProblemYaml = ProblemYamlV2;
export type LanguageStarterDefinition = z.infer<typeof LanguageStarterSchema>;
export type SignatureDefinition = z.infer<typeof SignatureSchema>;
export type StructuredTestCase = z.infer<typeof StructuredTestCaseSchema>;
