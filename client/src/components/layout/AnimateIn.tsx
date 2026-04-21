import { useScrollAnimation } from '@/hooks/useScrollAnimation';

type Direction = 'up' | 'left' | 'right' | 'scale';

export function AnimateIn({
    children,
    className = '',
    delay = 0,
    direction = 'up',
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    direction?: Direction;
}) {
    const { ref, isVisible } = useScrollAnimation(0.12);

    const hidden: Record<Direction, string> = {
        up: 'opacity-0 translate-y-8',
        left: 'opacity-0 -translate-x-8',
        right: 'opacity-0 translate-x-8',
        scale: 'opacity-0 scale-95',
    };
    const visible = 'opacity-100 translate-x-0 translate-y-0 scale-100';

    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ease-out ${isVisible ? visible : hidden[direction]} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}
