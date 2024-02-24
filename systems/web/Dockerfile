# Builder Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json ./remix.config.js ./remix.env.d.ts ./
COPY ./app ./app
COPY ./public ./public
# dev-seeding is used to demo purposes only
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

USER node