#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  set -o allexport
  source .env.local
  set +o allexport
fi

# Start the dev server with any passed flags
next dev -p 3004 "$@"
