import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/store/hooks';
import { ShareDialog } from '@/components/share/ShareDialog';
import type { AchievementUnlockedPayload } from '@/types/socket';

interface AchievementShareMenuProps {
    achievement: AchievementUnlockedPayload;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AchievementShareMenu({
    achievement,
    open,
    onOpenChange,
}: AchievementShareMenuProps) {
    const username = useAppSelector((state) => state.auth.user?.username);

    const profileUrl =
        typeof window === 'undefined'
            ? ''
            : username
              ? `${window.location.origin}/profile/${username}`
              : window.location.origin;
    const handle = username ? `@${username}` : 'I';
    const text = `${handle} just unlocked "${achievement.title}" on CodeQuest Battles — ${achievement.description}`;

    return (
        <>
            <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onOpenChange(true)}
                className="gap-2"
            >
                <Share2 className="h-4 w-4" />
                Share
            </Button>
            <ShareDialog
                open={open}
                onOpenChange={onOpenChange}
                url={profileUrl}
                text={text}
                headline={`${achievement.icon} ${achievement.title}`}
                subhead={achievement.description}
                redditTitle={`Just unlocked "${achievement.title}" on CodeQuest Battles`}
                tone="win"
            />
        </>
    );
}
