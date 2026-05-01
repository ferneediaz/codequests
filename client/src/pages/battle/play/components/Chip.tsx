export function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
            }`}
        >
            {children}
        </button>
    );
}
