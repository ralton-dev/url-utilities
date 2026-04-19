FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

RUN addgroup -g 10001 -S app && adduser -u 10001 -S app -G app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=10001:10001 /app/dist ./dist
# Migration assets (used by the pre-sync Job in the k8s deploy).
COPY --chown=10001:10001 src/db/migrations ./src/db/migrations
COPY --chown=10001:10001 scripts ./scripts

RUN chown -R 10001:10001 /app

USER 10001

EXPOSE 3000

CMD ["node", "dist/server.js"]
