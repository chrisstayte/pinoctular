#!/bin/sh

# Start the API server in the background if WATCH_PATHS is set
if [ -n "$WATCH_PATHS" ]; then
    echo "[entrypoint] WATCH_PATHS is set, starting API server..."
    node --import tsx /app/server/index.ts &
fi

# Start nginx in the foreground
echo "[entrypoint] Starting nginx..."
nginx -g 'daemon off;'
