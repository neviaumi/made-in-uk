#!/bin/sh

set -e
npm install
npx vite build
npx playwright install chromium