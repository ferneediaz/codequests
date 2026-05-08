import { useState, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { toast } from 'sonner';
import {
    Check,
    Copy,
    Download,
    Flame,
    Link2,
    Loader2,
    Share2,
    Trophy,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    copyImageToClipboard,
    downloadImage,
    shareIntents,
    tryNativeShare,
    tryNativeShareFile,
} from '@/lib/shareIntents';

export type ShareTone = 'win' | 'general';

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Canonical share URL (must serve OG meta tags for LinkedIn/Facebook). */
    url: string;
    /** Pre-written post text — used as caption + Web Share fallback. */
    text: string;
    /** Headline shown at the top of the dialog. */
    headline: string;
    /** Optional sub-line below the headline. */
    subhead?: string;
    /** Optional social-card image; rendered as a meme preview. */
    imageUrl?: string;
    /** Title for Reddit submissions (defaults to `text`). */
    redditTitle?: string;
    tone?: ShareTone;
}

const PLATFORMS: Array<{
    key: keyof typeof shareIntents;
    label: string;
    accent: string;
    icon: ReactNode;
}> = [
    {
        key: 'twitter',
        label: 'X / Twitter',
        accent: 'hover:border-foreground/60',
        icon: <XLogo />,
    },
    {
        key: 'linkedin',
        label: 'LinkedIn',
        accent: 'hover:border-[#0A66C2] hover:text-[#0A66C2]',
        icon: <LinkedInLogo />,
    },
    {
        key: 'facebook',
        label: 'Facebook',
        accent: 'hover:border-[#1877F2] hover:text-[#1877F2]',
        icon: <FacebookLogo />,
    },
    {
        key: 'threads',
        label: 'Threads',
        accent: 'hover:border-foreground/60',
        icon: <ThreadsLogo />,
    },
    {
        key: 'reddit',
        label: 'Reddit',
        accent: 'hover:border-[#FF4500] hover:text-[#FF4500]',
        icon: <RedditLogo />,
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp',
        accent: 'hover:border-[#25D366] hover:text-[#25D366]',
        icon: <WhatsAppLogo />,
    },
    {
        key: 'telegram',
        label: 'Telegram',
        accent: 'hover:border-[#229ED9] hover:text-[#229ED9]',
        icon: <TelegramLogo />,
    },
];

export function ShareDialog({
    open,
    onOpenChange,
    url,
    text,
    headline,
    subhead,
    imageUrl,
    redditTitle,
    tone = 'general',
}: ShareDialogProps) {
    const [copied, setCopied] = useState(false);
    const [igBusy, setIgBusy] = useState(false);
    const [savingMeme, setSavingMeme] = useState(false);
    const isWin = tone === 'win';

    /**
     * Instagram has no public web-share URL — Meta doesn't expose a
     * way to open the Story composer prefilled from a browser. The
     * realistic flow:
     *  1. Mobile / supported desktops → invoke navigator.share with the
     *     PNG as a file; on iOS/Android with the IG app installed this
     *     gives the user a "Stories" entry in the system share sheet.
     *  2. Anywhere else → copy the meme to the clipboard and open IG.
     *  3. Fallback for browsers without image-clipboard (Firefox / old
     *     Safari) → download the PNG and open IG.
     */
    const handleInstagram = async () => {
        if (!imageUrl) return;
        setIgBusy(true);
        try {
            const sheetOpened = await tryNativeShareFile(
                imageUrl,
                'codequest-roast.png',
                { url, text, title: headline },
            );
            if (sheetOpened) return;

            const copied = await copyImageToClipboard(imageUrl);
            if (copied) {
                window.open(
                    'https://www.instagram.com/',
                    '_blank',
                    'noopener',
                );
                toast.success(
                    'Meme copied. Open the IG app → New Story → press & hold the canvas to paste.',
                    { duration: 8000 },
                );
                return;
            }
            const saved = await downloadImage(
                imageUrl,
                'codequest-roast.png',
            );
            if (saved) {
                window.open(
                    'https://www.instagram.com/',
                    '_blank',
                    'noopener',
                );
                toast.message(
                    'Meme saved to Downloads. Upload it to a Story from the Instagram app.',
                    { duration: 8000 },
                );
                return;
            }
            toast.error('Could not copy or download the meme.');
        } finally {
            setIgBusy(false);
        }
    };

    const handleSaveMeme = async () => {
        if (!imageUrl) return;
        setSavingMeme(true);
        try {
            const ok = await downloadImage(imageUrl, 'codequest-roast.png');
            if (ok) toast.success('Meme saved.');
            else toast.error('Could not save the meme.');
        } finally {
            setSavingMeme(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success('Share link copied.');
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            toast.error('Could not copy.');
        }
    };

    const handleCopyCaption = async () => {
        try {
            await navigator.clipboard.writeText(`${text}\n${url}`);
            toast.success('Caption + link copied.');
        } catch {
            toast.error('Could not copy.');
        }
    };

    const handleNativeShare = async () => {
        const ok = await tryNativeShare({ url, text, title: headline });
        if (!ok) toast.message('Native share is not available — pick a platform below.');
    };

    const nativeAvailable =
        typeof navigator !== 'undefined' && 'share' in navigator;

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={cn(
                        'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                    )}
                />
                <Dialog.Content
                    className={cn(
                        'fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2',
                        'overflow-hidden rounded-2xl border border-border bg-card shadow-2xl',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                    )}
                    aria-describedby={subhead ? 'share-dialog-sub' : undefined}
                >
                    <Dialog.Close
                        className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </Dialog.Close>

                    <div
                        className={cn(
                            'px-6 pt-6 pb-4',
                            isWin
                                ? 'bg-gradient-to-br from-amber-500/15 via-primary/10 to-transparent'
                                : 'bg-gradient-to-br from-primary/10 to-transparent',
                        )}
                    >
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {isWin ? (
                                <>
                                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                                    Victory royale
                                </>
                            ) : (
                                <>
                                    <Share2 className="h-3.5 w-3.5" />
                                    Share
                                </>
                            )}
                        </div>
                        <Dialog.Title
                            className={cn(
                                'mt-1 text-2xl font-bold leading-tight',
                                isWin && 'flex items-center gap-2',
                            )}
                        >
                            {isWin && (
                                <Flame className="h-6 w-6 shrink-0 text-amber-500" />
                            )}
                            {headline}
                        </Dialog.Title>
                        {subhead && (
                            <Dialog.Description
                                id="share-dialog-sub"
                                className="mt-1 text-sm text-muted-foreground"
                            >
                                {subhead}
                            </Dialog.Description>
                        )}
                    </div>

                    {imageUrl && (
                        <div className="px-6">
                            <div className="relative overflow-hidden rounded-xl border border-border bg-background/40">
                                {/* Aspect ratio matches OG card (1200x630). */}
                                <div className="aspect-[1200/630] w-full">
                                    <img
                                        src={imageUrl}
                                        alt="Share preview"
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="px-6 pt-4">
                        <p className="rounded-lg border border-border bg-background/40 p-3 text-sm leading-relaxed text-muted-foreground">
                            {text}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 px-6 pt-4 sm:grid-cols-4">
                        {PLATFORMS.map((p) => {
                            const href = shareIntents[p.key]({
                                url,
                                text,
                                title: redditTitle ?? text,
                            });
                            const tileClass = cn(
                                'group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-background/50 p-3 text-xs font-medium transition-all',
                                'hover:bg-accent',
                                p.accent,
                            );
                            // LinkedIn and Facebook strip URL-prefilled text;
                            // Threads' intent param is unreliable. Copy the
                            // trash-talk to the clipboard on click so the
                            // user just pastes it into the composer.
                            const needsClipboardAssist =
                                p.key === 'linkedin' ||
                                p.key === 'facebook' ||
                                p.key === 'threads';
                            if (needsClipboardAssist) {
                                const handleAssistedClick = async () => {
                                    try {
                                        await navigator.clipboard.writeText(
                                            `${text}\n${url}`,
                                        );
                                        toast.success(
                                            `Trash talk copied — paste it into the ${p.label} composer.`,
                                        );
                                    } catch {
                                        toast.message(
                                            `Couldn't auto-copy — paste manually after the composer opens.`,
                                        );
                                    }
                                    window.open(
                                        href,
                                        '_blank',
                                        'noopener,noreferrer',
                                    );
                                };
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => void handleAssistedClick()}
                                        className={tileClass}
                                    >
                                        <span className="h-5 w-5 transition-transform group-hover:scale-110">
                                            {p.icon}
                                        </span>
                                        {p.label}
                                    </button>
                                );
                            }
                            return (
                                <a
                                    key={p.key}
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className={tileClass}
                                >
                                    <span className="h-5 w-5 transition-transform group-hover:scale-110">
                                        {p.icon}
                                    </span>
                                    {p.label}
                                </a>
                            );
                        })}
                        {imageUrl && (
                            <button
                                type="button"
                                onClick={() => void handleInstagram()}
                                disabled={igBusy}
                                title="Instagram has no web composer — we'll copy the meme so you can paste it into a Story in the app."
                                className={cn(
                                    'group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-background/50 p-3 text-xs font-medium transition-all',
                                    'hover:bg-accent hover:border-pink-500 hover:text-pink-500',
                                    'disabled:opacity-60',
                                )}
                            >
                                <span className="h-5 w-5 transition-transform group-hover:scale-110">
                                    {igBusy ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <InstagramLogo />
                                    )}
                                </span>
                                Instagram
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col-reverse gap-2 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleCopyLink()}
                                className="gap-1.5"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                    <Link2 className="h-4 w-4" />
                                )}
                                Copy link
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleCopyCaption()}
                                className="gap-1.5"
                            >
                                <Copy className="h-4 w-4" />
                                Copy caption
                            </Button>
                            {imageUrl && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleSaveMeme()}
                                    disabled={savingMeme}
                                    className="gap-1.5"
                                >
                                    {savingMeme ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                    Save meme
                                </Button>
                            )}
                        </div>
                        {nativeAvailable && (
                            <Button
                                size="sm"
                                onClick={() => void handleNativeShare()}
                                className="gap-1.5"
                            >
                                <Share2 className="h-4 w-4" />
                                System share
                            </Button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

/* -------------------------------------------------------------------- */
/* Brand glyphs — inline SVGs so we don't pull a dep just for icons.    */
/* -------------------------------------------------------------------- */

function XLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.787l-5.31-6.93L4.84 22H1.583l8.02-9.165L1 2h6.94l4.79 6.33L18.245 2Zm-2.38 18h1.88L7.21 4H5.21l10.654 16Z" />
        </svg>
    );
}

function LinkedInLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
        </svg>
    );
}

function FacebookLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54v-2.22c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z" />
        </svg>
    );
}

function ThreadsLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.5 11.4c-.1-.05-.2-.1-.3-.14a8.07 8.07 0 0 0-.1-1.79c-.36-2.27-1.6-3.86-3.5-4.5-1.2-.4-2.85-.5-4.32.65-.84.66-1.4 1.62-1.6 2.7l1.55.42c.16-.78.55-1.43 1.13-1.88.92-.72 2.07-.65 2.92-.36 1.13.38 1.95 1.32 2.23 2.55.13.55.18 1.16.16 1.74-.84-.27-1.78-.42-2.83-.43-2.82 0-4.66 1.65-4.55 3.93.06 1.16.61 2.16 1.55 2.81.79.55 1.8.81 2.86.78 1.4-.04 2.5-.58 3.27-1.6.58-.78.95-1.79 1.1-3.06.62.38 1.08.88 1.34 1.48.43 1.02.46 2.7-.91 4.06-1.2 1.2-2.65 1.72-4.83 1.74-2.42-.02-4.25-.8-5.45-2.32-1.12-1.42-1.7-3.47-1.72-6.1.02-2.62.6-4.66 1.72-6.08C7.42 4.62 9.25 3.84 11.67 3.82c2.43.02 4.3.81 5.55 2.34.62.76 1.08 1.7 1.4 2.81l1.5-.4c-.36-1.36-.95-2.54-1.74-3.5-1.6-1.95-3.94-2.96-6.97-2.98h-.01c-3.02.02-5.32 1.03-6.86 3-1.43 1.83-2.18 4.39-2.2 7.6v.02c.02 3.21.77 5.77 2.2 7.6 1.54 1.97 3.84 2.98 6.86 3h.01c2.7-.02 4.6-.73 6.16-2.3 2.05-2.05 1.99-4.62 1.31-6.2-.48-1.13-1.4-2.06-2.68-2.71Zm-4.27 4.94c-1.16.07-2.36-.46-2.43-1.6-.04-.84.59-1.78 2.5-1.89.22-.01.43-.02.64-.02.7 0 1.34.07 1.93.2-.22 2.74-1.5 3.26-2.64 3.31Z" />
        </svg>
    );
}

function RedditLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M22 12.14a2.14 2.14 0 0 0-3.62-1.55c-1.42-1.02-3.38-1.69-5.55-1.77l1.13-3.6 3.07.65a1.74 1.74 0 1 0 .14-.95l-3.43-.72a.46.46 0 0 0-.54.32L11.94 8.81c-2.21.06-4.2.74-5.65 1.78a2.14 2.14 0 1 0-2.36 3.51 4.36 4.36 0 0 0-.04.55c0 2.83 3.3 5.13 7.36 5.13 4.06 0 7.36-2.3 7.36-5.13 0-.18 0-.37-.04-.55A2.14 2.14 0 0 0 22 12.14ZM7.5 13.7a1.4 1.4 0 1 1 2.79 0 1.4 1.4 0 0 1-2.79 0Zm8.13 3.55c-1.04 1.04-3 1.13-3.61 1.13-.61 0-2.58-.09-3.62-1.13a.4.4 0 0 1 .57-.57c.66.67 2.08.91 3.05.91s2.39-.24 3.05-.91a.4.4 0 0 1 .56.57Zm-.4-2.16a1.4 1.4 0 1 1 0-2.79 1.4 1.4 0 0 1 0 2.79Z" />
        </svg>
    );
}

function WhatsAppLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12.05 2C6.5 2 2 6.5 2 12.05c0 1.92.5 3.79 1.46 5.44L2 22l4.62-1.4a10.04 10.04 0 0 0 5.43 1.6h.01c5.55 0 10.05-4.5 10.05-10.05S17.6 2 12.05 2Zm5.86 14.11c-.25.7-1.45 1.34-2 1.42-.51.07-1.16.1-1.87-.12a16.94 16.94 0 0 1-1.69-.62c-2.97-1.28-4.91-4.27-5.06-4.46-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.8-.37l.57.01c.18 0 .43-.07.67.51.25.6.85 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.39-.45.52-.15.15-.31.32-.13.62.18.3.79 1.31 1.7 2.12 1.16 1.04 2.14 1.36 2.44 1.51.3.15.48.13.66-.07.18-.2.76-.89.96-1.19.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.07.13.07.74-.18 1.45Z" />
        </svg>
    );
}

function TelegramLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M22 4.07 18.36 20.5c-.27 1.21-.99 1.5-2 .94l-5.52-4.07-2.66 2.56c-.3.3-.54.54-1.1.54l.4-5.6L17.65 5.5c.45-.4-.1-.62-.69-.22L6.4 11.62 1.94 10.2c-.97-.3-.99-.97.21-1.44L20.74 2.62c.81-.3 1.51.18 1.26 1.45Z" />
        </svg>
    );
}

function InstagramLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.86 5.86 0 0 0-2.13 1.38A5.86 5.86 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.32.81.74 1.5 1.38 2.13a5.86 5.86 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.13-1.38 5.86 5.86 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91A5.86 5.86 0 0 0 21.99 2 5.86 5.86 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
        </svg>
    );
}
