# Builder Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY ./package.json ./package-lock.json ./tsconfig.json ./
COPY ./src/ ./src/
# dev-seeding is used to demo purposes only
COPY ./scripts/build.sh ./scripts/build.sh

RUN npm ci --ignore-scripts && \
     sh ./scripts/build.sh

# Run stage
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./

RUN npm ci --ignore-scripts --omit=dev

USER node