#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  set -o allexport
  source .env.local
  set +o allexport
fi

# Start the dev server with any passed flags
# Use PORT env var if set, otherwise default to 3004
PORT=${PORT:-3004}
next dev -p "$PORT" "$@"
