import type { BuilderState } from '../types';
import { Section } from './FormPrimitives';

interface SolutionSectionProps {
    solution: string;
    patch: (patch: Partial<BuilderState>) => void;
}

export function SolutionSection({ solution, patch }: SolutionSectionProps) {
    return (
        <Section
            title="Solution"
            right={
                <span className="text-[10px] text-muted-foreground">markdown</span>
            }
        >
            <textarea
                value={solution}
                onChange={(e) => patch({ solution: e.target.value })}
                placeholder="Reference solution write-up..."
                className="h-40 w-full resize-y rounded border border-border bg-background p-2 font-mono text-xs"
            />
        </Section>
    );
}
