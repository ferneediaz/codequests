# CodeQuest Battles — Soft Launch Deploy Runbook

This runbook gets you from a green `main` branch to a working production
deployment on **AWS EC2**, the path agreed in the soft-launch plan. It assumes
a single EC2 instance running the full stack via `docker compose` (Postgres on
Supabase, server + Piston + nginx in compose). The split layout (server on
Render/Fly, Piston on EC2) is called out where it differs.

**You are deploying when:** server tests are green locally, the Prisma
baseline `0_init` is committed and applied to your dev DB, and the items in
[Pre-flight checklist](#pre-flight-checklist) below all pass.

---

## Architecture overview

```
                        ┌─────────────────────────────────┐
   Browser ─── HTTPS ──▶│ Nginx (client static + reverse  │
                        │ proxy /api → server, /socket.io)│
                        └────────────────┬────────────────┘
                                         │
   ┌─────────────────────┐               │       ┌──────────────────┐
   │ Supabase            │◀── Postgres ──┤       │ Stripe           │
   │ (Auth + Postgres)   │               │       │ (webhooks)       │
   └─────────────────────┘               ▼       └──────────────────┘
                        ┌─────────────────────────────────┐
                        │ Server (NestJS, port 3000)      │
                        └────────────────┬────────────────┘
                                         │ HTTP (private SG)
                                         ▼
                        ┌─────────────────────────────────┐
                        │ Piston (port 2000)              │
                        └─────────────────────────────────┘
```

All three of `client`, `server`, `piston` run as containers on **one** EC2
instance for soft launch. Postgres lives on **Supabase** (already used for
auth — keep them together to simplify networking and backups).

---

## Pre-flight checklist

Before touching AWS, confirm these on your laptop:

- [ ] `cd server && npm test` — 787/787 green
- [ ] `cd client && npm run lint && npm run build && npm test` — green
- [ ] `git status` — clean tree on `main`
- [ ] `server/prisma/migrations/0_init/migration.sql` exists (baseline migration)
- [ ] You have **owner access** to: Supabase project, GitHub OAuth app, Google OAuth app, Stripe account, the domain you'll point at the server
- [ ] You decided: **subdomain layout** (e.g. `codequest.app` for the SPA, `api.codequest.app` for the server) — write them down, you'll wire them everywhere

---

## 1. Provision Supabase (Auth + Postgres)

You're already on Supabase for OAuth. Use it for Postgres too.

1. **Project settings → Database → Connection string** — copy the **Session pooler** URL (port `5432` for direct, `6543` for pgbouncer-pooled). Use the pooler URL for `DATABASE_URL` in production — it survives the spiky connection patterns of NestJS + Prisma.
2. **Settings → API → JWT keys** — copy the **JWK (public key)** JSON. This populates `JWT_JWK` on the server. Format must match the example in `server/.env.example` (an `{x, y, alg, crv, kty, ...}` object).
3. **Authentication → URL Configuration → Site URL** — set to `https://<your-client-domain>`.
4. **Authentication → URL Configuration → Redirect URLs** — add:
   - `https://<your-client-domain>/auth/callback`
   - keep the localhost ones for dev convenience
5. **Authentication → Providers → GitHub** — toggle on, paste GitHub OAuth client ID + secret (from step 2 below).
6. **Authentication → Providers → Google** — toggle on, paste Google OAuth client ID + secret (from step 3 below).

---

## 2. GitHub OAuth app

1. https://github.com/settings/developers → **New OAuth App**.
2. **Homepage URL:** `https://<your-client-domain>`
3. **Authorization callback URL:** the value Supabase shows under
   *Authentication → Providers → GitHub → Redirect URL* — looks like
   `https://<project-ref>.supabase.co/auth/v1/callback`. **This must match
   exactly.**
4. Generate a client secret. Paste client ID + secret into Supabase from
   step 1.5.

You also need a **fine-grained PAT** (separate from the OAuth app) for the
`GITHUB_TOKEN` env var that powers the activity heatmap:
1. https://github.com/settings/tokens?type=beta → **Generate new token**
2. No repository access, no scopes (public read is implicit).
3. Save the token — it goes in `server/.env` as `GITHUB_TOKEN`.

---

## 3. Google OAuth credentials

1. https://console.cloud.google.com → **APIs & Services → Credentials → Create OAuth client ID** (Web application).
2. **Authorized redirect URIs:** the value Supabase shows under
   *Authentication → Providers → Google → Redirect URL* — looks like
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copy client ID + secret into Supabase from step 1.6.

---

## 4. Stripe (live mode)

You currently have test-mode wired (per `server/TODO.md`). For soft launch:

1. **Top-right toggle → switch from Test to Live mode.** Everything below is in live mode.
2. **Products → Add product** → "CodeQuest Pro":
   - Price A: `$5.00 USD`, recurring, **interval = month**, **interval_count = 2** (the bimonthly price — DO NOT use a plain monthly price, the pricing page hardcodes 2-month billing).
   - Price B: `$24.99 USD`, recurring, yearly.
   - Note the live `price_...` IDs for both.
3. **Developers → Webhooks → Add endpoint:**
   - Endpoint URL: `https://<your-server-domain>/api/subscriptions/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Save → reveal the **Signing secret** (`whsec_...`). This becomes `STRIPE_WEBHOOK_SECRET`.
4. **Developers → API keys** — copy the live **Secret key** (`sk_live_...`). This becomes `STRIPE_SECRET_KEY`.
5. **Settings → Customer portal** — enable the portal in live mode (the `/api/subscriptions/portal` endpoint depends on this). Configure cancellation flow as you wish.

---

## 5. Domain + DNS + TLS

This stack assumes your DNS provider handles certs (e.g. nginx-proxy +
Let's Encrypt, or Caddy in front of compose). The simplest path:

1. Buy or pick a domain.
2. Decide split:
   - **Single hostname** (`codequest.app`) — simplest. The included `client/nginx.conf` already serves the SPA. You'd add a reverse-proxy rule for `/api` and `/socket.io` to the server container. **Skip CORS entirely** since same-origin.
   - **Two hostnames** (`codequest.app` for client + `api.codequest.app` for server) — needs CORS, separate certs.
3. Point both A records at your EC2 instance's Elastic IP (provision in step 6).
4. Run a TLS terminator. Easiest: **Caddy** in front of the docker-compose stack. Caddy auto-provisions Let's Encrypt certs.

---

## 6. AWS EC2 instance

1. **Launch instance:**
   - **Type:** `t3.small` minimum (2 GB RAM is the floor for NestJS + Piston + Postgres queries; `t3.medium` is safer).
   - **AMI:** Amazon Linux 2023 (or Ubuntu 22.04 if you prefer apt).
   - **Storage:** 30 GB gp3 (Piston downloads language runtimes on first use).
2. **Allocate Elastic IP** and associate it. Without this your IP rotates on stop/start.
3. **Security group:**
   - Inbound `80/tcp` and `443/tcp` from `0.0.0.0/0` — for browser traffic
   - Inbound `22/tcp` from **your IP only** — SSH
   - **No** inbound rule for `2000` (Piston) or `3000` (server) — those are only reachable on the docker network
4. **SSH in**, install docker + compose:
   ```bash
   sudo dnf install -y docker
   sudo systemctl enable --now docker
   sudo usermod -aG docker ec2-user
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   exit  # log out + back in for group change
   ```
5. Clone the repo and `cd codequest_battles`.

---

## 7. Production env files

Two files live on the EC2 instance, **not committed to git**.

### `server/.env`

Copy `server/.env.example` and fill in:

```bash
# Supabase Postgres pooler URL from step 1.1
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Supabase from step 1
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service role key>
JWT_JWK={"x":"...","y":"...","alg":"ES256","crv":"P-256","kty":"EC","key_ops":["verify"]}

# Internal: server reaches piston via docker network
PISTON_URL=http://piston:2000

# App
PORT=3000
NODE_ENV=production

# Leave the dev-pro allowlist EMPTY in production
DEV_PRO_USER_IDS=
DEV_PRO_EMAILS=

# Stripe live keys + webhook secret + price IDs from step 4
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BIMONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...

# Used to build Stripe success/cancel/portal-return URLs
CLIENT_URL=https://<your-client-domain>

# Hard-disable the YAML authoring tools in production
ENABLE_AUTHOR_TOOLS=false

# CORS origins (comma-separated). Single-hostname setup: omit; same-origin
# means no CORS. Two-hostname setup: list the client origin.
CORS_ORIGIN=https://<your-client-domain>

# GitHub PAT from step 2 (for activity heatmap)
GITHUB_TOKEN=github_pat_...
```

### `client/.env`

Vite bakes these into the bundle at **build time**. Changing them later
requires `docker compose build client`.

```bash
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_API_URL=https://<your-server-domain>/api
VITE_WS_URL=https://<your-server-domain>
```

If single-hostname, both `VITE_API_URL` and `VITE_WS_URL` use the same
domain as the SPA itself (`https://codequest.app/api`, `https://codequest.app`).

---

## 8. Add Piston to the production compose stack

The included `docker-compose.yml` has Piston commented as optional. For
production add the service explicitly:

```yaml
  piston:
    image: ghcr.io/engineer-man/piston:latest
    restart: unless-stopped
    privileged: true                 # piston runs nsjail under the hood
    tmpfs:
      - /piston/jobs
    volumes:
      - piston_packages:/piston/packages
    # Note: NO `ports:` block — piston is reachable only on the docker
    # network at hostname `piston:2000`. Keeping it off the host's network
    # interface is the soft-launch security boundary.

volumes:
  pgdata:
  piston_packages:
```

After first boot, install the language runtimes you support (one-time):

```bash
docker compose exec piston bash -lc '
  for pkg in python=3.12.0 javascript=20.11.1 typescript=5.0.3 java=21.0.0 cpp=10.2.0 c=10.2.0 rust=1.68.2; do
    /piston/cli/index.js ppman install "$pkg"
  done
'
```

These runtimes persist in the `piston_packages` named volume across restarts.

---

## 9. First deploy

```bash
# On the EC2 instance, in /home/ec2-user/codequest_battles
docker compose pull
docker compose up -d --build
docker compose logs -f server
```

What you should see in `server` logs:
- `validateEnv` succeeds (else env var is missing — fix `.env` and `up -d` again)
- `Prisma client connected`
- `0_init` migration applied (only on a fresh Supabase DB) or skipped (if you ran `prisma migrate resolve --applied 0_init` on this DB earlier)
- `🚀 Server running on http://localhost:3000`

Then verify:
```bash
curl -fsS https://<your-server-domain>/api/health
# → {"status":"ok","db":"ok","uptime":...,"timestamp":"..."}
```

---

## 10. Smoke test (end-to-end, in the deployed env)

Run these in order. If any fails, **stop** and fix before promoting.

1. **Open the SPA** at `https://<your-client-domain>` — landing page renders, no console errors.
2. **GitHub login** → confirm redirect through Supabase → land on `/dashboard` with your username.
3. **Google login** in an incognito window → same path.
4. **Practice run:** open `/practice`, pick a problem, run a known-good Python solution → tests pass. (This proves Piston reachability.)
5. **Matchmaking + 1v1:** open the deployed app in two browsers (different accounts). Both queue → match found → write code → both submit → results page shows MMR delta. **Refresh the results page** — data persists, the new layout-shaped skeleton flashes briefly, then the results render.
6. **Stripe (live mode!):** click upgrade → Stripe checkout → use **a real card you own** (live mode, this charges real money) — pay $5 → redirect back to `/pricing?checkout=success` → navbar badge flips to `PRO ∞`.
7. **Stripe webhook:** in Stripe dashboard → Webhooks → your endpoint → recent deliveries should show 200 status. Re-trigger one event manually if you want belt-and-braces.
8. **Cancel:** click "Manage Billing" → Stripe portal → cancel → after returning, status reflects `cancelAtPeriodEnd`.
9. **Refund** the $5 in Stripe so you don't pay yourself.
10. **404 page:** visit `https://<your-client-domain>/<random-path>` — dedicated 404 renders (not redirect to home).
11. **Request log:** `docker compose logs server | tail -20` shows JSON-shaped log lines like `[Request] GET /api/users/me 200 12ms id=<uuid>`.

If 1–10 all pass, you're shipped.

---

## 11. Day-2 operations

- **Tail logs:** `docker compose logs -f server` (the request-logger middleware writes one line per request, with an `X-Request-Id` you can grep).
- **Check migration state:** `docker compose exec server npx prisma migrate status`.
- **Update + redeploy:** `git pull && docker compose up -d --build`. The `Dockerfile` runs `prisma migrate deploy` on boot, so any new migrations apply automatically.
- **Rollback:** `git checkout <previous-sha> && docker compose up -d --build`. Be careful with rolling back across migrations — Prisma doesn't auto-revert applied migrations; you'd need a manual fix-forward migration.
- **Backups:** Supabase takes daily DB backups on the paid plan. Confirm you're on a tier that includes backups before launch.

---

## 12. Known limitations to revisit post-launch

The soft-launch deliberately defers these — none block launch, all should
land before you have meaningful traffic:

- **Single-instance state.** `BattlesGateway` and chat keep client maps in
  memory. Horizontal scaling will need the Socket.IO Redis adapter — see
  [client/TODO.md §P2](client/TODO.md) for the broader server scale items.
- **Sentry / error reporting.** `ErrorBoundary` already calls
  `console.error` in dev — wiring it to `Sentry.captureException` is a
  single-line change once you have a DSN.
- **Playwright E2E in CI.** The harness exists in `client/playwright/`
  but isn't wired into `.github/workflows/ci.yml`. Add a separate workflow
  with a service container for Postgres before you start shipping aggressive
  changes to the battle flow.
- **Postgres connection limits.** Soft launch on Supabase pooled URL is
  fine. If you spike traffic, watch the pooler dashboard and bump the
  Supabase tier.

---

## Quick reference — where each var lives

| Var | Used by | Source |
|---|---|---|
| `DATABASE_URL` | server | Supabase pooler URL |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` | server + client | Supabase Settings → API |
| `JWT_JWK` | server | Supabase Settings → API → JWT keys |
| `PISTON_URL` | server | `http://piston:2000` (docker network) |
| `STRIPE_SECRET_KEY` | server | Stripe live API keys |
| `STRIPE_WEBHOOK_SECRET` | server | Stripe webhook endpoint signing secret |
| `STRIPE_PRICE_ID_*` | server | Stripe live products |
| `CLIENT_URL` | server | your client origin |
| `CORS_ORIGIN` | server | your client origin (omit if same-origin) |
| `GITHUB_TOKEN` | server | GitHub fine-grained PAT (no scopes) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | client (build-time) | same Supabase values |
| `VITE_API_URL` / `VITE_WS_URL` | client (build-time) | your server origin |
