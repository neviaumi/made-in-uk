# Builder Stage
FROM node:20-alpine AS base

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json ./vite.config.ts ./
COPY ./src/ ./src/
COPY ./scripts/build.sh ./scripts/build.sh
COPY ./scripts/docker/ ./scripts/docker/

RUN sh ./scripts/docker/setup.sh --dev

FROM base AS builder
RUN sh ./scripts/build.sh

# Run stage
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/scripts/docker/ ./scripts/docker/

RUN sh ./scripts/docker/setup.sh --prod
HEALTHCHECK --interval=30s --timeout=60s --start-period=5s --retries=3 CMD [ "sh", "scripts/docker/health-check.sh" ]

