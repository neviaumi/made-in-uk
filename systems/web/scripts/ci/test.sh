#!/bin/sh

set -ex

npx eslint .
npx tsc
