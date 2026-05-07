import { useState, useEffect, useRef } from 'react';

interface TimerProps {
    startedAt: string;
    timeLimitMinutes?: number;
    timeLimitSeconds?: number;
    onTimeUp: () => void;
}

export function Timer({ startedAt, timeLimitMinutes, timeLimitSeconds, onTimeUp }: TimerProps) {
    const totalSeconds = timeLimitSeconds ?? (timeLimitMinutes ?? 0) * 60;
    const [secondsLeft, setSecondsLeft] = useState<number>(() => {
        const start = new Date(startedAt).getTime();
        const end = start + totalSeconds * 1000;
        return Math.max(0, Math.floor((end - Date.now()) / 1000));
    });
    // Read `onTimeUp` from a ref so callers can pass an inline lambda without
    // re-creating the interval (and resetting `timeUpFired`) every render.
    const onTimeUpRef = useRef(onTimeUp);
    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);
    const timeUpFired = useRef(false);

    useEffect(() => {
        timeUpFired.current = false;
        const interval = setInterval(() => {
            const start = new Date(startedAt).getTime();
            const end = start + totalSeconds * 1000;
            const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
            setSecondsLeft(remaining);

            if (remaining <= 0 && !timeUpFired.current) {
                timeUpFired.current = true;
                onTimeUpRef.current();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [startedAt, totalSeconds]);

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const colorClass =
        secondsLeft <= 30
            ? 'text-red-500'
            : secondsLeft <= 60
                ? 'text-yellow-500'
                : 'text-foreground';

    return (
        <div className={`font-mono text-2xl font-bold ${colorClass}`}>
            {display}
        </div>
    );
}
