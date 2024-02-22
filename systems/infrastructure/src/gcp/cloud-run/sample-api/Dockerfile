FROM node:20-alpine

COPY simple-http-counter.js package.json package-lock.json /

RUN npm install --ci
CMD npm run start