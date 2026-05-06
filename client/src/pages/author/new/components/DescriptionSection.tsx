import type { BuilderState } from '../types';
import { Section } from './FormPrimitives';

interface DescriptionSectionProps {
    description: string;
    patch: (patch: Partial<BuilderState>) => void;
}

export function DescriptionSection({ description, patch }: DescriptionSectionProps) {
    return (
        <Section
            title="Description"
            right={
                <span className="text-[10px] text-muted-foreground">markdown</span>
            }
        >
            <textarea
                value={description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Describe the problem. Use fenced code blocks for examples."
                className="h-48 w-full resize-y rounded border border-border bg-background p-2 font-mono text-xs"
            />
        </Section>
    );
}
