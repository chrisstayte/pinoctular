# Pinoctular

A lightweight, browser-based viewer for [Pino](https://getpino.io/#/) JSON logs.

## Screenshots

### Upload / paste logs

![Upload screen](https://github.com/user-attachments/assets/200c1fbf-c317-4389-96b4-de822764dace)

### Loaded log explorer

![Loaded logs screen](https://github.com/user-attachments/assets/fabea5e4-2a7b-4156-8842-d832b9ee8934)

## Features

- Upload `.log`, `.txt`, `.json`, or `.ndjson` files
- Paste newline-delimited Pino JSON logs directly into the app
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

## Deployment

This project deploys to GitHub Pages via `.github/workflows/nextjs.yml` and is available at:

https://pinoctular.stayte.app
