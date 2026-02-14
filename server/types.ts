export interface WatchPathConfig {
  name: string
  path: string
}

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

// WebSocket messages from client
export type ClientMessage =
  | { type: 'subscribe'; folder: string }
  | { type: 'unsubscribe' }

// WebSocket messages from server
export type ServerMessage =
  | { type: 'log'; source: string; folder: string; lines: string[] }
  | { type: 'folders'; folders: WatchedFolder[] }
  | { type: 'error'; message: string }
  | { type: 'pong' }
