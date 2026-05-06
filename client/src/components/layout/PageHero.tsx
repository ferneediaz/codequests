import type { CSSProperties, ReactNode } from 'react';
import { AnimateIn } from './AnimateIn';

interface PageHeroProps {
    icon: ReactNode;
    eyebrow?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    aside?: ReactNode;
    children?: ReactNode;
    accentClassName?: string;
    accentStyle?: CSSProperties;
    iconClassName?: string;
}

export function PageHero({
    icon,
    eyebrow,
    title,
    description,
    actions,
    aside,
    children,
    accentClassName = 'bg-primary/30',
    accentStyle,
    iconClassName = 'h-16 w-16 text-3xl',
}: PageHeroProps) {
    return (
        <AnimateIn direction="up">
            <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-blue-500/10 p-8 backdrop-blur-sm">
                <div
                    className={`pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-40 ${accentClassName}`}
                    style={accentStyle}
                />
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-5">
                        <div
                            className={`flex shrink-0 items-center justify-center rounded-2xl border border-border bg-background/60 shadow-lg ${iconClassName}`}
                        >
                            {icon}
                        </div>
                        <div>
                            {eyebrow && (
                                <p className="text-sm text-muted-foreground">{eyebrow}</p>
                            )}
                            <h1 className="text-3xl font-extrabold tracking-tight">
                                {title}
                            </h1>
                            {description && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                    {description}
                                </div>
                            )}
                        </div>
                    </div>
                    {actions ?? aside}
                </div>
                {children && <div className="relative mt-8">{children}</div>}
            </div>
        </AnimateIn>
    );
}
