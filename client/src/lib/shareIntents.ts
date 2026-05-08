/**
 * Deep-link share intents for the major social networks.
 *
 * Each helper returns a URL you can drop into an `<a target="_blank">` —
 * clicking it opens the platform's composer pre-filled with the post.
 *
 * Notes:
 * - LinkedIn and Facebook ignore text on the URL — they rely entirely on
 *   the destination's Open Graph card. Make sure `url` points at a page
 *   with og:image / og:title / og:description set.
 * - Threads' `intent/post?text=` was rolled out by Meta in 2024 and works
 *   in both desktop browsers and the Threads app (which intercepts it).
 * - Instagram has no public share-intent URL; the only path is the system
 *   share sheet on mobile (`navigator.share`) which surfaces "Share to
 *   Story" if the IG app is installed.
 */

export interface ShareTargetPayload {
    /** Canonical URL of the page being shared (must have OG meta tags). */
    url: string;
    /** Pre-written post text. */
    text: string;
    /** Short title (used by Reddit; ignored elsewhere). */
    title?: string;
}

const enc = encodeURIComponent;

export const shareIntents = {
    twitter: ({ url, text }: ShareTargetPayload) =>
        `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,

    linkedin: ({ url }: ShareTargetPayload) =>
        `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,

    facebook: ({ url, text }: ShareTargetPayload) =>
        `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`,

    threads: ({ url, text }: ShareTargetPayload) =>
        `https://www.threads.net/intent/post?text=${enc(`${text}\n${url}`)}`,

    reddit: ({ url, text, title }: ShareTargetPayload) =>
        `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title ?? text)}`,

    whatsapp: ({ url, text }: ShareTargetPayload) =>
        `https://api.whatsapp.com/send?text=${enc(`${text} ${url}`)}`,

    telegram: ({ url, text }: ShareTargetPayload) =>
        `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
} as const;

export type ShareTarget = keyof typeof shareIntents;

/**
 * Wrapper around the Web Share API that returns true when the share
 * sheet was opened. Falls back to false (caller should offer manual
 * options) when unavailable. Browsers that don't support `navigator.share`
 * include desktop Firefox and older Safari; we treat that as "not
 * supported" rather than throwing.
 */
export async function tryNativeShare(
    payload: ShareTargetPayload,
): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('share' in navigator)) {
        return false;
    }
    try {
        await navigator.share({
            title: payload.title,
            text: payload.text,
            url: payload.url,
        });
        return true;
    } catch (err) {
        // AbortError = user dismissed the sheet — that's fine.
        // Anything else means the platform refused; caller can fall back.
        const name = (err as { name?: string })?.name;
        if (name === 'AbortError') return true;
        return false;
    }
}

/**
 * Copy a PNG image from a URL into the user's clipboard. Used so they
 * can paste the meme straight into Instagram (which has no public web
 * share URL — Meta gates that path) or Discord. Returns true on
 * success, false when the platform can't do image clipboard writes.
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
    if (
        typeof navigator === 'undefined' ||
        !navigator.clipboard ||
        typeof window === 'undefined' ||
        typeof window.ClipboardItem === 'undefined'
    ) {
        return false;
    }
    try {
        const res = await fetch(imageUrl, { credentials: 'omit' });
        if (!res.ok) return false;
        const blob = await res.blob();
        // Some browsers (Safari) require the blob's type to match the
        // ClipboardItem key exactly; force `image/png`.
        const png = blob.type === 'image/png'
            ? blob
            : new Blob([await blob.arrayBuffer()], { type: 'image/png' });
        await navigator.clipboard.write([
            new window.ClipboardItem({ 'image/png': png }),
        ]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Try to invoke the OS share sheet with the meme as a file. On mobile
 * this is the only way to push an image into Instagram's Story composer
 * — it surfaces "Stories" / "Direct" entries when the IG app is
 * installed. Returns true when the sheet opened (or the user dismissed
 * it cleanly); false when the platform refused, so the caller can fall
 * back to clipboard + open-app.
 *
 * Why not always use this: desktop browsers expose `navigator.share` but
 * desktop OSes don't list IG (no desktop app). The clipboard fallback is
 * the realistic desktop path.
 */
export async function tryNativeShareFile(
    imageUrl: string,
    filename: string,
    payload: ShareTargetPayload,
): Promise<boolean> {
    if (
        typeof navigator === 'undefined' ||
        !('share' in navigator) ||
        !('canShare' in navigator)
    ) {
        return false;
    }
    try {
        const res = await fetch(imageUrl, { credentials: 'omit' });
        if (!res.ok) return false;
        const blob = await res.blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (!navigator.canShare({ files: [file] })) return false;
        await navigator.share({
            files: [file],
            title: payload.title,
            text: payload.text,
        });
        return true;
    } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === 'AbortError') return true;
        return false;
    }
}

/**
 * Trigger a browser download for an image at `url`. Used as the
 * fallback path for clients that can't write images to the clipboard
 * (Firefox, older Safari) and as a standalone "Save meme" affordance.
 */
export async function downloadImage(
    imageUrl: string,
    filename: string,
): Promise<boolean> {
    try {
        const res = await fetch(imageUrl, { credentials: 'omit' });
        if (!res.ok) return false;
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoke after a tick so the click can flush.
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        return true;
    } catch {
        return false;
    }
}
