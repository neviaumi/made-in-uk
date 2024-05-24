#!/bin/sh

set -e
npm ci
npx vite build
npx playwright install chromium