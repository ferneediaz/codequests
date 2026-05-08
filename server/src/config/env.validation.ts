import { z } from 'zod';

const baseSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_KEY: z.string().min(1),

    JWT_JWK: z.string().min(1, 'JWT_JWK is required (JWK from Supabase)'),

    PISTON_URL: z.string().url(),

    CLIENT_URL: z.string().url().default('http://localhost:5173'),

    // Stripe — required in production, allowed-empty in dev so a fresh clone
    // can boot without a Stripe account. The subscription routes themselves
    // throw at runtime if they're hit without keys.
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID_BIMONTHLY: z.string().optional(),
    STRIPE_PRICE_ID_YEARLY: z.string().optional(),

    // Optional toggles + integrations
    DEV_PRO_USER_IDS: z.string().optional(),
    DEV_PRO_EMAILS: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    ENABLE_AUTHOR_TOOLS: z
        .union([z.literal('true'), z.literal('false')])
        .optional(),
    CORS_ORIGIN: z.string().optional(),
});

const productionStripeSchema = z.object({
    STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required in production'),
    STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required in production'),
    STRIPE_PRICE_ID_BIMONTHLY: z.string().min(1, 'STRIPE_PRICE_ID_BIMONTHLY is required in production'),
    STRIPE_PRICE_ID_YEARLY: z.string().min(1, 'STRIPE_PRICE_ID_YEARLY is required in production'),
});

export type Env = z.infer<typeof baseSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
    const base = baseSchema.safeParse(raw);
    if (!base.success) {
        printAndThrow(base.error.issues);
    }
    if (base.data.NODE_ENV === 'production') {
        const stripe = productionStripeSchema.safeParse(raw);
        if (!stripe.success) {
            printAndThrow(stripe.error.issues);
        }
    }
    return base.data;
}

function printAndThrow(issues: z.core.$ZodIssue[]): never {
    const lines = issues.map((i) => {
        const path = i.path.join('.') || '(root)';
        return `  - ${path}: ${i.message}`;
    });
    const message = [
        '❌ Invalid environment configuration:',
        ...lines,
        '',
        'Check .env.example for the full list of required variables.',
    ].join('\n');
    // Use console.error here — Logger isn't available before bootstrap.
    console.error(message);
    throw new Error('Environment validation failed');
}
