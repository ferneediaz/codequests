import { useState } from 'react';
import { Copy, Link2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import type { AchievementUnlockedPayload } from '@/types/socket';

interface AchievementShareMenuProps {
    achievement: AchievementUnlockedPayload;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ShareCopy {
    text: string;
    profileUrl: string;
    discordText: string;
}

function buildShareCopy(
    achievement: AchievementUnlockedPayload,
    username: string | undefined,
): ShareCopy {
    const profileUrl =
        typeof window === 'undefined'
            ? ''
            : username
              ? `${window.location.origin}/profile/${username}`
              : window.location.origin;
    const handle = username ? `@${username}` : 'I';
    const text = `${handle} just unlocked "${achievement.title}" on CodeQuest Battles — ${achievement.description}`;
    const discordText = `🏆 **${achievement.title}** — ${achievement.description}\nUnlocked on CodeQuest Battles${profileUrl ? `\n${profileUrl}` : ''}`;
    return { text, profileUrl, discordText };
}

async function copyToClipboard(value: string, successMsg: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(value);
        toast.success(successMsg);
    } catch {
        toast.error('Could not copy to clipboard');
    }
}

export function AchievementShareMenu({
    achievement,
    open,
    onOpenChange,
}: AchievementShareMenuProps) {
    const username = useAppSelector((state) => state.auth.user?.username);
    const [copy] = useState(() => buildShareCopy(achievement, username));

    if (!open) {
        return (
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
        );
    }

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(copy.text + (copy.profileUrl ? `\n${copy.profileUrl}` : ''))}`;
    const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(copy.profileUrl)}&title=${encodeURIComponent(copy.text)}`;

    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            <a
                href={twitterUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                    'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground',
                )}
            >
                X / Twitter
            </a>
            <a
                href={redditUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                    'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground',
                )}
            >
                Reddit
            </a>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                    void copyToClipboard(
                        copy.discordText,
                        'Copied for Discord',
                    )
                }
                className="gap-1.5"
            >
                <Copy className="h-4 w-4" />
                Discord
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                    void copyToClipboard(copy.profileUrl, 'Link copied')
                }
                className="gap-1.5"
                disabled={!copy.profileUrl}
            >
                <Link2 className="h-4 w-4" />
                Copy link
            </Button>
        </div>
    );
}
