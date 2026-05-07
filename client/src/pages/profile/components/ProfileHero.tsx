import { User } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { FriendActionButton } from '@/components/social/FriendActionButton';
import { getRankTier } from '@/utils/rank';
import type { PublicUser } from '@/types/api';

interface ProfileHeroProps {
    user: PublicUser;
}

export function ProfileHero({ user }: ProfileHeroProps) {
    const tier = getRankTier(user.mmr);
    const avatarNode = user.avatarUrl ? (
        <img
            src={user.avatarUrl}
            alt={user.username}
            className="h-full w-full rounded-2xl object-cover"
        />
    ) : (
        <User className="h-10 w-10 text-muted-foreground" />
    );

    return (
        <PageHero
            icon={avatarNode}
            eyebrow="Profile"
            title={`@${user.username}`}
            description={
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold"
                        style={{
                            color: tier.color,
                            borderColor: `${tier.color}40`,
                            background: `${tier.color}15`,
                        }}
                    >
                        {tier.icon} {tier.name}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                        {user.mmr} MMR
                    </span>
                    {user.clan && (
                        <span className="text-xs text-muted-foreground">
                            · [{user.clan.tag}] {user.clan.name}
                        </span>
                    )}
                </div>
            }
            actions={
                <FriendActionButton
                    targetUserId={user.id}
                    targetUsername={user.username}
                />
            }
            accentClassName=""
            accentStyle={{ background: tier.color }}
            iconClassName="h-20 w-20 overflow-hidden"
        />
    );
}
