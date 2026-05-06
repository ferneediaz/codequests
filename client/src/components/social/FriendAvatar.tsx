import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FriendAvatarProps {
    username: string;
    avatarUrl?: string | null;
    online?: boolean;
    className?: string;
}

export function FriendAvatar({
    username,
    avatarUrl,
    online,
    className,
}: FriendAvatarProps) {
    return (
        <div className={cn('relative shrink-0', className)}>
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt={username}
                    className="h-9 w-9 rounded-full object-cover"
                />
            ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                </div>
            )}
            <span
                className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-card',
                    online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                )}
            />
        </div>
    );
}
