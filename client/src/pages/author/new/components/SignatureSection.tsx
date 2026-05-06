import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LANGUAGES, PARAM_TYPES } from '../constants';
import type {
    AuthoringLanguage,
    BuilderState,
    ParamDef,
    ParamType,
} from '../types';
import {
    Field,
    FieldGrid,
    inputClass,
    labelClass,
    Section,
} from './FormPrimitives';

interface SignatureSectionProps {
    state: BuilderState;
    manualPyName: boolean;
    patch: (patch: Partial<BuilderState>) => void;
    setFnName: (lang: AuthoringLanguage, value: string) => void;
    toggleLang: (lang: AuthoringLanguage, enabled: boolean) => void;
    addParam: () => void;
    removeParam: (index: number) => void;
    updateParam: (index: number, patch: Partial<ParamDef>) => void;
}

export function SignatureSection({
    state,
    manualPyName,
    patch,
    setFnName,
    toggleLang,
    addParam,
    removeParam,
    updateParam,
}: SignatureSectionProps) {
    return (
        <Section title="Signature">
            <div className="mb-3 flex flex-wrap items-center gap-4">
                {LANGUAGES.map((lang) => (
                    <label key={lang} className="flex items-center gap-1.5 text-xs">
                        <input
                            type="checkbox"
                            checked={state.enabled[lang]}
                            onChange={(e) => toggleLang(lang, e.target.checked)}
                        />
                        {lang}
                    </label>
                ))}
            </div>
            <FieldGrid>
                {state.enabled.javascript && (
                    <Field label="javascript fn name">
                        <input
                            value={state.fnName.javascript}
                            onChange={(e) => setFnName('javascript', e.target.value)}
                            placeholder="reverseString"
                            className={inputClass}
                        />
                    </Field>
                )}
                {state.enabled.python && (
                    <Field
                        label="python fn name"
                        hint={manualPyName ? 'manual' : 'auto from js'}
                    >
                        <input
                            value={state.fnName.python}
                            onChange={(e) => setFnName('python', e.target.value)}
                            placeholder="reverse_string"
                            className={cn(
                                inputClass,
                                !manualPyName && 'text-muted-foreground/90 italic',
                            )}
                        />
                    </Field>
                )}
                <Field label="returns">
                    <select
                        value={state.returns}
                        onChange={(e) =>
                            patch({ returns: e.target.value as ParamType })
                        }
                        className={inputClass}
                    >
                        {PARAM_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </Field>
            </FieldGrid>

            <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                    <label className={labelClass}>params</label>
                    <Button variant="ghost" size="xs" onClick={addParam}>
                        <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                </div>
                <div className="space-y-2">
                    {state.params.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-5 text-[10px] text-muted-foreground">
                                {i}
                            </span>
                            <input
                                value={p.name}
                                onChange={(e) => updateParam(i, { name: e.target.value })}
                                placeholder="name"
                                className={inputClass + ' flex-1'}
                            />
                            <select
                                value={p.type}
                                onChange={(e) =>
                                    updateParam(i, {
                                        type: e.target.value as ParamType,
                                    })
                                }
                                className={inputClass + ' flex-1'}
                            >
                                {PARAM_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => removeParam(i)}
                                className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                                disabled={state.params.length === 1}
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-3 rounded border border-border/70 bg-muted/20 p-2">
                <label className="flex items-center gap-2 text-xs">
                    <input
                        type="checkbox"
                        checked={state.mutatesArgEnabled}
                        onChange={(e) =>
                            patch({ mutatesArgEnabled: e.target.checked })
                        }
                    />
                    <span className="font-medium">mutatesArg</span>
                    <span className="text-muted-foreground">
                        (grade by a param the function mutates in place)
                    </span>
                </label>
                {state.mutatesArgEnabled && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">param index</span>
                        <select
                            value={state.mutatesArgIndex}
                            onChange={(e) =>
                                patch({ mutatesArgIndex: Number(e.target.value) })
                            }
                            className={inputClass}
                        >
                            {state.params.map((p, i) => (
                                <option key={i} value={i}>
                                    {i} - {p.name || '(unnamed)'}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </Section>
    );
}
