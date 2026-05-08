# syntax=docker/dockerfile:1.6

# ---- Stage 1: build ----------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# OpenSSL is required by Prisma at runtime; install once here so the
# generated client matches the runtime environment.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Strip dev deps for the runtime image.
RUN npm prune --omit=dev


# ---- Stage 2: runtime --------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/false app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 3000

# Run migrations on boot, then start. Use `migrate deploy` (production-safe,
# does not generate or seed). Failure to migrate aborts startup.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1
