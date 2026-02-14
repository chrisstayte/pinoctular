import { WebSocketServer, WebSocket } from 'ws'
import type { Server as HttpServer } from 'node:http'
import * as path from 'node:path'
import type { FolderWatcher } from './watcher.js'
import type { ClientMessage, ServerMessage } from './types.js'
import { readNewLines, setFileOffset } from './tail.js'
import * as fs from 'node:fs'

interface ClientState {
  subscribedFolder: string | null
}

export function setupWebSocket(server: HttpServer, watcher: FolderWatcher): void {
  const wss = new WebSocketServer({ noServer: true })
  const clients = new Map<WebSocket, ClientState>()

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/api/stream') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws) => {
    const state: ClientState = { subscribedFolder: null }
    clients.set(ws, state)

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage

        if (msg.type === 'subscribe') {
          const folder = watcher.getFolderByName(msg.folder)
          if (!folder) {
            send(ws, { type: 'error', message: `Folder "${msg.folder}" not found` })
            return
          }

          state.subscribedFolder = msg.folder

          // Initialize tail offsets for all files in this folder to current end
          for (const file of folder.files) {
            const filePath = path.join(folder.path, file.name)
            try {
              const stat = fs.statSync(filePath)
              setFileOffset(filePath, stat.size)
            } catch {
              // file may have been removed
            }
          }
        }

        if (msg.type === 'unsubscribe') {
          state.subscribedFolder = null
        }
      } catch {
        send(ws, { type: 'error', message: 'Invalid message format' })
      }
    })

    ws.on('close', () => {
      clients.delete(ws)
    })

    ws.on('error', () => {
      clients.delete(ws)
    })

    // Send initial ping
    send(ws, { type: 'pong' })
  })

  // Forward file change events to subscribed clients
  watcher.on('change', (folderName: string, filePath: string) => {
    const lines = readNewLines(filePath)
    if (lines.length === 0) return

    const fileName = path.basename(filePath)

    for (const [ws, state] of clients) {
      if (state.subscribedFolder === folderName && ws.readyState === WebSocket.OPEN) {
        send(ws, {
          type: 'log',
          source: fileName,
          folder: folderName,
          lines,
        })
      }
    }
  })

  // Forward new file events
  watcher.on('add', (folderName: string, filePath: string) => {
    // Initialize offset for the new file
    try {
      const stat = fs.statSync(filePath)
      setFileOffset(filePath, stat.size)
    } catch {
      // ignore
    }
  })

  // Forward folder updates to all connected clients
  watcher.on('folders-updated', (folders) => {
    for (const [ws] of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        send(ws, { type: 'folders', folders })
      }
    }
  })

  // Heartbeat to detect stale connections
  const heartbeat = setInterval(() => {
    for (const [ws] of clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        clients.delete(ws)
        continue
      }
      ws.ping()
    }
  }, 30_000)

  wss.on('close', () => {
    clearInterval(heartbeat)
  })

  console.log('[websocket] WebSocket server ready at /api/stream')
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}
