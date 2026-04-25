import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import api from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setUser } from '@/store/slices/authSlice';
import { consumePendingInvite } from '@/lib/pendingInvite';
import type {
    CodingExperience,
    CompleteOnboardingPayload,
    HowHeard,
    PrimaryGoal,
    User,
    UserSegment,
} from '@/types/api';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const SEGMENTS: { value: UserSegment; label: string; description: string }[] = [
    { value: 'STUDENT', label: 'Student', description: 'Learning to code at school or on my own' },
    { value: 'PROFESSIONAL', label: 'Professional', description: 'Software engineer or work in tech' },
    { value: 'HOBBYIST', label: 'Hobbyist', description: 'Code for fun, side projects, or puzzles' },
    { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say', description: '' },
];

const EXPERIENCE: { value: CodingExperience; label: string }[] = [
    { value: 'NEVER', label: "Never coded before" },
    { value: 'BEGINNER', label: 'Beginner (0-1 yrs)' },
    { value: 'INTERMEDIATE', label: 'Intermediate (1-3 yrs)' },
    { value: 'ADVANCED', label: 'Advanced (3+ yrs)' },
];

const GOALS: { value: PrimaryGoal; label: string }[] = [
    { value: 'INTERVIEWS', label: 'Prepare for interviews' },
    { value: 'SKILL_UP', label: 'Level up my skills' },
    { value: 'COMPETE', label: 'Compete and climb the ladder' },
    { value: 'FUN', label: 'Just for fun' },
    { value: 'CLASSROOM', label: 'Classroom / coursework' },
    { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const HOW_HEARD: { value: HowHeard; label: string }[] = [
    { value: 'FRIEND', label: 'A friend told me' },
    { value: 'SOCIAL', label: 'Social media' },
    { value: 'SEARCH', label: 'Search engine' },
    { value: 'SCHOOL', label: 'School' },
    { value: 'OTHER', label: 'Other' },
    { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const INPUT_CLASS =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function Onboarding() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.auth.user);

    // The OnboardingGate already redirects unauthenticated users, but we
    // defensively default state from the current user when available. The
    // avatar is not collected here - the OAuth provider picture is captured
    // during `POST /auth/sync` and the user can replace it later from the
    // navbar dropdown.
    const [username, setUsername] = useState(user?.username ?? '');
    const [userSegment, setUserSegment] = useState<UserSegment | ''>(user?.userSegment ?? '');
    const [codingExperience, setCodingExperience] = useState<CodingExperience | ''>(
        user?.codingExperience ?? '',
    );
    const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | ''>(user?.primaryGoal ?? '');
    const [howHeard, setHowHeard] = useState<HowHeard | ''>(user?.howHeard ?? '');
    const [submitting, setSubmitting] = useState(false);

    const usernameError = useMemo(() => {
        if (!username) return 'Username is required';
        if (username.length < 3 || username.length > 20) return 'Username must be 3-20 characters';
        if (!USERNAME_RE.test(username)) return 'Letters, numbers, and underscores only';
        return null;
    }, [username]);

    const canSubmit = !usernameError && !!userSegment && !submitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        if (usernameError) {
            toast.error(usernameError);
            return;
        }
        if (!userSegment) {
            toast.error('Pick the option that best describes you');
            return;
        }

        const payload: CompleteOnboardingPayload = {
            username: username.trim(),
            userSegment,
            ...(codingExperience ? { codingExperience } : {}),
            ...(primaryGoal ? { primaryGoal } : {}),
            ...(howHeard ? { howHeard } : {}),
        };

        try {
            setSubmitting(true);
            const { data } = await api.post<User>('/auth/onboarding', payload);
            dispatch(setUser(data));
            toast.success('Welcome aboard!');
            const pendingInvite = consumePendingInvite();
            navigate(pendingInvite ? `/invite/${pendingInvite}` : '/dashboard', {
                replace: true,
            });
        } catch (err) {
            const anyErr = err as {
                response?: { status?: number; data?: { message?: string | string[] } };
                message?: string;
            };
            const status = anyErr?.response?.status;
            const rawMessage = anyErr?.response?.data?.message;
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            if (status === 409) {
                toast.error(message ?? 'Username already taken');
            } else {
                toast.error(message ?? anyErr?.message ?? 'Could not save your profile');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-start justify-center bg-background px-4 py-10">
            <Card className="w-full max-w-2xl">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Swords className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Set up your profile</CardTitle>
                    <CardDescription>
                        A few quick details so we can tailor CodeQuest Battles to you.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <section className="space-y-2">
                            <label htmlFor="username" className="text-sm font-semibold">
                                Username
                            </label>
                            <p className="text-xs text-muted-foreground">
                                3-20 characters. Letters, numbers, and underscores only.
                            </p>
                            <input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="codemaster42"
                                autoComplete="off"
                                className={INPUT_CLASS}
                                aria-invalid={usernameError ? 'true' : undefined}
                            />
                            {username && usernameError && (
                                <p className="text-xs text-destructive">{usernameError}</p>
                            )}
                        </section>

                        <section className="space-y-3">
                            <div>
                                <h2 className="text-sm font-semibold">Which best describes you?</h2>
                                <p className="text-xs text-muted-foreground">Required</p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {SEGMENTS.map((option) => {
                                    const selected = userSegment === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setUserSegment(option.value)}
                                            className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                                                selected
                                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/40'
                                                    : 'border-input hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                            aria-pressed={selected}
                                        >
                                            <span className="text-sm font-medium">{option.label}</span>
                                            {option.description && (
                                                <span className="mt-0.5 text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="grid gap-6 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="experience" className="text-sm font-semibold">
                                    Coding experience
                                </label>
                                <select
                                    id="experience"
                                    value={codingExperience}
                                    onChange={(e) =>
                                        setCodingExperience(e.target.value as CodingExperience | '')
                                    }
                                    className={INPUT_CLASS}
                                >
                                    <option value="">Skip</option>
                                    {EXPERIENCE.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="goal" className="text-sm font-semibold">
                                    What brings you here?
                                </label>
                                <select
                                    id="goal"
                                    value={primaryGoal}
                                    onChange={(e) => setPrimaryGoal(e.target.value as PrimaryGoal | '')}
                                    className={INPUT_CLASS}
                                >
                                    <option value="">Skip</option>
                                    {GOALS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="how-heard" className="text-sm font-semibold">
                                    How did you hear about us?
                                </label>
                                <select
                                    id="how-heard"
                                    value={howHeard}
                                    onChange={(e) => setHowHeard(e.target.value as HowHeard | '')}
                                    className={INPUT_CLASS}
                                >
                                    <option value="">Skip</option>
                                    {HOW_HEARD.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </section>

                        {user?.avatarUrl && (
                            <section className="flex items-center gap-3 rounded-lg border border-input bg-muted/30 p-3">
                                <img
                                    src={user.avatarUrl}
                                    alt={user.username ?? 'Avatar'}
                                    className="h-10 w-10 rounded-full"
                                />
                                <div className="text-xs text-muted-foreground">
                                    Using your sign-in picture as your avatar. You can
                                    change it anytime from the navbar.
                                </div>
                            </section>
                        )}

                        <div className="flex items-center justify-end gap-3 border-t pt-4">
                            <Button type="submit" disabled={!canSubmit} size="lg">
                                {submitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Finish setup
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
