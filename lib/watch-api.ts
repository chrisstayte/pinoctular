export interface WatchedFile {
  name: string
  size: number
  modified: string
}

export interface WatchedFolder {
  name: string
  path: string
  files: WatchedFile[]
}

export interface HealthResponse {
  available: boolean
  folders: WatchedFolder[]
}

export interface LogsResponse {
  folder: string
  files: { source: string; lines: string[] }[]
}

export type StreamMessage =
  | { type: 'log'; source: string; folder: string; lines: string[] }
  | { type: 'folders'; folders: WatchedFolder[] }
  | { type: 'error'; message: string }
  | { type: 'pong' }

// Resolved API base URL — detected once, cached for the session.
// In Docker: nginx proxies /api/* to the sidecar, so same-origin works ('').
// In dev: the API server runs on port 3001, so we fall back to that.
// Not cached when unavailable — allows retry if the server starts late.
let _apiBase: string | undefined = undefined

async function getApiBase(): Promise<string | null> {
  if (_apiBase !== undefined) {
    return _apiBase
  }

  // Try same-origin first (Docker / production)
  try {
    const res = await fetch('/api/watch/health')
    if (res.ok) {
      _apiBase = ''
      return ''
    }
  } catch {
    // not available at same origin
  }

  // Try localhost:3001 (dev mode)
  try {
    const res = await fetch('http://localhost:3001/api/watch/health')
    if (res.ok) {
      _apiBase = 'http://localhost:3001'
      return _apiBase
    }
  } catch {
    // not available
  }

  // Don't cache failure — allow retry on next call
  return null
}

export async function checkWatchAvailable(): Promise<HealthResponse | null> {
  const base = await getApiBase()
  if (base === null) return null

  try {
    const res = await fetch(`${base}/api/watch/health`)
    if (!res.ok) return null
    return (await res.json()) as HealthResponse
  } catch {
    return null
  }
}

export async function fetchLogs(
  folderName: string,
  tail = 10000,
  file?: string
): Promise<LogsResponse | null> {
  const base = await getApiBase()
  if (base === null) return null

  try {
    const params = new URLSearchParams({ folder: folderName, tail: String(tail) })
    if (file) params.set('file', file)
    const res = await fetch(`${base}/api/watch/logs?${params}`)
    if (!res.ok) return null
    return (await res.json()) as LogsResponse
  } catch {
    return null
  }
}

export interface LogStream {
  subscribe: (folder: string) => void
  unsubscribe: () => void
  close: () => void
  onMessage: (handler: (msg: StreamMessage) => void) => void
  onClose: (handler: () => void) => void
  onError: (handler: (error: Event) => void) => void
}

export function createLogStream(): LogStream {
  let wsUrl: string
  if (_apiBase && _apiBase.startsWith('http')) {
    // Dev mode — API is on a different port
    const url = new URL(_apiBase)
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    wsUrl = `${protocol}//${url.host}/api/stream`
  } else {
    // Production — same origin via nginx proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    wsUrl = `${protocol}//${window.location.host}/api/stream`
  }
  const ws = new WebSocket(wsUrl)

  let messageHandler: ((msg: StreamMessage) => void) | null = null
  let closeHandler: (() => void) | null = null
  let errorHandler: ((error: Event) => void) | null = null

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as StreamMessage
      messageHandler?.(msg)
    } catch {
      // ignore invalid messages
    }
  }

  ws.onclose = () => {
    closeHandler?.()
  }

  ws.onerror = (error) => {
    errorHandler?.(error)
  }

  return {
    subscribe: (folder: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', folder }))
      } else {
        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({ type: 'subscribe', folder }))
        }, { once: true })
      }
    },
    unsubscribe: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe' }))
      }
    },
    close: () => {
      ws.close()
    },
    onMessage: (handler) => {
      messageHandler = handler
    },
    onClose: (handler) => {
      closeHandler = handler
    },
    onError: (handler) => {
      errorHandler = handler
    },
  }
}
