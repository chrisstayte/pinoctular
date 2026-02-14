import * as fs from 'node:fs'

interface TailState {
  offset: number
}

const fileStates = new Map<string, TailState>()

export function getFileOffset(filePath: string): number | undefined {
  return fileStates.get(filePath)?.offset
}

export function setFileOffset(filePath: string, offset: number): void {
  fileStates.set(filePath, { offset })
}

export function readNewLines(filePath: string): string[] {
  try {
    const stat = fs.statSync(filePath)
    const state = fileStates.get(filePath)

    if (!state) {
      // First time seeing this file — set offset to current size (no initial read)
      fileStates.set(filePath, { offset: stat.size })
      return []
    }

    // File was truncated (rotated) — reset to beginning
    if (stat.size < state.offset) {
      state.offset = 0
    }

    if (stat.size === state.offset) {
      return []
    }

    const buffer = Buffer.alloc(stat.size - state.offset)
    const fd = fs.openSync(filePath, 'r')
    try {
      fs.readSync(fd, buffer, 0, buffer.length, state.offset)
    } finally {
      fs.closeSync(fd)
    }

    state.offset = stat.size

    const text = buffer.toString('utf-8')
    const lines = text.split('\n').filter((line) => line.trim().length > 0)
    return lines
  } catch (error) {
    console.error(`[tail] Error reading ${filePath}:`, (error as Error).message)
    return []
  }
}

export function readTailLines(filePath: string, maxLines: number): string[] {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size === 0) return []

    // Read the file in chunks from the end to find the last N lines
    const chunkSize = Math.min(stat.size, 1024 * 1024) // 1MB chunks
    let content = ''
    let position = stat.size
    let lines: string[] = []

    const fd = fs.openSync(filePath, 'r')
    try {
      while (position > 0 && lines.length <= maxLines) {
        const readSize = Math.min(chunkSize, position)
        position -= readSize
        const buffer = Buffer.alloc(readSize)
        fs.readSync(fd, buffer, 0, readSize, position)
        content = buffer.toString('utf-8') + content
        lines = content.split('\n').filter((line) => line.trim().length > 0)
      }
    } finally {
      fs.closeSync(fd)
    }

    // Take only the last maxLines
    if (lines.length > maxLines) {
      lines = lines.slice(lines.length - maxLines)
    }

    // Set the offset to end of file so streaming picks up from here
    fileStates.set(filePath, { offset: stat.size })

    return lines
  } catch (error) {
    console.error(`[tail] Error reading tail of ${filePath}:`, (error as Error).message)
    return []
  }
}
