export function StatCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="group relative flex flex-col gap-6 overflow-hidden rounded-xl border bg-card py-6 text-card-foreground shadow-sm transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            {children}
        </div>
    );
}
