import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section } from './FormPrimitives';

interface HintsSectionProps {
    hints: string[];
    updateHint: (index: number, value: string) => void;
    addHint: () => void;
    removeHint: (index: number) => void;
}

export function HintsSection({
    hints,
    updateHint,
    addHint,
    removeHint,
}: HintsSectionProps) {
    return (
        <Section title="Hints (1-3)">
            <div className="space-y-2">
                {hints.map((h, i) => (
                    <div key={i} className="flex items-start gap-2">
                        <span className="mt-2 w-4 text-[10px] text-muted-foreground">
                            {i + 1}
                        </span>
                        <textarea
                            value={h}
                            onChange={(e) => updateHint(i, e.target.value)}
                            placeholder="Progressive hint..."
                            className="h-14 w-full resize-y rounded border border-border bg-background p-2 text-xs"
                        />
                        <button
                            onClick={() => removeHint(i)}
                            className="mt-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                            disabled={hints.length === 1}
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                ))}
                {hints.length < 3 && (
                    <Button variant="ghost" size="xs" onClick={addHint}>
                        <Plus className="mr-1 h-3 w-3" /> Add hint
                    </Button>
                )}
            </div>
        </Section>
    );
}
