import type { Database } from 'sql.js'
import type { PinoLogEntry, LogSource } from '@/lib/log-types'
import {
  createSessionDb,
  insertLogs,
  removeSource,
  queryLogSources,
  getLogCount,
  getSourceCount,
  exportDb,
} from './session-db'
import {
  saveSession,
  loadSession,
  deleteSession as deleteSessionFromStore,
  listSessions as listStoredSessions,
  getStorageEstimate,
  type SessionInfo,
} from './indexeddb-store'

export interface Session {
  id: string
  name: string
  createdAt: number
  db: Database
  active: boolean
}

export interface SessionSummary {
  id: string
  name: string
  createdAt: number
  logCount: number
  sourceCount: number
  active: boolean
}

export type { SessionInfo }

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private listeners: Set<() => void> = new Set()

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    for (const listener of this.listeners) {
      listener()
    }
  }

  async createSession(
    name: string,
    sources: { name: string; logs: PinoLogEntry[] }[]
  ): Promise<string> {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const db = await createSessionDb()
    for (const source of sources) {
      insertLogs(db, source.logs, source.name)
    }
    const session: Session = {
      id,
      name,
      createdAt: Date.now(),
      db,
      active: true,
    }
    this.sessions.set(id, session)
    await this.persistSession(session)
    this.notify()
    return id
  }

  async addSourceToSession(
    sessionId: string,
    sourceName: string,
    logs: PinoLogEntry[]
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    insertLogs(session.db, logs, sourceName)
    await this.persistSession(session)
    this.notify()
  }

  async removeSourceFromSession(
    sessionId: string,
    sourceName: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    removeSource(session.db, sourceName)
    await this.persistSession(session)
    this.notify()
  }

  async loadSessionFromStore(id: string): Promise<boolean> {
    if (this.sessions.has(id)) {
      const session = this.sessions.get(id)!
      session.active = true
      this.notify()
      return true
    }
    const stored = await loadSession(id)
    if (!stored) return false
    const db = await createSessionDb(stored.data)
    const session: Session = {
      id: stored.id,
      name: stored.name,
      createdAt: stored.createdAt,
      db,
      active: true,
    }
    this.sessions.set(id, session)
    this.notify()
    return true
  }

  deactivateSession(id: string) {
    const session = this.sessions.get(id)
    if (session) {
      session.active = false
      this.notify()
    }
  }

  activateSession(id: string) {
    const session = this.sessions.get(id)
    if (session) {
      session.active = true
      this.notify()
    }
  }

  async deleteSession(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (session) {
      session.db.close()
      this.sessions.delete(id)
    }
    await deleteSessionFromStore(id)
    this.notify()
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.active)
  }

  getAllLoadedSessions(): Session[] {
    return Array.from(this.sessions.values())
  }

  getSessionSummaries(): SessionSummary[] {
    return Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      logCount: getLogCount(session.db),
      sourceCount: getSourceCount(session.db),
      active: session.active,
    }))
  }

  getSessionSources(sessionId: string): LogSource[] {
    const session = this.sessions.get(sessionId)
    if (!session) return []
    return queryLogSources(session.db)
  }

  /** Get all sources across all active sessions */
  getActiveLogSources(): LogSource[] {
    const sources: LogSource[] = []
    for (const session of this.getActiveSessions()) {
      const sessionSources = queryLogSources(session.db)
      for (const source of sessionSources) {
        sources.push({
          name: `[${session.name}] ${source.name}`,
          logs: source.logs,
        })
      }
    }
    return sources
  }

  private async persistSession(session: Session): Promise<void> {
    const data = exportDb(session.db)
    await saveSession(session.id, session.name, data, session.createdAt)
  }

  async listStoredSessions(): Promise<SessionInfo[]> {
    return listStoredSessions()
  }

  async getStorageStats(): Promise<{
    sessions: SessionInfo[]
    totalUsage: number
    quota: number
    available: number
  }> {
    const [sessions, estimate] = await Promise.all([
      listStoredSessions(),
      getStorageEstimate(),
    ])
    const totalSessionSize = sessions.reduce((sum, s) => sum + s.sizeBytes, 0)
    return {
      sessions,
      totalUsage: estimate.usage,
      quota: estimate.quota,
      available: Math.max(0, estimate.quota - estimate.usage),
    }
  }

  destroy() {
    for (const session of this.sessions.values()) {
      session.db.close()
    }
    this.sessions.clear()
    this.listeners.clear()
  }
}

// Singleton instance
let instance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!instance) {
    instance = new SessionManager()
  }
  return instance
}
