import { useState, useEffect, useRef } from 'react';

interface TimerProps {
    startedAt: string;
    timeLimitMinutes: number;
    onTimeUp: () => void;
}

export function Timer({ startedAt, timeLimitMinutes, onTimeUp }: TimerProps) {
    const [secondsLeft, setSecondsLeft] = useState<number>(() => {
        const start = new Date(startedAt).getTime();
        const end = start + timeLimitMinutes * 60 * 1000;
        return Math.max(0, Math.floor((end - Date.now()) / 1000));
    });
    const timeUpFired = useRef(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const start = new Date(startedAt).getTime();
            const end = start + timeLimitMinutes * 60 * 1000;
            const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
            setSecondsLeft(remaining);

            if (remaining <= 0 && !timeUpFired.current) {
                timeUpFired.current = true;
                onTimeUp();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [startedAt, timeLimitMinutes, onTimeUp]);

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
