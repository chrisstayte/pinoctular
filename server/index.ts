import { createServer } from 'node:http'
import type { WatchPathConfig } from './types.js'
import { FolderWatcher } from './watcher.js'
import { handleRequest } from './routes.js'
import { setupWebSocket } from './websocket.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const WATCH_PATHS_RAW = process.env.WATCH_PATHS ?? ''

function parseWatchPaths(raw: string): WatchPathConfig[] {
  if (!raw.trim()) {
    console.warn('[server] WATCH_PATHS is not set. No folders will be watched.')
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('WATCH_PATHS must be a JSON array')
    }

    return parsed.map((entry: unknown, i: number) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`WATCH_PATHS[${i}] must be an object`)
      }
      const obj = entry as Record<string, unknown>
      if (typeof obj.name !== 'string' || !obj.name.trim()) {
        throw new Error(`WATCH_PATHS[${i}].name must be a non-empty string`)
      }
      if (typeof obj.path !== 'string' || !obj.path.trim()) {
        throw new Error(`WATCH_PATHS[${i}].path must be a non-empty string`)
      }
      return { name: obj.name.trim(), path: obj.path.trim() }
    })
  } catch (error) {
    console.error('[server] Failed to parse WATCH_PATHS:', (error as Error).message)
    console.error('[server] Expected format: [{"name":"App 1","path":"/logs/app1"}]')
    process.exit(1)
  }
}

async function main(): Promise<void> {
  const configs = parseWatchPaths(WATCH_PATHS_RAW)

  const watcher = new FolderWatcher(configs)
  await watcher.start()

  const server = createServer((req, res) => {
    const handled = handleRequest(req, res, watcher)
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  setupWebSocket(server, watcher)

  server.listen(PORT, () => {
    console.log(`[server] Pinoctular API server running on port ${PORT}`)
    console.log(`[server] Watching ${configs.length} folder(s)`)
  })

  const shutdown = async () => {
    console.log('\n[server] Shutting down...')
    await watcher.stop()
    server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('[server] Fatal error:', error)
  process.exit(1)
})
