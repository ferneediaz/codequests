import api from './api';
import type {
    CheckoutPlan,
    CheckoutResponse,
    PortalResponse,
    SubscriptionStatus,
} from '@/types/subscription';

export const subscriptionsApi = {
    async getStatus(): Promise<SubscriptionStatus> {
        const { data } = await api.get<SubscriptionStatus>(
            '/subscriptions/status',
        );
        return data;
    },

    async createCheckoutSession(plan: CheckoutPlan): Promise<CheckoutResponse> {
        const { data } = await api.post<CheckoutResponse>(
            '/subscriptions/checkout',
            { plan },
        );
        return data;
    },

    async createPortalSession(): Promise<PortalResponse> {
        const { data } = await api.post<PortalResponse>(
            '/subscriptions/portal',
        );
        return data;
    },

    async startTrial(): Promise<{ trialEndsAt: string }> {
        const { data } = await api.post<{ trialEndsAt: string }>(
            '/subscriptions/trial',
        );
        return data;
    },
};
