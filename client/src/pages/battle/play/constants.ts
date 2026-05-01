import {
    Crown,
    Snowflake,
    Shuffle,
    Clock,
    CloudFog,
    Swords,
    Users,
} from 'lucide-react';
import type {
    BattleMode,
    BattleRoyaleFormat,
    ClanWarsFormat,
    Difficulty,
    SkillType,
} from '@/types/api';

export const MODES: {
    value: BattleMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    tag: string;
}[] = [
    {
        value: 'ONE_V_ONE',
        label: '1v1 Duel',
        icon: Swords,
        description: 'Head-to-head. Fastest correct solution wins.',
        tag: '2 players',
    },
    {
        value: 'BATTLE_ROYALE',
        label: 'Battle Royale',
        icon: Crown,
        description: 'Last coder standing. Elimination rounds.',
        tag: '6–8 players',
    },
    {
        value: 'GROUP',
        label: 'Clan Wars',
        icon: Users,
        description: 'Squad up and battle another team.',
        tag: 'Teams',
    },
];

export const DIFFICULTIES: {
    value: Difficulty | 'ANY';
    label: string;
    color: string;
}[] = [
    { value: 'ANY', label: 'Any', color: 'text-muted-foreground' },
    { value: 'EASY', label: 'Easy', color: 'text-green-500' },
    { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-500' },
    { value: 'HARD', label: 'Hard', color: 'text-red-500' },
];

export const TIME_LIMITS = [5, 10, 15, 20, 30];

export const TOPICS = [
    'arrays',
    'strings',
    'hash-tables',
    'linked-lists',
    'trees',
    'graphs',
    'dynamic-programming',
    'sorting',
    'binary-search',
    'recursion',
    'stacks',
    'math',
];

export const SKILLS: {
    type: SkillType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
}[] = [
    {
        type: 'FREEZE',
        label: 'Freeze',
        icon: Snowflake,
        description: "Lock opponent's editor for 10 seconds",
    },
    {
        type: 'SCRAMBLE',
        label: 'Scramble',
        icon: Shuffle,
        description: "Shuffle opponent's code (no undo!)",
    },
    {
        type: 'TIME_STEAL',
        label: 'Time Steal',
        icon: Clock,
        description: 'Steal 5 minutes from opponent',
    },
    {
        type: 'FOG_OF_WAR',
        label: 'Fog of War',
        icon: CloudFog,
        description: "Blur opponent's screen for 20 seconds",
    },
];

// --------------------------------------------------------------------
// Battle Royale constants (mirror server validateConfig rules)
// --------------------------------------------------------------------

export const BR_MIN_PLAYERS = 3;
export const BR_MAX_PLAYERS = 50;
export const BR_MIN_ROUND_SECONDS = 10;
export const BR_MAX_ROUND_SECONDS = 7200;
export const BR_MIN_ROUNDS = 2;

export const ROYALE_FORMATS: {
    value: BattleRoyaleFormat;
    label: string;
    description: string;
}[] = [
    {
        value: 'SAME_PROBLEM',
        label: 'Same Problem',
        description:
            'Every surviving player solves the same problem each round. First correct solves advance; slowest are eliminated.',
    },
    {
        value: 'SCORE_ATTACK',
        label: 'Score Attack',
        description:
            'Pick from a pool of problems. Solve as many as you can per round — lowest cumulative score is eliminated.',
    },
];

export const ROUND_TIME_PRESETS = [60, 120, 180, 300, 600, 900, 1800, 3600];

// --------------------------------------------------------------------
// Clan Wars constants
// --------------------------------------------------------------------

export const CW_MIN_TEAM_SIZE = 1;
export const CW_MAX_TEAM_SIZE = 10;
export const CW_MIN_ROUND_SECONDS = 10;
export const CW_MAX_ROUND_SECONDS = 7200;

export const CLAN_WARS_FORMATS: {
    value: ClanWarsFormat;
    label: string;
    description: string;
}[] = [
    {
        value: 'SAME_PROBLEM',
        label: 'Same Problem',
        description:
            'Both teams solve the same problem each round. Better team execution wins.',
    },
    {
        value: 'SCORE_ATTACK',
        label: 'Score Attack',
        description:
            'Teams solve from a shared pool and stack cumulative points across rounds.',
    },
];
