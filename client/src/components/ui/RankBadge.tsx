import { getRankTier } from '@/utils/rank';

interface RankBadgeProps {
    mmr: number;
    showMmr?: boolean;
    className?: string;
}

export function RankBadge({ mmr, showMmr = false, className = '' }: RankBadgeProps) {
    const tier = getRankTier(mmr);

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <span>{tier.icon}</span>
            <span className="font-semibold" style={{ color: tier.color }}>
                {tier.name}
            </span>
            {showMmr && (
                <span className="text-muted-foreground text-sm">({mmr})</span>
            )}
        </span>
    );
}
