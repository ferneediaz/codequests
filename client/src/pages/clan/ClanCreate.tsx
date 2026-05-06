import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ImagePlus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { createClan } from '@/services/clans';

const TAG_PATTERN = /^[A-Z0-9]{2,5}$/;

export default function ClanCreate() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [tag, setTag] = useState('');
    const [busy, setBusy] = useState(false);

    const canSubmit = name.trim().length > 0 && TAG_PATTERN.test(tag.trim());

    const onSubmit = async () => {
        if (!canSubmit) {
            toast.error('Clan tag must be 2-5 uppercase letters or numbers.');
            return;
        }
        setBusy(true);
        try {
            const clan = await createClan({
                name: name.trim(),
                tag: tag.trim().toUpperCase(),
            });
            toast.success('Clan created.');
            navigate(`/clans/${clan.id}`);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ?? 'Failed to create clan.';
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-3xl px-4 py-8">
                <AnimateIn direction="up">
                    <div className="mb-8">
                        <h1 className="text-4xl font-extrabold tracking-tight">
                            Create Clan
                        </h1>
                        <p className="mt-2 text-muted-foreground">
                            Start a clan, recruit friends, and prepare for Clan Wars.
                        </p>
                    </div>
                </AnimateIn>

                <Card>
                    <CardContent className="space-y-5 p-6">
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium">Clan name</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Code Warriors"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1 block text-sm font-medium">Clan tag</span>
                            <input
                                value={tag}
                                onChange={(e) =>
                                    setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                                }
                                placeholder="CW"
                                maxLength={5}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
                            />
                            <span className="mt-1 block text-xs text-muted-foreground">
                                Tags currently follow the server rule: 2-5 uppercase letters
                                or numbers.
                            </span>
                        </label>

                        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                                <ImagePlus className="h-4 w-4" />
                                Banner / logo
                            </div>
                            Banner and logo uploads are coming soon once clans have media
                            fields on the backend.
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Button onClick={onSubmit} disabled={!canSubmit || busy}>
                                <Shield className="mr-2 h-4 w-4" />
                                Create Clan
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/clans')}
                            >
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
