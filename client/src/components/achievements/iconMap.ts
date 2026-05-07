import {
    Award,
    BookOpen,
    Bolt,
    Code2,
    Crown,
    Flame,
    Hourglass,
    Languages,
    Medal,
    Shield,
    Skull,
    Star,
    Sword,
    Swords,
    Target,
    TrendingUp,
    Trophy,
    Zap,
    type LucideIcon,
} from 'lucide-react';

/**
 * Maps the lucide icon name stored on the server (string) to the actual
 * lucide-react component. Keep keys in sync with
 * `server/src/achievements/achievement-definitions.ts`.
 *
 * Falls back to `Trophy` for any name we haven't mapped yet — never throws,
 * because new server-side achievements should never break the dashboard
 * before a client release picks them up.
 */
const ICONS: Record<string, LucideIcon> = {
    Award,
    BookOpen,
    Bolt,
    Code2,
    Crown,
    Flame,
    Hourglass,
    Languages,
    Medal,
    Shield,
    Skull,
    Star,
    Sword,
    Swords,
    Target,
    TrendingUp,
    Trophy,
    Zap,
};

export function getAchievementIcon(name: string): LucideIcon {
    return ICONS[name] ?? Trophy;
}

