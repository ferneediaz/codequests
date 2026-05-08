export type AuthoringLanguage = 'javascript' | 'python';

export type ParamType =
    | 'int'
    | 'float'
    | 'bool'
    | 'string'
    | 'int[]'
    | 'float[]'
    | 'bool[]'
    | 'string[]'
    | 'int[][]'
    | 'float[][]'
    | 'string[][]'
    | 'linked-list'
    | 'linked-list[]'
    | 'binary-tree'
    | 'binary-tree[]'
    | 'any';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface ParamDef {
    name: string;
    type: ParamType;
}

export interface TestDraft {
    id: string;
    argsJson: string;
    expectedJson: string;
    hidden: boolean;
}

export interface BuilderState {
    id: string;
    title: string;
    difficulty: Difficulty;
    tags: string[];
    description: string;
    enabled: Record<AuthoringLanguage, boolean>;
    fnName: Record<AuthoringLanguage, string>;
    params: ParamDef[];
    returns: ParamType;
    mutatesArgEnabled: boolean;
    mutatesArgIndex: number;
    starter: Record<AuthoringLanguage, string>;
    tests: TestDraft[];
    hints: string[];
    solution: string;
}

export interface ParsedTest {
    args: unknown[];
    expected: unknown;
    hidden: boolean;
}

export interface ValidateOptions {
    /** When true, enforce full YAML-level rules (hints 1-3, all langs, etc). */
    strict: boolean;
    /** For dry-run, only validate the language about to be executed. */
    activeLang?: AuthoringLanguage;
}

export interface AuthorProblemSummary {
    filename: string;
    id: string;
    title: string;
    difficulty: string;
    tags: string[];
    testCount: number;
    languages: string[];
}
