import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Check, X } from 'lucide-react';

type SubmissionStatus = 'correct' | 'incorrect' | null;

interface SubmissionFeedbackProps {
    status: SubmissionStatus;
    triggerKey?: string | number;
    className?: string;
    size?: 'sm' | 'lg';
}

export function SubmissionFeedback({
    status,
    triggerKey,
    className,
    size = 'sm',
}: SubmissionFeedbackProps) {
    const prevStatusRef = useRef<SubmissionStatus>(null);
    const prevTriggerRef = useRef<string | number | null>(null);
    const [displayStatus, setDisplayStatus] = useState<SubmissionStatus>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const nextTrigger = triggerKey ?? null;
        const shouldTrigger = triggerKey !== undefined
            ? !!status && nextTrigger !== prevTriggerRef.current
            : !!status && status !== prevStatusRef.current;

        if (shouldTrigger) {
            setDisplayStatus(status);
            setIsVisible(true);
        }

        if (status === 'correct' && shouldTrigger) {
            confetti({
                particleCount: 45,
                spread: 42,
                startVelocity: 32,
                scalar: 0.8,
                gravity: 1,
                ticks: 180,
                colors: ['#22c55e', '#4ade80', '#86efac'],
                origin: { x: 0.15, y: 0.2 },
                angle: 55,
            });
            confetti({
                particleCount: 45,
                spread: 42,
                startVelocity: 32,
                scalar: 0.8,
                gravity: 1,
                ticks: 180,
                colors: ['#22c55e', '#4ade80', '#86efac'],
                origin: { x: 0.85, y: 0.2 },
                angle: 125,
            });
        }

        prevTriggerRef.current = nextTrigger;
        prevStatusRef.current = status;
    }, [status, triggerKey]);

    useEffect(() => {
        if (!displayStatus) return;

        const hideTimer = window.setTimeout(() => setIsVisible(false), 900);
        const clearTimer = window.setTimeout(() => setDisplayStatus(null), 1200);

        return () => {
            window.clearTimeout(hideTimer);
            window.clearTimeout(clearTimer);
        };
    }, [displayStatus]);

    if (!displayStatus) {
        return null;
    }

    const isCorrect = displayStatus === 'correct';
    const isLarge = size === 'lg';

    return (
        <div
            className={`relative inline-flex items-center justify-center rounded-full transition-all duration-300 ${
                isLarge ? 'h-20 w-20' : 'h-8 w-8'
            } ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'} ${
                isCorrect
                    ? 'text-emerald-500'
                    : 'text-red-500'
            } ${className ?? ''}`}
            aria-live="polite"
        >
            <span
                className={`absolute inset-0 rounded-full border-2 ${
                    isCorrect
                        ? 'border-emerald-500/45 bg-emerald-500/10'
                        : 'border-red-500/45 bg-red-500/10'
                }`}
            />
            <span
                className={`absolute inset-0 rounded-full ${
                    isCorrect ? 'bg-emerald-500/20' : 'bg-red-500/20'
                } animate-ping`}
            />
            {isCorrect ? (
                <Check className={isLarge ? 'relative z-10 h-10 w-10' : 'relative z-10 h-5 w-5'} />
            ) : (
                <X className={isLarge ? 'relative z-10 h-10 w-10' : 'relative z-10 h-5 w-5'} />
            )}
        </div>
    );
}
