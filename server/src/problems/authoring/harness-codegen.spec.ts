import { generateStarterCodeMap } from './harness-codegen';
import type { ProblemYamlV2, SignatureDefinition } from './problem-yaml.schema';

function buildProblem(overrides: {
    signature: SignatureDefinition;
    starter?: { javascript?: string; python?: string };
}): ProblemYamlV2 {
    return {
        id: 'test-problem',
        title: 'Test Problem',
        difficulty: 'EASY',
        tags: [],
        description: 'desc',
        signature: overrides.signature,
        starter: overrides.starter ?? {
            javascript: 'function solve() {}\n',
            python: 'def solve():\n    pass\n',
        },
        tests: [{ args: [], expected: null, hidden: false }],
        hints: ['hint'],
        solution: 'sol',
    };
}

describe('harness-codegen', () => {
    describe('JavaScript', () => {
        it('always injects MinHeap and MaxHeap classes', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'solve', python: 'solve' },
                        params: [{ name: 'x', type: 'int' }],
                        returns: 'int',
                    },
                }),
            );
            expect(out.javascript!.prefix).toContain('class MinHeap');
            expect(out.javascript!.prefix).toContain('class MaxHeap');
        });

        it('does NOT inject ListNode/TreeNode when not needed', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'solve', python: 'solve' },
                        params: [{ name: 'x', type: 'int' }],
                        returns: 'int',
                    },
                }),
            );
            expect(out.javascript!.prefix).not.toContain('class ListNode');
            expect(out.javascript!.prefix).not.toContain('class TreeNode');
        });

        it('injects ListNode helpers and deserializes a linked-list arg', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'reverseList', python: 'reverse_list' },
                        params: [{ name: 'head', type: 'linked-list' }],
                        returns: 'linked-list',
                    },
                }),
            );
            const js = out.javascript!;
            expect(js.prefix).toContain('class ListNode');
            expect(js.prefix).toContain('function arrayToList');
            expect(js.prefix).toContain('function listToArray');
            expect(js.prefix).toContain('const head = arrayToList(__cqArgs[0]);');
            // Result must be reserialized to a flat array
            expect(js.suffix).toContain('listToArray(__cqResult)');
        });

        it('injects TreeNode helpers and deserializes a binary-tree arg', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'maxDepth', python: 'max_depth' },
                        params: [{ name: 'root', type: 'binary-tree' }],
                        returns: 'int',
                    },
                }),
            );
            const js = out.javascript!;
            expect(js.prefix).toContain('class TreeNode');
            expect(js.prefix).toContain('function arrayToTree');
            expect(js.prefix).toContain('const root = arrayToTree(__cqArgs[0]);');
            // int return does NOT get wrapped
            expect(js.suffix).toContain('JSON.stringify(__cqResult)');
        });

        it('handles linked-list[] (array of lists) via .map()', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'mergeKLists', python: 'merge_k_lists' },
                        params: [{ name: 'lists', type: 'linked-list[]' }],
                        returns: 'linked-list',
                    },
                }),
            );
            expect(out.javascript!.prefix).toContain(
                'const lists = (__cqArgs[0] || []).map(arrayToList);',
            );
        });

        it('serializes mutated linked-list arg via listToArray', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'deleteNode', python: 'delete_node' },
                        params: [{ name: 'head', type: 'linked-list' }],
                        returns: 'linked-list',
                        mutatesArg: 0,
                    },
                }),
            );
            // mutatesArg branch emits the param name, wrapped in the right serializer
            expect(out.javascript!.suffix).toContain('listToArray(head)');
        });

        it('leaves the existing primitive harness unchanged in shape', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'twoSum', python: 'two_sum' },
                        params: [
                            { name: 'nums', type: 'int[]' },
                            { name: 'target', type: 'int' },
                        ],
                        returns: 'int[]',
                    },
                }),
            );
            const js = out.javascript!;
            expect(js.prefix).toContain('const nums = __cqArgs[0];');
            expect(js.prefix).toContain('const target = __cqArgs[1];');
            expect(js.suffix).toContain('const __cqResult = twoSum(nums, target);');
        });
    });

    describe('Python', () => {
        it('does NOT inject heap helpers (heapq covers it)', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'solve', python: 'solve' },
                        params: [{ name: 'x', type: 'int' }],
                        returns: 'int',
                    },
                }),
            );
            expect(out.python!.prefix).not.toContain('MinHeap');
            expect(out.python!.prefix).not.toContain('MaxHeap');
        });

        it('injects ListNode helpers and uses array_to_list', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'reverseList', python: 'reverse_list' },
                        params: [{ name: 'head', type: 'linked-list' }],
                        returns: 'linked-list',
                    },
                }),
            );
            const py = out.python!;
            expect(py.prefix).toContain('class ListNode');
            expect(py.prefix).toContain('def array_to_list');
            expect(py.prefix).toContain('def list_to_array');
            expect(py.prefix).toContain('head = array_to_list(__cq_args[0])');
            expect(py.suffix).toContain('list_to_array(__cq_result)');
        });

        it('injects TreeNode helpers and uses array_to_tree', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'maxDepth', python: 'max_depth' },
                        params: [{ name: 'root', type: 'binary-tree' }],
                        returns: 'int',
                    },
                }),
            );
            const py = out.python!;
            expect(py.prefix).toContain('class TreeNode');
            expect(py.prefix).toContain('def array_to_tree');
            expect(py.prefix).toContain('root = array_to_tree(__cq_args[0])');
        });

        it('preserves int casting on primitive params', () => {
            const out = generateStarterCodeMap(
                buildProblem({
                    signature: {
                        name: { javascript: 'twoSum', python: 'two_sum' },
                        params: [
                            { name: 'nums', type: 'int[]' },
                            { name: 'target', type: 'int' },
                        ],
                        returns: 'int[]',
                    },
                }),
            );
            expect(out.python!.prefix).toContain('target = int(__cq_args[1])');
            expect(out.python!.prefix).toContain('nums = __cq_args[0]');
        });
    });
});
