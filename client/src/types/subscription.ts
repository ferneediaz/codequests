export type SubscriptionTier = 'free' | 'pro' | 'trial';

/**
 * Where the Pro entitlement comes from. Allows the UI to render a small
 * "Dev PRO" badge for users who get Pro via the server-side developer
 * allowlist (DEV_PRO_USER_IDS / DEV_PRO_EMAILS) instead of a real
 * Stripe-paid subscription.
 */
export type SubscriptionSource = 'stripe' | 'trial' | 'dev';

export interface SubscriptionDetails {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
}

export interface SubscriptionStatus {
    tier: SubscriptionTier;
    /** -1 means unlimited (pro/trial/dev). */
    gamesRemaining: number;
    gamesPlayedToday: number;
    /** -1 means unlimited (pro/trial/dev). */
    dailyLimit: number;
    resetsAt: string;
    trialEndsAt?: string;
    subscription?: SubscriptionDetails;
    source?: SubscriptionSource;
}

export type CheckoutPlan = 'bimonthly' | 'yearly';

export interface CheckoutResponse {
    sessionUrl: string;
}

export interface PortalResponse {
    portalUrl: string;
}
