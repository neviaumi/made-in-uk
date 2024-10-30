#!/bin/bash

set -ex
pdm install -G llama.cpp
pdm run huggingface-cli download bartowski/Phi-3.5-mini-instruct-GGUF --include "Phi-3.5-mini-instruct-Q4_K_M.gguf" --local-dir ./.models/phi-3.5
