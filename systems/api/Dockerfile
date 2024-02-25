# Builder Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json ./
COPY ./src/ ./src/
COPY ./scripts/build.sh ./scripts/build.sh
COPY ./scripts/docker/start.sh ./scripts/docker/start.sh

RUN npm ci --ignore-scripts && \
     sh ./scripts/build.sh

# Run stage
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/scripts/docker/start.sh ./scripts/docker/start.sh

RUN npm ci --ignore-scripts --omit=dev

USER node