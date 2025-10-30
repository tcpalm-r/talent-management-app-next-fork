#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Start the dev server with any passed flags
next dev -p 3004 "$@"
