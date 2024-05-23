# Builder Stage
FROM node:20-alpine AS base

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json ./remix.config.js ./remix.env.d.ts ./tailwind.config.mjs ./
COPY ./app ./app
COPY ./public ./public
COPY ./scripts/docker/ ./scripts/docker/
COPY ./scripts/build.sh ./scripts/build.sh

RUN sh ./scripts/docker/setup.sh --dev

FROM base AS builder
RUN sh ./scripts/build.sh

# Run stage
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json /app/package-lock.json /app/remix.config.js ./
COPY --from=builder /app/scripts/docker/start.sh ./scripts/docker/start.sh
RUN sh ./scripts/docker/setup.sh --prod
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "sh", "scripts/docker/health-check.sh" ]
USER node