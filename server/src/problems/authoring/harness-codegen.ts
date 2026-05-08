import {
    ParamType,
    ProblemYamlV2,
    SignatureDefinition,
    SupportedAuthoringLanguage,
} from './problem-yaml.schema';
import { LanguageStarter, StarterCodeMap } from '../../code-execution/starter-code';

/**
 * Per-language harness codegen for v2 ("signature") problems.
 *
 * The author describes the function signature; this module produces the
 * `{prefix, body, suffix}` triple that the existing Piston pipeline already
 * knows how to execute. The generated program:
 *
 *   1. Reads a single-line JSON array from stdin — that is the list of
 *      arguments for the current test case.
 *   2. Binds each array slot to a local with the name from `params[i].name`
 *      so the author's function body reads naturally. Special types
 *      (`linked-list`, `binary-tree`, ...) are deserialized through
 *      injected helper classes so the user's function receives a real
 *      `ListNode` / `TreeNode` instance.
 *   3. Calls the user's function with those arguments.
 *   4. Emits a sentinel line (`ANSWER_MARKER`) followed by the JSON of the
 *      return value (or the post-call value of the mutated arg).
 *      `ListNode` / `TreeNode` returns are reserialized to LeetCode-style
 *      flat arrays before being JSON-encoded so the existing canonical-JSON
 *      comparison in `code-execution.service.ts` works unchanged.
 *
 *   For JavaScript, `MinHeap` and `MaxHeap` are always injected — JS has no
 *   built-in priority queue and heap-based interview problems are common.
 *   Python ships `heapq`, so no heap injection is needed there.
 */

/**
 * Sentinel printed by the generated suffix just before the answer. Chosen
 * to be extremely unlikely to appear in normal user output. The matching
 * split lives in `code-execution.service.ts`.
 */
export const ANSWER_MARKER = '<<<CQ_ANSWER>>>';

/** Serialize one test case's args to the single-line stdin payload. */
export function encodeTestInput(args: unknown[]): string {
    return JSON.stringify(args);
}

/** Serialize one test case's expected return value to the stored string. */
export function encodeTestExpected(expected: unknown): string {
    return JSON.stringify(expected);
}

/**
 * Build the `StarterCodeMap` that gets JSON-encoded into
 * `Problem.starterCode`. One entry per language declared in `starter`.
 */
export function generateStarterCodeMap(problem: ProblemYamlV2): StarterCodeMap {
    const out: StarterCodeMap = {};
    for (const [lang, body] of Object.entries(problem.starter)) {
        if (body === undefined) continue;
        const language = lang as SupportedAuthoringLanguage;
        out[language] = generateLanguageStarter(language, problem.signature, body);
    }
    return out;
}

function generateLanguageStarter(
    language: SupportedAuthoringLanguage,
    signature: SignatureDefinition,
    body: string,
): LanguageStarter {
    switch (language) {
        case 'javascript':
            return generateJavaScript(signature, body);
        case 'python':
            return generatePython(signature, body);
        default: {
            const never: never = language;
            throw new Error(`Unsupported language for codegen: ${never as string}`);
        }
    }
}

// =============================================================================
// Helper-class libraries
// =============================================================================
// These string blocks are spliced into the harness prefix when the signature
// uses the matching type. Heap helpers are JS-only (Python has heapq).

const JS_LIB_HEAP = `class MinHeap {
  constructor(items = [], compare = null) {
    this._compare = compare || ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    this.heap = items.slice();
    for (let __i = (this.heap.length >> 1) - 1; __i >= 0; __i--) this._down(__i);
  }
  size() { return this.heap.length; }
  peek() { return this.heap[0]; }
  push(v) { this.heap.push(v); this._up(this.heap.length - 1); }
  pop() {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) { this.heap[0] = last; this._down(0); }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._compare(this.heap[i], this.heap[p]) < 0) {
        const t = this.heap[i]; this.heap[i] = this.heap[p]; this.heap[p] = t;
        i = p;
      } else break;
    }
  }
  _down(i) {
    const n = this.heap.length;
    while (true) {
      const l = 2 * i + 1, r = 2 * i + 2;
      let s = i;
      if (l < n && this._compare(this.heap[l], this.heap[s]) < 0) s = l;
      if (r < n && this._compare(this.heap[r], this.heap[s]) < 0) s = r;
      if (s === i) break;
      const t = this.heap[i]; this.heap[i] = this.heap[s]; this.heap[s] = t;
      i = s;
    }
  }
}
class MaxHeap extends MinHeap {
  constructor(items = [], compare = null) {
    super(items, compare ? (a, b) => -compare(a, b) : (a, b) => (a > b ? -1 : a < b ? 1 : 0));
  }
}
`;

const JS_LIB_LIST = `class ListNode {
  constructor(val = 0, next = null) { this.val = val; this.next = next; }
}
function arrayToList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const head = new ListNode(arr[0]);
  let cur = head;
  for (let i = 1; i < arr.length; i++) { cur.next = new ListNode(arr[i]); cur = cur.next; }
  return head;
}
function listToArray(head) {
  const out = [];
  let cur = head;
  while (cur) { out.push(cur.val); cur = cur.next; }
  return out;
}
`;

const JS_LIB_TREE = `class TreeNode {
  constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; }
}
function arrayToTree(arr) {
  if (!Array.isArray(arr) || arr.length === 0 || arr[0] == null) return null;
  const root = new TreeNode(arr[0]);
  const q = [root];
  let h = 0, i = 1;
  while (h < q.length && i < arr.length) {
    const node = q[h++];
    if (i < arr.length) { const v = arr[i++]; if (v != null) { node.left = new TreeNode(v); q.push(node.left); } }
    if (i < arr.length) { const v = arr[i++]; if (v != null) { node.right = new TreeNode(v); q.push(node.right); } }
  }
  return root;
}
function treeToArray(root) {
  if (!root) return [];
  const out = [];
  const q = [root];
  let h = 0;
  while (h < q.length) {
    const node = q[h++];
    if (node === null) { out.push(null); continue; }
    out.push(node.val);
    q.push(node.left);
    q.push(node.right);
  }
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}
`;

const PY_LIB_LIST = `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def array_to_list(arr):
    if not arr:
        return None
    head = ListNode(arr[0])
    cur = head
    for v in arr[1:]:
        cur.next = ListNode(v)
        cur = cur.next
    return head

def list_to_array(head):
    out = []
    cur = head
    while cur is not None:
        out.append(cur.val)
        cur = cur.next
    return out
`;

const PY_LIB_TREE = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def array_to_tree(arr):
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0])
    q = [root]
    head = 0
    i = 1
    while head < len(q) and i < len(arr):
        node = q[head]; head += 1
        if i < len(arr):
            v = arr[i]; i += 1
            if v is not None:
                node.left = TreeNode(v)
                q.append(node.left)
        if i < len(arr):
            v = arr[i]; i += 1
            if v is not None:
                node.right = TreeNode(v)
                q.append(node.right)
    return root

def tree_to_array(root):
    if root is None:
        return []
    out = []
    q = [root]
    head = 0
    while head < len(q):
        node = q[head]; head += 1
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        q.append(node.left)
        q.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out
`;

const LIST_TYPES: ParamType[] = ['linked-list', 'linked-list[]'];
const TREE_TYPES: ParamType[] = ['binary-tree', 'binary-tree[]'];

function signatureUses(sig: SignatureDefinition, types: ParamType[]): boolean {
    return sig.params.some((p) => types.includes(p.type)) || types.includes(sig.returns);
}

// =============================================================================
// JavaScript
// =============================================================================

function generateJavaScript(
    signature: SignatureDefinition,
    body: string,
): LanguageStarter {
    const fnName = signature.name.javascript;
    if (!fnName) {
        throw new Error(
            'signature.name.javascript is required when starter.javascript is provided',
        );
    }
    const argNames = signature.params.map((p) => p.name);

    const libBlocks =
        JS_LIB_HEAP +
        (signatureUses(signature, LIST_TYPES) ? JS_LIB_LIST : '') +
        (signatureUses(signature, TREE_TYPES) ? JS_LIB_TREE : '');

    const argLines = signature.params
        .map((p, i) => `const ${p.name} = ${jsArgExpr(`__cqArgs[${i}]`, p.type)};`)
        .join('\n');

    const prefix =
        libBlocks +
        `\n` +
        `const __cqInput = require('fs').readFileSync(0, 'utf8');\n` +
        `const __cqArgs = __cqInput.length ? JSON.parse(__cqInput) : [];\n` +
        (argLines.length > 0 ? `${argLines}\n` : '');

    const answerName =
        signature.mutatesArg !== undefined
            ? argNames[signature.mutatesArg]
            : '__cqResult';
    const answerType: ParamType =
        signature.mutatesArg !== undefined
            ? signature.params[signature.mutatesArg].type
            : signature.returns;

    const callLine =
        signature.mutatesArg !== undefined
            ? `${fnName}(${argNames.join(', ')});`
            : `const __cqResult = ${fnName}(${argNames.join(', ')});`;

    const suffix =
        `${callLine}\n` +
        `process.stdout.write('\\n${ANSWER_MARKER}\\n' + JSON.stringify(${jsResultExpr(answerName, answerType)}));\n`;

    return { prefix, body: ensureTrailingNewline(body), suffix };
}

function jsArgExpr(expr: string, type: ParamType): string {
    switch (type) {
        case 'linked-list':
            return `arrayToList(${expr})`;
        case 'linked-list[]':
            return `(${expr} || []).map(arrayToList)`;
        case 'binary-tree':
            return `arrayToTree(${expr})`;
        case 'binary-tree[]':
            return `(${expr} || []).map(arrayToTree)`;
        default:
            return expr;
    }
}

function jsResultExpr(name: string, type: ParamType): string {
    switch (type) {
        case 'linked-list':
            return `listToArray(${name})`;
        case 'linked-list[]':
            return `(${name} || []).map(listToArray)`;
        case 'binary-tree':
            return `treeToArray(${name})`;
        case 'binary-tree[]':
            return `(${name} || []).map(treeToArray)`;
        default:
            return name;
    }
}

// =============================================================================
// Python
// =============================================================================

function generatePython(
    signature: SignatureDefinition,
    body: string,
): LanguageStarter {
    const fnName = signature.name.python;
    if (!fnName) {
        throw new Error(
            'signature.name.python is required when starter.python is provided',
        );
    }
    const argNames = signature.params.map((p) => p.name);

    const libBlocks =
        (signatureUses(signature, LIST_TYPES) ? PY_LIB_LIST : '') +
        (signatureUses(signature, TREE_TYPES) ? PY_LIB_TREE : '');

    const prefixLines: string[] = ['import sys, json', ''];
    if (libBlocks.length > 0) {
        prefixLines.push(libBlocks.replace(/\n+$/, ''));
        prefixLines.push('');
    }
    prefixLines.push(
        '__cq_input = sys.stdin.read()',
        '__cq_args = json.loads(__cq_input) if __cq_input else []',
    );
    for (let i = 0; i < signature.params.length; i++) {
        const { name, type } = signature.params[i];
        prefixLines.push(`${name} = ${pythonCast(`__cq_args[${i}]`, type)}`);
    }
    prefixLines.push('');
    const prefix = prefixLines.join('\n');

    const callLine =
        signature.mutatesArg !== undefined
            ? `${fnName}(${argNames.join(', ')})`
            : `__cq_result = ${fnName}(${argNames.join(', ')})`;

    const answerName =
        signature.mutatesArg !== undefined
            ? argNames[signature.mutatesArg]
            : '__cq_result';
    const answerType: ParamType =
        signature.mutatesArg !== undefined
            ? signature.params[signature.mutatesArg].type
            : signature.returns;

    const suffix =
        `${callLine}\n` +
        `sys.stdout.write('\\n${ANSWER_MARKER}\\n' + json.dumps(${pythonEncode(answerName, answerType)}, separators=(',', ':')))\n`;

    return { prefix, body: ensureTrailingNewline(body), suffix };
}

/**
 * Wrap a raw JSON-decoded python value with the conversion that best matches
 * the declared type. Most types round-trip fine, but `float` is worth forcing
 * so that a whole-number JSON literal doesn't sneak through as `int`. The
 * `linked-list` / `binary-tree` cases call helpers injected into the prefix.
 * `any` / arrays / strings / bools are passed through untouched.
 */
function pythonCast(expr: string, type: ParamType): string {
    switch (type) {
        case 'float':
            return `float(${expr})`;
        case 'int':
            return `int(${expr})`;
        case 'linked-list':
            return `array_to_list(${expr})`;
        case 'linked-list[]':
            return `[array_to_list(__cq_x) for __cq_x in (${expr} or [])]`;
        case 'binary-tree':
            return `array_to_tree(${expr})`;
        case 'binary-tree[]':
            return `[array_to_tree(__cq_x) for __cq_x in (${expr} or [])]`;
        default:
            return expr;
    }
}

/**
 * Normalize a value about to be JSON-encoded for the answer line. Booleans
 * encode the same in Python and JSON. For `float` the explicit cast keeps
 * output deterministic (`json.dumps(1)` vs `json.dumps(1.0)`). For
 * `linked-list` / `binary-tree`, reserialize back to a flat array so the
 * existing canonical-JSON comparator works.
 */
function pythonEncode(expr: string, type: ParamType): string {
    switch (type) {
        case 'float':
            return `float(${expr})`;
        case 'linked-list':
            return `list_to_array(${expr})`;
        case 'linked-list[]':
            return `[list_to_array(__cq_x) for __cq_x in (${expr} or [])]`;
        case 'binary-tree':
            return `tree_to_array(${expr})`;
        case 'binary-tree[]':
            return `[tree_to_array(__cq_x) for __cq_x in (${expr} or [])]`;
        default:
            return expr;
    }
}

// =============================================================================
// Shared
// =============================================================================

function ensureTrailingNewline(s: string): string {
    if (s.length === 0) return s;
    return s.endsWith('\n') ? s : `${s}\n`;
}

/**
 * Generate a stub function body per language from a signature. Used by the
 * community contribution pipeline: contributors write their working code as
 * the reference solution; on approval the published Problem ships with this
 * stub so users see a fresh prompt rather than the answer.
 */
export function generateStubBody(
    signature: SignatureDefinition,
    language: SupportedAuthoringLanguage,
): string {
    const argNames = signature.params.map((p) => p.name);
    if (language === 'javascript') {
        const fnName = signature.name.javascript ?? 'solve';
        return (
            `function ${fnName}(${argNames.join(', ')}) {\n` +
            `  // Your code here\n` +
            `}\n`
        );
    }
    const fnName = signature.name.python ?? 'solve';
    return (
        `def ${fnName}(${argNames.join(', ')}):\n` +
        `    # Your code here\n` +
        `    pass\n`
    );
}
