type AmbientBackgroundProps = {
    variant?: 'default' | 'glow' | 'grid' | 'soft';
    className?: string;
};

/**
 * Ambient decorative background for page heroes.
 * Renders a radial primary glow, a subtle grid, and a bottom fade.
 * Always pointer-events-none and absolutely positioned — place inside a
 * `relative` container.
 */
export function AmbientBackground({
    variant = 'default',
    className = '',
}: AmbientBackgroundProps) {
    const showGlow = variant === 'default' || variant === 'glow' || variant === 'soft';
    const showGrid = variant === 'default' || variant === 'grid';
    const showFade = variant === 'default' || variant === 'glow';

    return (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
            {showGlow && (
                <>
                    <div
                        className={`absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] ${variant === 'soft'
                            ? 'h-[320px] w-[520px] opacity-60'
                            : 'h-[500px] w-[700px]'
                            }`}
                    />
                    {variant !== 'soft' && (
                        <div className="absolute bottom-0 right-0 h-[280px] w-[380px] translate-x-1/3 translate-y-1/3 rounded-full bg-violet-500/10 blur-[100px]" />
                    )}
                </>
            )}
            {showGrid && (
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
            )}
            {showFade && (
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
            )}
        </div>
    );
}
