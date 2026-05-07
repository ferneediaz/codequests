import { DIFFICULTIES, MODES, SKILLS } from '../play/constants';
import type { MatchConfig } from '@/types/api';

export function describeMode(config: MatchConfig): string {
    return MODES.find((m) => m.value === config.mode)?.label ?? config.mode;
}

export function describeDifficulty(config: MatchConfig): string {
    if (!config.preferredDifficulty) {
        return DIFFICULTIES.find((d) => d.value === 'ANY')?.label ?? 'Any';
    }
    return (
        DIFFICULTIES.find((d) => d.value === config.preferredDifficulty)?.label ??
        config.preferredDifficulty
    );
}

export function describeTopic(config: MatchConfig): string {
    return config.preferredTopic ?? 'Any topic';
}

export function describeTime(config: MatchConfig): string {
    return `${config.timeLimitMinutes} min`;
}

export function describeSkills(config: MatchConfig): string {
    if (!config.enabledSkills?.length) return 'No skills';
    return config.enabledSkills
        .map((s) => SKILLS.find((sk) => sk.type === s)?.label ?? s)
        .join(', ');
}
