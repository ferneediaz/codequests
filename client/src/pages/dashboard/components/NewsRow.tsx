import { Shield, UserCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { NewsItem } from '@/types/api';
import { formatRelative, resolveNewsPresentation } from '../utils';

export function NewsRow({
    item,
    currentUserId,
}: {
    item: NewsItem;
    currentUserId: string | undefined;
}) {
    const { Icon, style } = resolveNewsPresentation(item, currentUserId);
    const when = formatRelative(item.timestamp);

    return (
        <div
            className={`group flex items-center gap-3 rounded-lg border ${style.border} bg-background/40 p-3 transition-colors hover:bg-card/60`}
        >
            <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.iconBg} ${style.icon}`}
            >
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium truncate">{item.text}</span>
                    {item.isShame && (
                        <Badge
                            variant="outline"
                            className="h-5 border-red-500/40 bg-red-500/10 px-1.5 text-[10px] uppercase text-red-400"
                        >
                            Shame
                        </Badge>
                    )}
                    {item.category === 'clan' && !item.isShame && (
                        <Badge
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] uppercase"
                        >
                            <Shield className="h-3 w-3" />
                            Clan
                        </Badge>
                    )}
                    {item.category === 'friends' && (
                        <Badge
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] uppercase"
                        >
                            <UserCircle2 className="h-3 w-3" />
                            Friends
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">{when}</p>
            </div>
        </div>
    );
}
