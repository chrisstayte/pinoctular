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

## Deployment

This project deploys to GitHub Pages via `.github/workflows/nextjs.yml` and is available at:

https://pinoctular.stayte.app
