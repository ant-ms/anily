FROM node:22-alpine AS client-builder

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV CI=true
ENV npm_config_store_dir=/cache/pnpm-store
ENV npm_config_network_concurrency=8
ENV npm_config_fetch_timeout=60000

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app/client

COPY .npmrc /app/.npmrc
COPY .npmrc /.npmrc
COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY client/ ./
RUN pnpm build

FROM node:22-alpine AS builder

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV CI=true
ENV npm_config_store_dir=/cache/pnpm-store
ENV npm_config_network_concurrency=8
ENV npm_config_fetch_timeout=60000

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

COPY .npmrc /.npmrc
COPY .npmrc ./
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY server/ ./
RUN pnpm prisma generate
RUN pnpm codegen
RUN pnpm build

FROM node:22-alpine AS prod-deps

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV CI=true
ENV npm_config_store_dir=/cache/pnpm-store
ENV npm_config_network_concurrency=8
ENV npm_config_fetch_timeout=60000

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

COPY .npmrc /.npmrc
COPY .npmrc ./
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && \
    find node_modules -name ".pnpm-store" -type d -prune -exec rm -rf {} +

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=client-builder /app/client/dist ./public

CMD ["node", "dist/main.js"]
