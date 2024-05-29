FROM node:20-alpine

WORKDIR /app

COPY ./package.json ./package-lock.json ./
COPY ./scripts/docker/ ./scripts/docker/

RUN sh ./scripts/docker/setup.sh
USER node