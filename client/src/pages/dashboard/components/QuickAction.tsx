import { ChevronRight } from 'lucide-react';
import { AnimateIn } from '@/components/layout/AnimateIn';

export function QuickAction({
    title,
    description,
    icon,
    onClick,
    delay = 0,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    delay?: number;
}) {
    return (
        <AnimateIn delay={delay} direction="up">
            <button
                onClick={onClick}
                className="group relative flex w-full items-center gap-4 rounded-2xl border border-border bg-card/50 p-5 text-left transition-all hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5"
            >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </button>
        </AnimateIn>
    );
}
