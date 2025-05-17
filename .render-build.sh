#!/usr/bin/env bash

# Install poetry if not already present
curl -sSL https://install.python-poetry.org | python3 -

# Add poetry to path
export PATH="$HOME/.local/bin:$PATH"

# Install dependencies
poetry install --no-root
