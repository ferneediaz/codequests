import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { searchUsers, type UserSearchResult } from '@/services/users';

interface UserSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (user: UserSearchResult) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

export function UserSearchInput({
    value,
    onChange,
    onSelect,
    placeholder = 'Search usernames...',
    autoFocus,
}: UserSearchInputProps) {
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = value.trim();
        if (q.length < 2) {
            queueMicrotask(() => {
                setResults([]);
                setLoading(false);
            });
            return;
        }

        let cancelled = false;
        const timeout = window.setTimeout(() => {
            if (!cancelled) setLoading(true);
            void searchUsers(q)
                .then((users) => {
                    if (!cancelled) setResults(users);
                })
                .catch(() => {
                    if (!cancelled) setResults([]);
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [value]);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                    autoFocus={autoFocus}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {value.trim().length >= 2 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-popover p-1">
                    {results.length === 0 && !loading ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                            No matching users.
                        </p>
                    ) : (
                        results.map((user) => (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() => onSelect(user)}
                                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted"
                            >
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt={user.username}
                                        className="h-8 w-8 rounded-full"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-muted" />
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{user.username}</p>
                                    <p className="text-xs text-muted-foreground">{user.mmr} MMR</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
