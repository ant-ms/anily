FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma generate
RUN pnpm codegen
RUN pnpm build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.29.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/main.js"]
