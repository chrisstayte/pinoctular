import { watch, type FSWatcher } from 'chokidar'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { EventEmitter } from 'node:events'
import type { WatchPathConfig, WatchedFolder, WatchedFile } from './types.js'

export interface WatcherEvents {
  change: (folderName: string, filePath: string) => void
  add: (folderName: string, filePath: string) => void
  unlink: (folderName: string, filePath: string) => void
  'folders-updated': (folders: WatchedFolder[]) => void
}

export class FolderWatcher extends EventEmitter {
  private configs: WatchPathConfig[]
  private watchers: FSWatcher[] = []
  private folderMap = new Map<string, WatchedFolder>()

  constructor(configs: WatchPathConfig[]) {
    super()
    this.configs = configs
  }

  async start(): Promise<void> {
    for (const config of this.configs) {
      await this.watchFolder(config)
    }
    this.emitFolders()
  }

  private async watchFolder(config: WatchPathConfig): Promise<void> {
    const dirPath = config.path

    if (!fs.existsSync(dirPath)) {
      console.warn(`[watcher] Path does not exist: ${dirPath}`)
      return
    }

    this.folderMap.set(config.name, {
      name: config.name,
      path: config.path,
      files: this.scanFiles(dirPath),
    })

    const watcher = watch(path.join(dirPath, '*.log'), {
      persistent: true,
      usePolling: true,
      interval: 1000,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    })

    watcher.on('add', (filePath) => {
      this.updateFolder(config)
      this.emit('add', config.name, filePath)
      this.emitFolders()
    })

    watcher.on('change', (filePath) => {
      this.emit('change', config.name, filePath)
    })

    watcher.on('unlink', (filePath) => {
      this.updateFolder(config)
      this.emit('unlink', config.name, filePath)
      this.emitFolders()
    })

    watcher.on('error', (error) => {
      console.error(`[watcher] Error watching ${dirPath}:`, error.message)
    })

    this.watchers.push(watcher)
    console.log(`[watcher] Watching ${dirPath} as "${config.name}"`)
  }

  private scanFiles(dirPath: string): WatchedFile[] {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries
        .filter((e) => e.isFile() && e.name.endsWith('.log'))
        .map((e) => {
          const fullPath = path.join(dirPath, e.name)
          const stat = fs.statSync(fullPath)
          return {
            name: e.name,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  }

  private updateFolder(config: WatchPathConfig): void {
    this.folderMap.set(config.name, {
      name: config.name,
      path: config.path,
      files: this.scanFiles(config.path),
    })
  }

  private emitFolders(): void {
    this.emit('folders-updated', this.getFolders())
  }

  getFolders(): WatchedFolder[] {
    return Array.from(this.folderMap.values())
  }

  getFolderByName(name: string): WatchedFolder | undefined {
    return this.folderMap.get(name)
  }

  async stop(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.close()))
    this.watchers = []
  }
}
