FROM node:20-alpine

COPY simple-http-proxy.js package.json package-lock.json /

RUN npm install --ci
CMD npm run start