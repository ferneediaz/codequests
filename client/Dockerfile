# syntax=docker/dockerfile:1.6

# ---- Stage 1: build ----------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Vite bakes VITE_* vars into the bundle at build time. Pass them through
# `docker build --build-arg ...` or `docker compose build --build-arg ...`.
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_WS_URL=${VITE_WS_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build


# ---- Stage 2: runtime (static via nginx) -------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
