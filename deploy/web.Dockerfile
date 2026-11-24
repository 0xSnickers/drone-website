FROM node:26-slim AS builder
WORKDIR /build/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./

ARG VITE_APP_NAME=AeroApex
ARG VITE_APP_ENV=production
ARG VITE_APP_RELEASE=unknown
ARG VITE_API_BASE_URL=/api
ARG VITE_TELEMETRY_ENABLED=false
ARG VITE_SENTRY_DSN=
ARG VITE_POSTHOG_KEY=
ARG VITE_POSTHOG_HOST=https://us.i.posthog.com

ENV VITE_APP_NAME=$VITE_APP_NAME \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_APP_RELEASE=$VITE_APP_RELEASE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_TELEMETRY_ENABLED=$VITE_TELEMETRY_ENABLED \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST

RUN npm run build

FROM nginx:1.28-alpine
COPY deploy/spa-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
