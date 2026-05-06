import { cn } from '@/lib/utils';
import { DIFFICULTIES } from '../constants';
import type { BuilderState, Difficulty } from '../types';
import {
    Field,
    FieldGrid,
    inputClass,
    labelClass,
    Section,
    TagChips,
} from './FormPrimitives';

interface MetaSectionProps {
    state: BuilderState;
    knownTags: string[];
    manualId: boolean;
    nextProblemNumber: number;
    setTitle: (value: string) => void;
    setIdManual: (value: string) => void;
    patch: (patch: Partial<BuilderState>) => void;
    toggleTag: (tag: string) => void;
    addCustomTag: (tag: string) => void;
}

export function MetaSection({
    state,
    knownTags,
    manualId,
    nextProblemNumber,
    setTitle,
    setIdManual,
    patch,
    toggleTag,
    addCustomTag,
}: MetaSectionProps) {
    return (
        <Section title="Metadata">
            <FieldGrid>
                <Field label="title" hint="the display name">
                    <input
                        value={state.title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Reverse String"
                        className={inputClass}
                    />
                </Field>
                <Field label="id (slug)" hint={manualId ? 'manual' : 'auto from title'}>
                    <input
                        value={state.id}
                        onChange={(e) => setIdManual(e.target.value)}
                        placeholder={`problem-${String(nextProblemNumber).padStart(3, '0')}-...`}
                        className={cn(
                            inputClass,
                            !manualId && 'text-muted-foreground/90 italic',
                        )}
                    />
                </Field>
                <Field label="difficulty">
                    <select
                        value={state.difficulty}
                        onChange={(e) =>
                            patch({ difficulty: e.target.value as Difficulty })
                        }
                        className={inputClass}
                    >
                        {DIFFICULTIES.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </Field>
            </FieldGrid>

            <div className="mt-3">
                <label className={labelClass + ' mb-1 block'}>
                    tags (click to toggle)
                </label>
                <TagChips
                    selected={state.tags}
                    known={knownTags}
                    onToggle={toggleTag}
                    onAdd={addCustomTag}
                />
            </div>
        </Section>
    );
}
