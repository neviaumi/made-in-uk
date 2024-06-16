# Builder Stage
FROM mcr.microsoft.com/playwright:v1.44.0-jammy-amd64 AS base

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json ./vite.config.ts ./
COPY ./src/ ./src/
COPY ./scripts/build.sh ./scripts/build.sh
COPY ./scripts/docker/ ./scripts/docker/

RUN bash ./scripts/docker/setup.sh --dev

FROM base AS builder
RUN bash ./scripts/build.sh

# Run stage
FROM mcr.microsoft.com/playwright:v1.44.0-jammy-amd64

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/scripts/docker/ ./scripts/docker/

RUN bash ./scripts/docker/setup.sh --prod
HEALTHCHECK --interval=30s --timeout=60s --start-period=5s --retries=3 CMD [ "sh", "scripts/docker/health-check.sh" ]

