export function SectionHeader({
    icon,
    title,
    subtitle,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
}) {
    return (
        <div className="mb-4">
            <div className="flex items-center gap-2">
                {icon}
                <h2 className="text-base font-semibold">{title}</h2>
            </div>
            {subtitle && (
                <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
        </div>
    );
}
