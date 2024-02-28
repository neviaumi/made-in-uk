#!/bin/bash

set -ex

npm ci --ignore-scripts --include=optional
npx remix build
