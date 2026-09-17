FROM node:22-alpine AS client-builder

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app/client

COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY client/ ./
RUN pnpm build

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY server/ ./
RUN pnpm prisma generate
RUN pnpm codegen
RUN pnpm build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=client-builder /app/client/dist ./public

CMD ["node", "dist/main.js"]
