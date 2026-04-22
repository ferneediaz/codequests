# Problem Authoring Guide

This directory holds the source-of-truth YAML files for every coding
problem. Each file maps to exactly one `Problem` row + its `TestCase`
rows after running the importer (`npm run problems:import`).

Two authoring formats are supported side-by-side:

- **v2 (signature)** — recommended. Describes the function signature +
  typed test cases. The server generates the IO harness for you.
- **v1 (harness)** — legacy. You write the full stdin-reading `prefix`
  and stdout-printing `suffix` by hand. Kept working for backward
  compatibility but no new problems should use it.

Use v2 for everything new.

---

## v2 at a glance

```yaml
id: problem-001-two-sum
title: Two Sum
difficulty: EASY            # EASY | MEDIUM | HARD
tags: [arrays, hash-table]
description: |
  Markdown. Shown to the solver as the problem statement.

signature:
  name:
    javascript: twoSum
    python: two_sum
  params:
    - { name: nums,   type: 'int[]' }
    - { name: target, type: int }
  returns: 'int[]'

starter:
  javascript: |
    function twoSum(nums, target) {
      // Your code here
      return [];
    }
  python: |
    def two_sum(nums, target):
        return []

tests:
  - { args: [[2, 7, 11, 15], 9], expected: [0, 1] }
  - { args: [[3, 2, 4], 6],      expected: [1, 2] }
  - { args: [[3, 3], 6],         expected: [0, 1], hidden: true }
```

You never write `console.log`, `process.stdout.write`, `sys.stdin.read`,
or `JSON.parse`. The importer compiles your signature into a per-language
harness that reads args, calls your function, and emits the answer.

### Supported types

For `params[].type` and `returns`:

| Type        | JSON shape                     | Notes                              |
|-------------|--------------------------------|------------------------------------|
| `int`       | `42`                           | Cast with `int()` in Python        |
| `float`     | `3.14`                         | Cast with `float()` in Python      |
| `bool`      | `true` / `false`               | —                                  |
| `string`    | `"hello"`                      | —                                  |
| `int[]`     | `[1, 2, 3]`                    | 1D array                           |
| `float[]`   | `[1.0, 2.5]`                   |                                    |
| `bool[]`    | `[true, false]`                |                                    |
| `string[]`  | `["a", "b"]`                   |                                    |
| `int[][]`   | `[[1, 2], [3, 4]]`             | 2D array                           |
| `float[][]` | `[[1.0, 2.5], [3.0]]`          |                                    |
| `string[][]`| `[["a"], ["b", "c"]]`          |                                    |
| `any`       | Anything JSON can represent    | Escape hatch for exotic shapes     |

Types are documentation + a hint for the codegen; they don't do heavy
type checking. The JSON decoder does the real work.

### In-place mutation problems

Some problems mutate an argument in place (e.g. Reverse String) and the
"answer" is the argument after the call, not a return value. Set
`signature.mutatesArg: <index>` so the generated suffix reads back from
that argument instead of the function's return:

```yaml
signature:
  name:
    javascript: reverseString
    python: reverse_string
  params:
    - { name: s, type: 'string[]' }
  returns: 'string[]'
  mutatesArg: 0
```

### Test case shape

Each entry under `tests` is:

```yaml
- { args: [<arg0>, <arg1>, ...], expected: <value>, hidden: false }
```

- `args` is a JSON array whose length must match `signature.params`.
- `expected` is any JSON value. Comparison is JSON-canonical (key order
  doesn't matter; whitespace doesn't matter).
- `hidden: true` hides the test from the solver; only pass/fail is
  revealed, and only up to the first hidden failure.

---

## How the pipeline works

```
YAML v2              ─┐
                      ├─ problem-loader ─► codegen ─► {prefix, body, suffix}
signature + tests    ─┘                                           │
                                                                  ▼
                                                          stored in Problem.starterCode
                                                          tests stored as
                                                          input=JSON.stringify(args)
                                                          expectedOutput=JSON.stringify(expected)
                                                                  │
                        ┌─────────────────────────────────────────┘
                        ▼
Solver submits ─► server stitches prefix+userBody+suffix ─► Piston
                                                               │
                                                               ▼
                                                         raw stdout
                                                               │
                               split on "<<<CQ_ANSWER>>>"     │
                                                               │
                                          ┌────────────────────┴────────────────────┐
                                          ▼                                         ▼
                             "Console Output" (user prints)                 answer JSON
                                   → shown in UI Console tab                 → compared to expectedOutput
```

### Why the marker?

The generated suffix prints:

```
<user's console.log / print output goes here>
\n<<<CQ_ANSWER>>>\n
<JSON-encoded answer>
```

The server splits on `<<<CQ_ANSWER>>>` so the user's own debug prints
never poison the grader. This is the LeetCode-style experience: users
can `console.log("here")` / `print("x", y)` freely; their output shows
up in the Console tab per test case; grading only cares about the
function's return value (or the mutated arg) encoded after the marker.

### Why JSON-canonical comparison?

`JSON.stringify([0, 1])` vs `JSON.stringify([0,1])` were producing
different strings under the old literal compare, breaking submissions
over a single space. The new service parses both sides and compares
canonicalized JSON, so spaces, key order, and line endings no longer
matter. Array order still matters (`[0,1] != [1,0]`) because Two Sum
and its kin genuinely care about order.

---

## Adding a new language

1. Add the language to `PISTON_LANGUAGES` in
   `src/code-execution/piston.client.ts` (if not already there).
2. Add it to `SUPPORTED_LANGUAGES` in
   `src/problems/authoring/problem-yaml.schema.ts`.
3. Add a template function (like `generateJavaScript` /
   `generatePython`) in `src/problems/authoring/harness-codegen.ts`.
   Your template must:
   - Read stdin as JSON and destructure the parameters.
   - Call the user's function.
   - Write `"\n<<<CQ_ANSWER>>>\n"` followed by the JSON of the answer.
4. Add the language entry to each existing YAML's `signature.name` and
   `starter` blocks. **You do not need to touch the `tests` section** —
   the same structured tests feed every language.

---

## Dry-run (authoring preview)

With `ENABLE_AUTHOR_TOOLS=true`:

- `GET /author/problems` — list all parsed YAMLs (v1 + v2).
- `GET /author/problems/:id` — return a parsed YAML for inspection.
- `POST /author/dry-run` — execute code without importing. Accepts
  either the v1 body (`{prefix, body, suffix, testCases}`) or the v2
  body (`{signature, body, tests}`). The v2 path runs the exact same
  codegen the importer uses, so a passing dry-run implies a passing
  import.
