import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { TopLeaderboard } from './components/TopLeaderboard';
import {
    Swords,
    Zap,
    Trophy,
    Users,
    Code,
    Timer,
    Shield,
    ChevronRight,
    Terminal,
    Flame,
    Target,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Reusable animated wrapper                                         */
/* ------------------------------------------------------------------ */
function AnimateIn({
    children,
    className = '',
    delay = 0,
    direction = 'up',
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    direction?: 'up' | 'left' | 'right' | 'scale';
}) {
    const { ref, isVisible } = useScrollAnimation(0.12);

    const base = 'transition-all duration-700 ease-out';
    const hidden: Record<string, string> = {
        up: 'opacity-0 translate-y-12',
        left: 'opacity-0 -translate-x-12',
        right: 'opacity-0 translate-x-12',
        scale: 'opacity-0 scale-90',
    };
    const visible = 'opacity-100 translate-x-0 translate-y-0 scale-100';

    return (
        <div
            ref={ref}
            className={`${base} ${isVisible ? visible : hidden[direction]} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Navbar                                                            */
/* ------------------------------------------------------------------ */
function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-background/80 backdrop-blur-lg border-b border-border shadow-lg'
                : 'bg-transparent'
                }`}
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
                    <Swords className="h-6 w-6 text-primary" />
                    <span>
                        Code<span className="text-primary">Quest</span>
                    </span>
                </Link>

                <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
                    <a href="#features" className="hover:text-foreground transition-colors">
                        Features
                    </a>
                    <a href="#how-it-works" className="hover:text-foreground transition-colors">
                        How It Works
                    </a>
                    <a href="#stats" className="hover:text-foreground transition-colors">
                        Stats
                    </a>
                    <a href="#faq" className="hover:text-foreground transition-colors">
                        FAQ
                    </a>
                </div>

                <div className="flex items-center gap-3">
                    <Link to="/login">
                        <Button variant="ghost" size="sm">
                            Sign In
                        </Button>
                    </Link>
                    <Link to="/login">
                        <Button size="sm">
                            Get Started
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                              */
/* ------------------------------------------------------------------ */
function Hero() {
    return (
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
            {/* Background glow */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />
            </div>

            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

            <AnimateIn direction="scale" className="relative z-10 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
                    <Flame className="h-4 w-4" />
                    Real-time coding battles — 1v1, Battle Royale &amp; Clan Wars
                </div>

                <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                    Competitive coding
                    <br />
                    <span className="bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
                        is its own arena.
                    </span>
                </h1>

                <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                    Go head-to-head against other developers in real-time coding battles. Solve
                    challenges faster, climb the ranks, and prove you&apos;re the best.
                </p>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                    <Link to="/login">
                        <Button size="lg" className="text-base px-8 py-6">
                            Start Battling — 1 free game daily
                            <Swords className="h-5 w-5" />
                        </Button>
                    </Link>
                    <a href="#how-it-works">
                        <Button variant="outline" size="lg" className="text-base px-8 py-6">
                            See How It Works
                        </Button>
                    </a>
                </div>
            </AnimateIn>

            {/* Floating code snippet preview */}
            <AnimateIn delay={400} className="relative z-10 mt-16 w-full max-w-3xl">
                <div className="rounded-xl border border-border bg-card/60 backdrop-blur-md p-6 shadow-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-3 w-3 rounded-full bg-red-500/80" />
                        <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                        <div className="h-3 w-3 rounded-full bg-green-500/80" />
                        <span className="ml-4 text-xs text-muted-foreground font-mono">
                            battle_arena.py
                        </span>
                    </div>
                    <pre className="text-sm font-mono text-muted-foreground overflow-x-auto">
                        <code>
                            <span className="text-violet-400">def</span>{' '}
                            <span className="text-blue-400">two_sum</span>(nums, target):
                            {'\n'}
                            {'    '}seen = {'{}'}{'\n'}
                            {'    '}
                            <span className="text-violet-400">for</span> i, n{' '}
                            <span className="text-violet-400">in</span>{' '}
                            <span className="text-blue-400">enumerate</span>(nums):{'\n'}
                            {'        '}diff = target - n{'\n'}
                            {'        '}
                            <span className="text-violet-400">if</span> diff{' '}
                            <span className="text-violet-400">in</span> seen:{'\n'}
                            {'            '}
                            <span className="text-violet-400">return</span> [seen[diff], i]{'\n'}
                            {'        '}seen[n] = i{'\n'}
                            {'\n'}
                            <span className="text-green-500"># ✓ All test cases passed — 12ms</span>
                        </code>
                    </pre>
                </div>
            </AnimateIn>

            {/* Scroll hint */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground/50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Logo Ticker                                                       */
/* ------------------------------------------------------------------ */
function LogoTicker() {
    const langs = [
        'Python',
        'JavaScript',
        'TypeScript',
        'Java',
        'C++',
        'C',
        'Rust',
    ];

    return (
        <section className="border-y border-border/40 bg-card/30 py-8 overflow-hidden">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
                Battle in your favourite language
            </p>
            <div className="relative flex overflow-hidden">
                <div className="flex animate-[marquee_30s_linear_infinite] gap-12 px-6">
                    {[...langs, ...langs].map((lang, i) => (
                        <span
                            key={i}
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground whitespace-nowrap"
                        >
                            <Terminal className="h-4 w-4 text-primary/60" />
                            {lang}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  How It Works                                                      */
/* ------------------------------------------------------------------ */
function HowItWorks() {
    const steps = [
        {
            icon: Target,
            title: 'Queue Up',
            desc: 'Join the matchmaking queue and get paired with an opponent at your skill level in seconds.',
        },
        {
            icon: Code,
            title: 'Battle',
            desc: 'Both players receive the same problem. Write your solution in a real code editor with syntax highlighting.',
        },
        {
            icon: Timer,
            title: 'Race the Clock',
            desc: 'You have limited time. Every second matters. Submit when ready — first correct solution gets bonus points.',
        },
        {
            icon: Trophy,
            title: 'Climb the Ranks',
            desc: 'Win battles, earn MMR, and climb from Bug 🐛 through Intern, Copy Paster, Code Monkey, 10x Dev, all the way to Cracked 💀.',
        },
    ];

    return (
        <section id="how-it-works" className="py-32 px-6">
            <div className="mx-auto max-w-6xl">
                <AnimateIn className="text-center mb-20">
                    <h2 className="text-4xl font-bold sm:text-5xl">
                        How it <span className="text-primary">works</span>
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        From queue to victory in four simple steps. No setup, no hassle.
                    </p>
                </AnimateIn>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map((step, i) => (
                        <AnimateIn key={step.title} delay={i * 150} direction="up">
                            <div className="group relative rounded-2xl border border-border bg-card/50 p-8 transition-all hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                                    <step.icon className="h-6 w-6" />
                                </div>
                                <div className="absolute top-4 right-4 text-5xl font-black text-muted-foreground/10">
                                    {i + 1}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {step.desc}
                                </p>
                            </div>
                        </AnimateIn>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Features                                                          */
/* ------------------------------------------------------------------ */
function Features() {
    const features = [
        {
            icon: Zap,
            title: 'Real-Time Code Execution',
            desc: 'Your code runs instantly against our test suite powered by Piston. No waiting — instant feedback on every submission.',
        },
        {
            icon: Users,
            title: 'Skill-Based Matchmaking',
            desc: 'Our ELO-based system ensures fair fights. You always face someone at your level so every battle is a real challenge.',
        },
        {
            icon: Trophy,
            title: 'Ranked Seasons',
            desc: 'Compete in seasonal ladders. Finish at the top to earn exclusive titles and bragging rights.',
        },
        {
            icon: Shield,
            title: 'Clan Wars',
            desc: 'Form clans with friends and challenge rival teams. Coordinate strategies and dominate the leaderboard together.',
        },
        {
            icon: Zap,
            title: 'In-Battle Skills',
            desc: 'Use power-ups like Freeze, Scramble, Time Steal, and Fog of War to sabotage opponents mid-battle.',
        },
        {
            icon: Code,
            title: '7 Languages Supported',
            desc: 'Battle in Python, JavaScript, TypeScript, Java, C++, C, and Rust. Pick the language you know best.',
        },
    ];

    return (
        <section id="features" className="py-32 px-6 bg-card/20">
            <div className="mx-auto max-w-6xl">
                <AnimateIn className="text-center mb-20">
                    <h2 className="text-4xl font-bold sm:text-5xl">
                        Why <span className="text-primary">CodeQuest</span>?
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        Everything you need to sharpen your skills through competition.
                    </p>
                </AnimateIn>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((f, i) => (
                        <AnimateIn
                            key={f.title}
                            delay={i * 100}
                            direction={i % 2 === 0 ? 'left' : 'right'}
                        >
                            <div className="group h-full rounded-2xl border border-border bg-background/50 p-8 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                                    <f.icon className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {f.desc}
                                </p>
                            </div>
                        </AnimateIn>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Stats                                                             */
/* ------------------------------------------------------------------ */
function Stats() {
    const stats = [
        { value: '4', label: 'Game modes' },
        { value: '7', label: 'Languages' },
        { value: '7', label: 'Rank tiers' },
        { value: '5', label: 'Battle skills' },
    ];

    return (
        <section id="stats" className="py-32 px-6">
            <div className="mx-auto max-w-5xl">
                <AnimateIn direction="scale">
                    <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 p-12 sm:p-16">
                        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-center">
                            {stats.map((s, i) => (
                                <AnimateIn key={s.label} delay={i * 150} direction="up">
                                    <div>
                                        <div className="text-4xl sm:text-5xl font-extrabold text-primary">
                                            {s.value}
                                        </div>
                                        <div className="mt-2 text-sm text-muted-foreground">
                                            {s.label}
                                        </div>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </AnimateIn>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Rank Showcase                                                     */
/* ------------------------------------------------------------------ */
function RankShowcase() {
    const ranks = [
        { name: 'Bug', icon: '🐛', color: '#22c55e', mmr: '< 800' },
        { name: 'Intern', icon: '📎', color: '#9ca3af', mmr: '800 – 999' },
        { name: 'Copy Paster', icon: '📋', color: '#cd7f32', mmr: '1000 – 1199' },
        { name: 'Stack Overflow Andy', icon: '🔍', color: '#c0c0c0', mmr: '1200 – 1399' },
        { name: 'Code Monkey', icon: '🐒', color: '#ffd700', mmr: '1400 – 1599' },
        { name: '10x Dev', icon: '⚡', color: '#3b82f6', mmr: '1600 – 1899' },
        { name: 'Cracked', icon: '💀', color: '#ef4444', mmr: '1900+' },
    ];

    return (
        <section className="py-32 px-6 bg-card/20">
            <div className="mx-auto max-w-6xl">
                <AnimateIn className="text-center mb-16">
                    <h2 className="text-4xl font-bold sm:text-5xl">
                        Climb the <span className="text-primary">ladder</span>
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                        Seven competitive tiers. Where will you land?
                    </p>
                </AnimateIn>

                <div className="flex flex-wrap justify-center gap-5">
                    {ranks.map((rank, i) => (
                        <AnimateIn key={rank.name} delay={i * 100} direction="scale">
                            <div className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/50 p-6 w-36 h-44 transition-all hover:border-primary/40 hover:shadow-lg">
                                <div
                                    className="h-14 w-14 shrink-0 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 text-3xl"
                                    style={{ backgroundColor: `${rank.color}20`, boxShadow: `0 0 20px ${rank.color}30` }}
                                >
                                    {rank.icon}
                                </div>
                                <span className="font-bold text-xs text-center leading-tight h-8 flex items-center" style={{ color: rank.color }}>
                                    {rank.name}
                                </span>
                                <span className="text-xs text-muted-foreground">{rank.mmr}</span>
                            </div>
                        </AnimateIn>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  FAQ                                                               */
/* ------------------------------------------------------------------ */
function FAQ() {
    const [open, setOpen] = useState<number | null>(null);
    const faqs = [
        {
            q: 'Is CodeQuest Battles free?',
            a: 'You get 1 free game per day. For unlimited games, DMs, clan creation, and season record tracking, upgrade to Pro at $5 every 2 months or $24.99/year. A 7-day free trial is available.',
        },
        {
            q: 'What languages are supported?',
            a: 'We support Python, JavaScript, TypeScript, Java, C++, C, and Rust — powered by the Piston code execution engine.',
        },
        {
            q: 'How does matchmaking work?',
            a: 'We use an Elo-based MMR system to pair you with opponents of similar skill. The search starts within ±100 MMR and gradually widens until a match is found.',
        },
        {
            q: 'What game modes are available?',
            a: '1v1 duels, Battle Royale (6 or 8 players with elimination rounds), Clan vs Clan wars, and Group battles with MMR auto-balance.',
        },
        {
            q: 'Can I play with friends?',
            a: 'Yes! Add friends, see who\'s online in real-time, invite them to battles with invite codes, create clans, and challenge rival clans to wars.',
        },
        {
            q: 'What are battle skills?',
            a: 'Optional power-ups you can toggle per game: Freeze (lock editor), Scramble (shuffle code, no undo), Time Steal (-5 min), and Fog of War (pulsating blur). Unlocks after you pass your first test case.',
        },
        {
            q: 'How are solutions judged?',
            a: 'Your code runs against visible and hidden test cases. We rank by tests passed first, then by speed. Partial credit is given for passing some tests.',
        },
    ];

    return (
        <section id="faq" className="py-32 px-6">
            <div className="mx-auto max-w-3xl">
                <AnimateIn className="text-center mb-16">
                    <h2 className="text-4xl font-bold sm:text-5xl">FAQ</h2>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Got questions? We&apos;ve got answers.
                    </p>
                </AnimateIn>

                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <AnimateIn key={i} delay={i * 80} direction="up">
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="w-full text-left rounded-xl border border-border bg-card/50 p-6 transition-all hover:border-primary/30"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{faq.q}</span>
                                    <ChevronRight
                                        className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${open === i ? 'rotate-90' : ''
                                            }`}
                                    />
                                </div>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ${open === i ? 'mt-4 max-h-40 opacity-100' : 'max-h-0 opacity-0'
                                        }`}
                                >
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {faq.a}
                                    </p>
                                </div>
                            </button>
                        </AnimateIn>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                         */
/* ------------------------------------------------------------------ */
function FinalCTA() {
    return (
        <section className="py-32 px-6">
            <AnimateIn direction="scale" className="mx-auto max-w-4xl">
                <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-12 sm:p-20 text-center">
                    {/* Glow */}
                    <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/20 blur-[100px]" />

                    <h2 className="relative text-4xl font-bold sm:text-5xl">
                        Ready to <span className="text-primary">battle</span>?
                    </h2>
                    <p className="relative mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
                        Sharpen your skills through head-to-head competition.
                        Sign up in seconds — 1 free game every day.
                    </p>
                    <div className="relative mt-10 flex flex-wrap justify-center gap-4">
                        <Link to="/login">
                            <Button size="lg" className="text-base px-8 py-6">
                                Get Started
                                <Swords className="h-5 w-5" />
                            </Button>
                        </Link>
                    </div>
                    <p className="relative mt-6 text-xs text-muted-foreground">
                        1 free game daily • Pro from $5/2mo • Sign in with GitHub or Google
                    </p>
                </div>
            </AnimateIn>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                            */
/* ------------------------------------------------------------------ */
function Footer() {
    return (
        <footer className="border-t border-border py-12 px-6">
            <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Swords className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">CodeQuest Battles</span>
                    <span>•</span>
                    <span>© {new Date().getFullYear()} All rights reserved</span>
                </div>
                <div className="flex gap-6 text-sm text-muted-foreground">
                    <a href="#" className="hover:text-foreground transition-colors">
                        Terms
                    </a>
                    <a href="#" className="hover:text-foreground transition-colors">
                        Privacy
                    </a>
                    <a href="#" className="hover:text-foreground transition-colors">
                        Contact
                    </a>
                </div>
            </div>
        </footer>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function Landing() {
    return (
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
            <Navbar />
            <Hero />
            <LogoTicker />
            <HowItWorks />
            <Features />
            <Stats />
            <RankShowcase />
            <TopLeaderboard />
            <FAQ />
            <FinalCTA />
            <Footer />
        </div>
    );
}
