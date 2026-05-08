import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/store/slices/authSlice';
import { RankBadge } from '@/components/ui/RankBadge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog } from 'radix-ui';
import {
    LogOut,
    User,
    Swords,
    BookOpen,
    LayoutDashboard,
    Crown,
    Shield,
    Trophy,
    Users,
    MessageSquare,
    ImagePlus,
    Loader2,
    FileCode,
    Menu,
    X,
} from 'lucide-react';
import { SubscriptionBadge } from './SubscriptionBadge';
import { NotificationBell } from './NotificationBell';
import { useFriends } from '@/hooks/useFriends';
import { useSocialLayout } from '@/hooks/useSocialLayout';
import { useUnreadDms } from '@/hooks/useUnreadDms';
import {
    ALLOWED_AVATAR_MIME,
    AvatarUploadError,
    uploadAvatar,
} from '@/services/avatar';

export function Navbar() {
    const { user, isAuthenticated, logout } = useAuth();
    const { pendingRequests } = useFriends();
    const unreadDms = useUnreadDms();
    const {
        friendsSidebarOpen,
        toggleFriendsSidebar,
        friendsSidebarHidden,
    } = useSocialLayout();
    const dispatch = useAppDispatch();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploading, setUploading] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handlePickAvatar = () => {
        if (uploading) return;
        fileInputRef.current?.click();
    };

    const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file later
        if (!file || !user) return;
        try {
            setUploading(true);
            const updated = await uploadAvatar(user.id, file);
            dispatch(setUser(updated));
            toast.success('Avatar updated');
        } catch (err) {
            if (err instanceof AvatarUploadError) {
                toast.error(err.message);
            } else {
                const anyErr = err as {
                    response?: { data?: { message?: string | string[] } };
                    message?: string;
                };
                const raw = anyErr?.response?.data?.message;
                const msg = Array.isArray(raw) ? raw.join(', ') : raw;
                toast.error(msg ?? anyErr?.message ?? 'Could not upload avatar');
            }
        } finally {
            setUploading(false);
        }
    };

    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <nav className="border-b border-border bg-card">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
                <div className="flex items-center gap-3 sm:gap-6">
                    {isAuthenticated && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="sm:hidden"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    )}
                    <Link to="/dashboard" className="flex items-center gap-2 text-lg font-bold text-foreground no-underline">
                        <Swords className="h-5 w-5 text-primary" />
                        <span>CodeQuest</span>
                    </Link>
                    {isAuthenticated && (
                        <div className="hidden items-center gap-1 sm:flex">
                            <Link to="/dashboard">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <LayoutDashboard className="mr-1.5 h-4 w-4" />
                                    Dashboard
                                </Button>
                            </Link>
                            <Link to="/practice">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <BookOpen className="mr-1.5 h-4 w-4" />
                                    Practice
                                </Button>
                            </Link>
                            <Link to="/play">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <Swords className="mr-1.5 h-4 w-4" />
                                    Play
                                </Button>
                            </Link>
                            <Link to="/lobby">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <Users className="mr-1.5 h-4 w-4" />
                                    Lobby
                                </Button>
                            </Link>
                            <Link to="/clans">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <Shield className="mr-1.5 h-4 w-4" />
                                    Clans
                                </Button>
                            </Link>
                            <Link to="/leaderboard">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                    <Trophy className="mr-1.5 h-4 w-4" />
                                    Leaderboard
                                </Button>
                            </Link>
                            {import.meta.env.DEV && (
                                <Link to="/author">
                                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                        <FileCode className="mr-1.5 h-4 w-4" />
                                        Author
                                    </Button>
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {isAuthenticated && user ? (
                        <>
                            <SubscriptionBadge />
                            {!friendsSidebarHidden && (
                                <Button
                                    variant={friendsSidebarOpen ? 'secondary' : 'ghost'}
                                    size="icon"
                                    aria-label={
                                        pendingRequests.length > 0
                                            ? `Friends (${pendingRequests.length} pending request${pendingRequests.length === 1 ? '' : 's'})`
                                            : 'Friends'
                                    }
                                    onClick={toggleFriendsSidebar}
                                    className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
                                >
                                    <Users className="h-5 w-5" />
                                    {pendingRequests.length > 0 && (
                                        <span
                                            aria-hidden
                                            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-card bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                                        >
                                            {pendingRequests.length > 9
                                                ? '9+'
                                                : pendingRequests.length}
                                        </span>
                                    )}
                                </Button>
                            )}
                            <Link to="/messages" aria-label="Messages">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
                                >
                                    <MessageSquare className="h-5 w-5" />
                                    {unreadDms.dmTotal > 0 && (
                                        <span
                                            aria-hidden
                                            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-card bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                                        >
                                            {unreadDms.dmTotal > 9 ? '9+' : unreadDms.dmTotal}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                            <NotificationBell />
                            <RankBadge mmr={user.mmr} showMmr />

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ALLOWED_AVATAR_MIME.join(',')}
                                className="hidden"
                                onChange={handleAvatarFile}
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="flex items-center gap-2">
                                        {uploading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : user.avatarUrl ? (
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
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            handlePickAvatar();
                                        }}
                                        disabled={uploading}
                                    >
                                        <ImagePlus className="mr-2 h-4 w-4" />
                                        {uploading ? 'Uploading…' : 'Change avatar'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link to="/pricing" className="flex items-center no-underline">
                                            <Crown className="mr-2 h-4 w-4" />
                                            Pricing
                                        </Link>
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

            {/* Mobile drawer — only mounted while open. Renders via Portal so
                it floats over the current page. */}
            <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm sm:hidden" />
                    <Dialog.Content
                        className="fixed left-0 top-0 z-50 h-full w-72 max-w-[85vw] border-r border-border bg-card p-4 shadow-2xl sm:hidden"
                        aria-describedby={undefined}
                    >
                        <div className="mb-6 flex items-center justify-between">
                            <Dialog.Title className="flex items-center gap-2 text-lg font-bold">
                                <Swords className="h-5 w-5 text-primary" />
                                CodeQuest
                            </Dialog.Title>
                            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close menu">
                                <X className="h-4 w-4" />
                            </Dialog.Close>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Link to="/dashboard" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    Dashboard
                                </Button>
                            </Link>
                            <Link to="/practice" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                    <BookOpen className="mr-2 h-4 w-4" />
                                    Practice
                                </Button>
                            </Link>
                            <Link to="/play" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                    <Swords className="mr-2 h-4 w-4" />
                                    Play
                                </Button>
                            </Link>
                            <Link to="/lobby" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                    <Users className="mr-2 h-4 w-4" />
                                    Lobby
                                </Button>
                            </Link>
                            <Link to="/clans" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                    <Shield className="mr-2 h-4 w-4" />
                                    Clans
                                </Button>
                            </Link>
                            <Link to="/leaderboard" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                    <Trophy className="mr-2 h-4 w-4" />
                                    Leaderboard
                                </Button>
                            </Link>
                            <Link to="/messages" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Messages
                                </Button>
                            </Link>
                            {import.meta.env.DEV && (
                                <Link to="/author" onClick={closeMobileMenu}>
                                    <Button variant="ghost" className="w-full justify-start">
                                        <FileCode className="mr-2 h-4 w-4" />
                                        Author
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </nav>
    );
}
