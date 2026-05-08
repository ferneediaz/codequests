import { Dialog } from 'radix-ui';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closePaywallModal } from '@/store/slices/uiSlice';

export function PaywallModal() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const open = useAppSelector((state) => state.ui.paywallModalOpen);

    const handleClose = () => dispatch(closePaywallModal());
    const handleUpgrade = () => {
        dispatch(closePaywallModal());
        navigate('/pricing');
    };

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) handleClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    aria-describedby="paywall-modal-description"
                >
                    <Dialog.Close
                        className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </Dialog.Close>

                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles className="h-6 w-6" aria-hidden />
                    </div>

                    <Dialog.Title className="mb-2 text-xl font-semibold">
                        You've used your free games today
                    </Dialog.Title>
                    <Dialog.Description
                        id="paywall-modal-description"
                        className="mb-6 text-sm text-muted-foreground"
                    >
                        Upgrade to Pro for unlimited 1v1s, ranked battle royale,
                        clan wars, and the full skill loadout.
                    </Dialog.Description>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                        >
                            Maybe later
                        </Button>
                        <Button onClick={handleUpgrade}>
                            Upgrade to Pro
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
