import { useContext } from 'react';
import { SocialLayoutContext } from '@/context/socialLayoutContext';

export function useSocialLayout() {
    const ctx = useContext(SocialLayoutContext);
    if (!ctx) {
        throw new Error('useSocialLayout must be used within RootLayout');
    }
    return ctx;
}
