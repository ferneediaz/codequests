import type { AuthoringLanguage, Difficulty, ParamType } from './types';

export const LANGUAGES: AuthoringLanguage[] = ['javascript', 'python'];

/**
 * Mirrors `server/src/problems/authoring/problem-yaml.schema.ts#PARAM_TYPES`.
 * Keep in sync; server will reject anything outside this set.
 */
export const PARAM_TYPES: ParamType[] = [
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
];

export const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export const MONACO_LANG: Record<AuthoringLanguage, string> = {
    javascript: 'javascript',
    python: 'python',
};

export const DEFAULT_STARTER: Record<AuthoringLanguage, string> = {
    javascript: `function solve(nums) {\n  // Your code here\n  return 0;\n}\n`,
    python: `def solve(nums):\n    # Your code here\n    return 0\n`,
};

/**
 * Baseline tag vocabulary. Extra tags from existing YAML files are merged in
 * on mount so the picker always offers whatever the repo already uses.
 */
export const PRESET_TAGS = [
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
