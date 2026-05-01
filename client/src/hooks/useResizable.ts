import { useCallback, useRef, useState } from 'react';

/**
 * Drives a draggable split panel. Returns:
 * - `fraction`: the current size fraction (0..1) of the first pane.
 * - `containerProps`: spread onto the container div whose size is being measured.
 * - `dragHandleProps`: spread onto the drag handle div.
 *
 * Returning props bags rather than raw refs keeps `react-hooks/refs` happy:
 * callers never read `containerRef.current` themselves, they just spread the
 * props.
 */
export function useResizable(
    initialFraction: number,
    direction: 'horizontal' | 'vertical',
    options?: { min?: number; max?: number },
) {
    const min = options?.min ?? 0.2;
    const max = options?.max ?? 0.8;
    const [fraction, setFraction] = useState(initialFraction);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const onMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            dragging.current = true;

            const onMouseMove = (ev: MouseEvent) => {
                const el = containerRef.current;
                if (!dragging.current || !el) return;
                const rect = el.getBoundingClientRect();
                const next =
                    direction === 'horizontal'
                        ? (ev.clientX - rect.left) / rect.width
                        : (ev.clientY - rect.top) / rect.height;
                setFraction(Math.min(max, Math.max(min, next)));
            };

            const onMouseUp = () => {
                dragging.current = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor =
                direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
        },
        [direction, min, max],
    );

    return {
        fraction,
        containerProps: { ref: containerRef },
        dragHandleProps: { onMouseDown },
    };
}
