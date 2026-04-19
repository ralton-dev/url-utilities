FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The build reads env.mjs via @t3-oss/env-nextjs; provide dummies so the
# build doesn't fail. Real values come from the k8s Secret at runtime.
ENV APP_URL=http://localhost:3000 \
    API_KEY=build-time-placeholder \
    POSTGRES_URL=postgres://build:build@localhost/build
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 10001 -S app && adduser -u 10001 -S app -G app

COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
# Migration assets (used by the Helm pre-install hook).
# Standalone output doesn't trace drizzle-orm/postgres-js/migrator since
# no server route imports it — copy drizzle-orm in full to cover it.
COPY --from=builder --chown=10001:10001 /app/src/db/migrations ./src/db/migrations
COPY --from=builder --chown=10001:10001 /app/scripts ./scripts
COPY --from=builder --chown=10001:10001 /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER 10001

EXPOSE 3000

CMD ["node", "server.js"]
