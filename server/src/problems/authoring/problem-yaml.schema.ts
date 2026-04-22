import { z } from 'zod';

/**
 * Schema for a YAML problem definition in `server/problems/*.yaml`.
 *
 * Every supported language must provide `{prefix, body, suffix}`:
 *   - `prefix` runs before the user's code (reads stdin, parses args)
 *   - `body` is the default function body shown to the solver
 *   - `suffix` runs after the user's code (calls the function, prints the result)
 *
 * The importer upserts the Problem by `id`, so IDs must be stable across
 * edits. Test cases are re-created on every import (delete-and-create),
 * which is safe because they have no external foreign keys.
 */

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

export const ProblemYamlSchema = z.object({
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
    languages: z
        .record(z.enum(SUPPORTED_LANGUAGES), LanguageStarterSchema)
        .refine((v) => Object.keys(v).length > 0, {
            message: 'At least one language entry is required',
        }),
    testCases: z.array(TestCaseSchema).min(1, 'At least one test case required'),
});

export type ProblemYaml = z.infer<typeof ProblemYamlSchema>;
export type LanguageStarterDefinition = z.infer<typeof LanguageStarterSchema>;
export type TestCaseDefinition = z.infer<typeof TestCaseSchema>;
