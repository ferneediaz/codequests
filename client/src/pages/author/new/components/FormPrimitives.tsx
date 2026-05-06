import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
    'w-full rounded border border-border bg-background px-2 py-1 text-xs';
export const labelClass = 'text-[10px] uppercase tracking-wide text-muted-foreground';

export function Section({
    title,
    right,
    children,
}: {
    title: string;
    right?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="mb-5">
            <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {title}
                </h3>
                {right}
            </div>
            {children}
        </section>
    );
}

export function FieldGrid({ children }: { children: ReactNode }) {
    return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <label className="block">
            <span
                className={cn(
                    labelClass,
                    'mb-1 flex items-center justify-between',
                )}
            >
                <span>{label}</span>
                {hint && (
                    <span className="normal-case tracking-normal italic opacity-70">
                        {hint}
                    </span>
                )}
            </span>
            {children}
        </label>
    );
}

export function TagChips({
    selected,
    known,
    onToggle,
    onAdd,
}: {
    selected: string[];
    known: string[];
    onToggle: (tag: string) => void;
    onAdd: (tag: string) => void;
}) {
    const [custom, setCustom] = useState('');
    const [showInput, setShowInput] = useState(false);

    const allTags = useMemo(
        () => Array.from(new Set([...known, ...selected])).sort(),
        [known, selected],
    );

    const submit = () => {
        if (custom.trim()) onAdd(custom);
        setCustom('');
        setShowInput(false);
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {allTags.map((t) => {
                const isSelected = selected.includes(t);
                return (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onToggle(t)}
                        className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                            isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                    >
                        {t}
                    </button>
                );
            })}
            {showInput ? (
                <input
                    autoFocus
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onBlur={submit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        }
                        if (e.key === 'Escape') {
                            setCustom('');
                            setShowInput(false);
                        }
                    }}
                    placeholder="custom-tag"
                    className="w-28 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-[11px]"
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setShowInput(true)}
                    className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                >
                    + custom
                </button>
            )}
        </div>
    );
}
