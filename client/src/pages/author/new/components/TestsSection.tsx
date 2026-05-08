import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SubmissionResult } from '@/types/api';
import type { ParamDef, ParamType, TestDraft } from '../types';

interface TestsSectionProps {
    tests: TestDraft[];
    params: ParamDef[];
    returns: ParamType;
    result: SubmissionResult | null;
    addTest: () => void;
    removeTest: (id: string) => void;
    updateTest: (id: string, patch: Partial<TestDraft>) => void;
}

const LIST_TYPES: ParamType[] = ['linked-list', 'linked-list[]'];
const TREE_TYPES: ParamType[] = ['binary-tree', 'binary-tree[]'];

function usesType(types: ParamType[], params: ParamDef[], returns: ParamType): boolean {
    return types.includes(returns) || params.some((p) => types.includes(p.type));
}

export function TestsSection({
    tests,
    params,
    returns,
    result,
    addTest,
    removeTest,
    updateTest,
}: TestsSectionProps) {
    const hasList = usesType(LIST_TYPES, params, returns);
    const hasTree = usesType(TREE_TYPES, params, returns);
    return (
        <div className="flex flex-col overflow-hidden border-t border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Tests - args (JSON array) + expected (JSON)
                </span>
                <div className="flex items-center gap-3">
                    {result && (
                        <span className="text-[11px] text-muted-foreground">
                            {result.passed}/{result.total} passed
                        </span>
                    )}
                    <Button variant="ghost" size="xs" onClick={addTest}>
                        <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                </div>
            </div>
            {(hasList || hasTree) && (
                <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    {hasList && (
                        <div>
                            <span className="font-mono text-foreground">linked-list</span>: flat array, e.g.{' '}
                            <span className="font-mono">[1,2,3,4]</span> (empty list ={' '}
                            <span className="font-mono">[]</span>)
                        </div>
                    )}
                    {hasTree && (
                        <div>
                            <span className="font-mono text-foreground">binary-tree</span>: level-order with nulls, e.g.{' '}
                            <span className="font-mono">[3,9,20,null,null,15,7]</span> (empty tree ={' '}
                            <span className="font-mono">[]</span>)
                        </div>
                    )}
                </div>
            )}
            <div className="flex-1 overflow-y-auto">
                {tests.map((row, i) => {
                    const res = result?.results.find(
                        (r) => r.testCaseId === `adhoc-${i}`,
                    );
                    return (
                        <div key={row.id} className="border-b border-border p-3">
                            <div className="mb-1 flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                    #{i + 1}
                                    {res && (
                                        <span
                                            className={
                                                res.passed
                                                    ? 'ml-2 text-green-500'
                                                    : 'ml-2 text-red-500'
                                            }
                                        >
                                            {res.passed ? 'PASS' : 'FAIL'}
                                        </span>
                                    )}
                                </span>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={row.hidden}
                                            onChange={(e) =>
                                                updateTest(row.id, {
                                                    hidden: e.target.checked,
                                                })
                                            }
                                        />
                                        hidden
                                    </label>
                                    <button
                                        onClick={() => removeTest(row.id)}
                                        className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                                        disabled={tests.length === 1}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase text-muted-foreground">
                                        args
                                    </label>
                                    <textarea
                                        value={row.argsJson}
                                        onChange={(e) =>
                                            updateTest(row.id, {
                                                argsJson: e.target.value,
                                            })
                                        }
                                        className="h-14 w-full resize-y rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase text-muted-foreground">
                                        expected
                                    </label>
                                    <textarea
                                        value={row.expectedJson}
                                        onChange={(e) =>
                                            updateTest(row.id, {
                                                expectedJson: e.target.value,
                                            })
                                        }
                                        className="h-14 w-full resize-y rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                                    />
                                </div>
                            </div>
                            {res && !res.passed && (
                                <div className="mt-1 rounded bg-muted/40 p-2 text-[11px]">
                                    <div className="text-muted-foreground">actual:</div>
                                    <pre className="whitespace-pre-wrap font-mono">
                                        {res.actualOutput ?? ''}
                                    </pre>
                                    {res.error && (
                                        <>
                                            <div className="mt-1 text-muted-foreground">
                                                error:
                                            </div>
                                            <pre className="whitespace-pre-wrap font-mono text-red-400">
                                                {res.error}
                                            </pre>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
