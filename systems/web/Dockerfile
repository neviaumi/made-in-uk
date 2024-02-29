# Builder Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json ./remix.config.js ./remix.env.d.ts ./
COPY ./app ./app
COPY ./public ./public
COPY ./scripts/docker/ ./scripts/docker/

RUN sh ./scripts/docker/build.sh

# Run stage
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json /app/package-lock.json /app/remix.config.js ./
COPY --from=builder /app/scripts/docker/start.sh ./scripts/docker/start.sh
RUN npm ci --ignore-scripts --omit=dev
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "sh", "scripts/docker/health-check.sh" ]
USER node