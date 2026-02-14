import type { IncomingMessage, ServerResponse } from 'node:http'
import * as path from 'node:path'
import type { FolderWatcher } from './watcher.js'
import { readTailLines } from './tail.js'

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

function error(res: ServerResponse, message: string, status = 400): void {
  json(res, { error: message }, status)
}

export function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  watcher: FolderWatcher
): boolean {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const pathname = url.pathname

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return true
  }

  if (req.method !== 'GET') {
    error(res, 'Method not allowed', 405)
    return true
  }

  // GET /api/watch/health
  if (pathname === '/api/watch/health') {
    json(res, {
      available: true,
      folders: watcher.getFolders(),
    })
    return true
  }

  // GET /api/watch/logs?folder=<name>&tail=<n>&file=<filename>
  if (pathname === '/api/watch/logs') {
    const folderName = url.searchParams.get('folder')
    if (!folderName) {
      error(res, 'Missing "folder" query parameter')
      return true
    }

    const folder = watcher.getFolderByName(folderName)
    if (!folder) {
      error(res, `Folder "${folderName}" not found`, 404)
      return true
    }

    const tailCount = parseInt(url.searchParams.get('tail') ?? '10000', 10)
    const fileFilter = url.searchParams.get('file')

    const files = fileFilter
      ? folder.files.filter((f) => f.name === fileFilter)
      : folder.files

    if (files.length === 0) {
      json(res, { folder: folderName, files: [], lines: [] })
      return true
    }

    // Distribute tail lines across files
    const linesPerFile = Math.ceil(tailCount / files.length)
    const result: { source: string; lines: string[] }[] = []

    for (const file of files) {
      const filePath = path.join(folder.path, file.name)
      const lines = readTailLines(filePath, linesPerFile)
      result.push({ source: file.name, lines })
    }

    json(res, {
      folder: folderName,
      files: result,
    })
    return true
  }

  return false
}
