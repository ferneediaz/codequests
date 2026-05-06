import { useState } from 'react';
import type { FormEvent } from 'react';
import { Popover } from 'radix-ui';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFriends } from '@/hooks/useFriends';
import { UserSearchInput } from './UserSearchInput';

export function AddFriendPopover() {
    const { sendRequestByUsername } = useFriends();
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = username.trim();
        if (!value) return;
        setSubmitting(true);
        try {
            await sendRequestByUsername(value);
            setUsername('');
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <Button size="sm" className="h-8">
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Add
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 w-72 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg"
                >
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <div className="text-sm font-semibold">Add friend</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Search by username, then send a friend request.
                            </p>
                        </div>
                        <UserSearchInput
                            value={username}
                            onChange={setUsername}
                            onSelect={(user) => setUsername(user.username)}
                            placeholder="Search username..."
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={!username.trim() || submitting}
                            >
                                {submitting && (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                )}
                                Send
                            </Button>
                        </div>
                    </form>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
