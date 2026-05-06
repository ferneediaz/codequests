import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Copy, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AuthoringLanguage, BuilderState } from '../types';

interface AuthorHeaderProps {
    state: BuilderState;
    isRunning: boolean;
    copied: boolean;
    yamlOpen: boolean;
    errors: string[];
    availableLangs: AuthoringLanguage[];
    effectiveActiveLang: AuthoringLanguage;
    onRun: () => void;
    onCopy: () => void;
    onToggleYaml: () => void;
}

export function AuthorHeader({
    state,
    isRunning,
    copied,
    yamlOpen,
    errors,
    availableLangs,
    effectiveActiveLang,
    onRun,
    onCopy,
    onToggleYaml,
}: AuthorHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
            <div className="flex items-center gap-3">
                <Link to="/author">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> All drafts
                    </Button>
                </Link>
                <div>
                    <div className="text-sm font-semibold">
                        {state.title || 'New problem'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                        {state.id || '(auto-slug)'} · {state.difficulty} ·{' '}
                        {state.tags.length > 0 ? state.tags.join(', ') : 'no tags'}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    onClick={onRun}
                    disabled={isRunning || availableLangs.length === 0}
                    size="sm"
                    variant="outline"
                >
                    {isRunning ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Run tests ({effectiveActiveLang})
                </Button>
                <Button
                    onClick={onCopy}
                    size="sm"
                    disabled={errors.length > 0}
                    title={
                        errors.length > 0
                            ? 'Fix validation errors first'
                            : 'Copy YAML to clipboard'
                    }
                >
                    {copied ? (
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Copy YAML
                </Button>
                <Button onClick={onToggleYaml} size="sm" variant="ghost">
                    <ChevronRight
                        className={cn(
                            'mr-1 h-3.5 w-3.5 transition-transform',
                            yamlOpen ? 'rotate-180' : '',
                        )}
                    />
                    {yamlOpen ? 'Hide YAML' : 'Show YAML'}
                </Button>
            </div>
        </div>
    );
}
