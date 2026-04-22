import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ProblemYaml, ProblemYamlSchema } from './problem-yaml.schema';
import { StarterCodeMap } from '../../code-execution/starter-code';

/**
 * Location of YAML problem definitions, resolved relative to the repo root
 * so the path is stable whether we run via ts-node (from source) or from the
 * compiled `dist/` output.
 */
export const PROBLEMS_DIR = path.resolve(__dirname, '../../../problems');

export interface LoadedProblem {
    filename: string;
    problem: ProblemYaml;
}

/**
 * Read every `*.yaml` / `*.yml` file under `server/problems/` and parse +
 * validate it. Throws a single aggregated error listing every file that
 * failed validation so the author can fix them all in one go.
 */
export function loadAllProblems(dir: string = PROBLEMS_DIR): LoadedProblem[] {
    if (!fs.existsSync(dir)) return [];

    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .sort();

    const loaded: LoadedProblem[] = [];
    const errors: string[] = [];

    for (const file of files) {
        const full = path.join(dir, file);
        try {
            loaded.push({ filename: file, problem: loadProblemFile(full) });
        } catch (err) {
            errors.push(`${file}: ${(err as Error).message}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(
            `Failed to load ${errors.length} problem file(s):\n  - ${errors.join('\n  - ')}`,
        );
    }

    const seenIds = new Map<string, string>();
    for (const { filename, problem } of loaded) {
        const prior = seenIds.get(problem.id);
        if (prior) {
            throw new Error(
                `Duplicate problem id '${problem.id}' in ${filename} (also in ${prior})`,
            );
        }
        seenIds.set(problem.id, filename);
    }

    return loaded;
}

/**
 * Parse + Zod-validate a single YAML file. Used by both the importer CLI
 * (where it runs for every file) and the authoring controller (when it
 * serves a single problem preview).
 */
export function loadProblemFile(absPath: string): ProblemYaml {
    const raw = fs.readFileSync(absPath, 'utf8');
    const doc = yaml.load(raw);
    const parsed = ProblemYamlSchema.safeParse(doc);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
            .join('; ');
        throw new Error(`validation failed: ${issues}`);
    }
    return parsed.data;
}

/**
 * Read a single problem YAML by its `id`. Scans the directory because the
 * filename is not required to match the id (authors can name files freely).
 */
export function loadProblemById(
    id: string,
    dir: string = PROBLEMS_DIR,
): { filename: string; problem: ProblemYaml } | null {
    const all = loadAllProblems(dir);
    return all.find((p) => p.problem.id === id) ?? null;
}

/**
 * Convert the YAML `languages` block into the JSON shape we store in
 * `Problem.starterCode` on the DB row.
 */
export function toStarterCodeMap(problem: ProblemYaml): StarterCodeMap {
    const map: StarterCodeMap = {};
    for (const [lang, starter] of Object.entries(problem.languages)) {
        if (!starter) continue;
        map[lang] = {
            prefix: starter.prefix,
            body: starter.body,
            suffix: starter.suffix,
        };
    }
    return map;
}
