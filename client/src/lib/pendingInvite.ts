const KEY = 'codequest.pendingInvite';

// Session-scoped helper that remembers an invite code the user tried to open
// before authenticating, so we can bounce them back to `/invite/:code` after
// the Supabase OAuth round-trip.
export function savePendingInvite(code: string): void {
    try {
        sessionStorage.setItem(KEY, code);
    } catch {
        // sessionStorage can throw in private mode; fail quiet.
    }
}

export function consumePendingInvite(): string | null {
    try {
        const code = sessionStorage.getItem(KEY);
        if (code) sessionStorage.removeItem(KEY);
        return code;
    } catch {
        return null;
    }
}

export function peekPendingInvite(): string | null {
    try {
        return sessionStorage.getItem(KEY);
    } catch {
        return null;
    }
}
