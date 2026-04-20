import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { RankBadge } from '@/components/ui/RankBadge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Swords } from 'lucide-react';

export function Navbar() {
    const { user, isAuthenticated, logout } = useAuth();

    return (
        <nav className="border-b border-border bg-card">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
                <Link to="/dashboard" className="flex items-center gap-2 text-lg font-bold text-foreground no-underline">
                    <Swords className="h-5 w-5 text-primary" />
                    <span>CodeQuest</span>
                </Link>

                <div className="flex items-center gap-4">
                    {isAuthenticated && user ? (
                        <>
                            <RankBadge mmr={user.mmr} showMmr />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="flex items-center gap-2">
                                        {user.avatarUrl ? (
                                            <img
                                                src={user.avatarUrl}
                                                alt={user.username}
                                                className="h-7 w-7 rounded-full"
                                            />
                                        ) : (
                                            <User className="h-5 w-5" />
                                        )}
                                        <span className="text-sm">{user.username}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
                                        {user.wins}W / {user.losses}L
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={logout} className="text-destructive">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <Link to="/login">
                            <Button size="sm">Sign In</Button>
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
