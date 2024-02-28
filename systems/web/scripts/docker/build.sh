#!/bin/bash

set -ex

npm ci --ignore-scripts
npx remix build
