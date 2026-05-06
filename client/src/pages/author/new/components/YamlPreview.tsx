import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface YamlPreviewProps {
    yaml: string;
    errors: string[];
    copied: boolean;
    onCopy: () => void;
}

export function YamlPreview({ yaml, errors, copied, onCopy }: YamlPreviewProps) {
    return (
        <div className="flex flex-col overflow-hidden bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Live YAML preview
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                        save as <code>server/problems/*.yaml</code>
                    </div>
                </div>
                <Button
                    size="xs"
                    variant="outline"
                    onClick={onCopy}
                    disabled={errors.length > 0}
                >
                    {copied ? (
                        <Check className="mr-1 h-3 w-3" />
                    ) : (
                        <Copy className="mr-1 h-3 w-3" />
                    )}
                    Copy
                </Button>
            </div>
            {errors.length > 0 && (
                <div className="border-b border-destructive/40 bg-destructive/10 p-2 text-[11px]">
                    <div className="mb-1 font-semibold text-destructive">
                        {errors.length} issue{errors.length === 1 ? '' : 's'} to fix
                        before copying:
                    </div>
                    <ul className="list-disc space-y-0.5 pl-4 text-foreground/90">
                        {errors.map((e, i) => (
                            <li key={i}>{e}</li>
                        ))}
                    </ul>
                </div>
            )}
            <pre
                className={cn(
                    'flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed',
                    errors.length > 0 && 'opacity-60',
                )}
            >
                {yaml}
            </pre>
        </div>
    );
}
