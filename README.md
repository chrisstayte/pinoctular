# Pinoctular

A lightweight, browser-based viewer for [Pino](https://getpino.io/#/) JSON logs with optional real-time log watching.

## Screenshots

### Upload / paste logs

![Upload screen](https://github.com/user-attachments/assets/200c1fbf-c317-4389-96b4-de822764dace)

### Loaded log explorer

![Loaded logs screen](https://github.com/user-attachments/assets/fabea5e4-2a7b-4156-8842-d832b9ee8934)

## Features

- Upload `.log`, `.txt`, `.json`, or `.ndjson` files
- Paste newline-delimited Pino JSON logs directly into the app
- Real-time log watching from mounted directories (Docker)
- Live-streaming via WebSocket with auto-reconnect
- Follow mode to auto-scroll as new logs arrive
- Filter logs by level and module
- Search across full log payloads
- Sort by timestamp, level, module, or message
- Copy individual log entries as JSON
- Light/dark theme toggle

## Running locally

### Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 10+

If you do not have pnpm installed, enable it with Corepack:

```bash
corepack enable
```

### Install dependencies

```bash
pnpm install --frozen-lockfile
```

### Start the development server

```bash
pnpm dev
```

Then open http://localhost:3000.

To develop with the watch server running alongside Next.js:

```bash
# Terminal 1 — Next.js frontend
pnpm dev

# Terminal 2 — Watch API server
WATCH_PATHS='[{"name":"My App","path":"./test-logs"}]' npx tsx server/index.ts
```

The frontend auto-detects the API server at `http://localhost:3001` during development.

## Available scripts

- `pnpm dev` — run the app in development mode
- `pnpm build` — create a production build
- `pnpm start` — run the production server
- `pnpm lint` — run linting

## Example log input

Paste newline-delimited JSON like:

```json
{"level":30,"time":1739530000000,"msg":"Server started","module":"api"}
{"level":40,"time":1739530001000,"msg":"Slow query detected","module":"db"}
{"level":50,"time":1739530002000,"msg":"Unhandled exception","module":"worker"}
```

## Self-Hosting

Pinoctular is available as a multi-arch Docker image (`linux/amd64` and `linux/arm64`) from the GitHub Container Registry.

### Docker Compose (recommended)

Create a `compose.yml`:

```yaml
services:
  pinoctular:
    container_name: pinoctular
    image: ghcr.io/chrisstayte/pinoctular:latest
    ports:
      - 1738:80
    restart: unless-stopped
```

Then start it:

```bash
docker compose up -d
```

Pinoctular will be available at http://localhost:1738.

> Change `1738` to any host port you prefer.

### Docker Run

```bash
docker run -d \
  --name pinoctular \
  -p 1738:80 \
  --restart unless-stopped \
  ghcr.io/chrisstayte/pinoctular:latest
```

### Pinning a Version

Each release publishes a tagged image. To pin to a specific version instead of `latest`:

```yaml
image: ghcr.io/chrisstayte/pinoctular:1.2.0
```

Available tags can be found on the [packages page](https://github.com/chrisstayte/pinoctular/pkgs/container/pinoctular).

### Reverse Proxy

If you're running Pinoctular behind a reverse proxy (e.g. Nginx, Caddy, Traefik), point it at the container's port. For example with Caddy:

```
pinoctular.example.com {
    reverse_proxy localhost:1738
}
```

### Building from Source

If you prefer to build the image yourself:

```bash
git clone https://github.com/chrisstayte/pinoctular.git
cd pinoctular
docker build -t pinoctular .
docker run -d -p 1738:80 pinoctular
```

## Real-Time Log Watching

Pinoctular can watch directories on disk and stream new log lines to the browser in real time. This feature is designed for Docker deployments where you mount your application's log directories into the container.

When watching is enabled, the home page displays cards for each watched folder. Selecting a folder loads historical logs and opens a live WebSocket connection that streams new lines as they are written.

### Enabling Watched Folders

Set the `WATCH_PATHS` environment variable to a JSON array of folder configurations. Each entry needs a `name` (display label) and a `path` (directory inside the container):

```json
[
  { "name": "App", "path": "/logs/app" },
  { "name": "Worker", "path": "/logs/worker" }
]
```

Mount the corresponding host directories as volumes so the container can access the log files.

### Docker Compose with Watching

```yaml
services:
  pinoctular:
    container_name: pinoctular
    image: ghcr.io/chrisstayte/pinoctular:latest
    ports:
      - 1738:80
    restart: unless-stopped
    environment:
      - WATCH_PATHS=[{"name":"App","path":"/logs/app"},{"name":"Worker","path":"/logs/worker"}]
    volumes:
      - /var/log/myapp:/logs/app
      - /var/log/myworker:/logs/worker
```

### Docker Run with Watching

```bash
docker run -d \
  --name pinoctular \
  -p 1738:80 \
  -e 'WATCH_PATHS=[{"name":"App","path":"/logs/app"}]' \
  -v /var/log/myapp:/logs/app \
  --restart unless-stopped \
  ghcr.io/chrisstayte/pinoctular:latest
```

### How It Works

The Docker image runs two processes:

1. **nginx** serves the static frontend on port 80.
2. **Node.js API server** (started automatically when `WATCH_PATHS` is set) watches the configured directories for `.log` file changes and exposes a REST + WebSocket API on an internal port. nginx proxies `/api/*` requests to this server.

If `WATCH_PATHS` is not set, only nginx runs and the watch feature is unavailable. The frontend gracefully detects this and hides all watch-related UI.

### What Gets Watched

- Only files with the `.log` extension are monitored.
- Watching is non-recursive (top-level files in each configured directory).
- The server uses polling (1-second interval) for reliable cross-platform file change detection.
- File rotation is handled automatically. If a log file is truncated (rotated), the server resets its read offset and starts from the beginning of the new content.

### Live Streaming

Once you select a watched folder in the UI:

1. Historical log lines are fetched via HTTP (up to 10,000 lines by default).
2. A WebSocket connection opens and subscribes to that folder.
3. New lines written to any `.log` file in the folder are pushed to the browser in real time.
4. The connection includes a heartbeat and auto-reconnects with exponential backoff (up to 30 seconds) if interrupted.

### Follow Mode

While viewing a watched source, a **Follow** button appears in the header. When enabled, the log table auto-scrolls to the bottom as new entries arrive so you always see the latest output.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WATCH_PATHS` | No | JSON array of `{"name":"...","path":"..."}` objects defining folders to watch. When set, the API sidecar starts automatically and the frontend detects it at runtime. Omit to disable watching entirely. |
| `NEXT_PUBLIC_APP_VERSION` | No | Version string displayed in the app header. |

## Deployment

This project deploys to GitHub Pages via `.github/workflows/nextjs.yml` and is available at:

https://pinoctular.stayte.app
