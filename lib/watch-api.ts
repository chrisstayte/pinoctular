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

export async function checkWatchAvailable(): Promise<HealthResponse | null> {
  try {
    const res = await fetch('/api/watch/health')
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
  try {
    const params = new URLSearchParams({ folder: folderName, tail: String(tail) })
    if (file) params.set('file', file)
    const res = await fetch(`/api/watch/logs?${params}`)
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/stream`)

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
