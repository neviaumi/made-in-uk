#!/bin/sh

set -e

npx rimraf dist
API_ENV=development npm run start:dev