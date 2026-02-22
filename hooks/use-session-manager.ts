'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getSessionManager,
  type SessionSummary,
  type SessionInfo,
} from '@/lib/db/session-manager'
import type { PinoLogEntry, LogSource } from '@/lib/log-types'

export function useSessionManager() {
  const manager = useRef(getSessionManager()).current
  const [version, setVersion] = useState(0)

  useEffect(() => {
    return manager.subscribe(() => setVersion((v) => v + 1))
  }, [manager])

  const [storedSessions, setStoredSessions] = useState<SessionInfo[]>([])
  const [loadingStored, setLoadingStored] = useState(true)

  const refreshStoredSessions = useCallback(async () => {
    try {
      const sessions = await manager.listStoredSessions()
      setStoredSessions(sessions)
    } catch {
      // IndexedDB unavailable
    }
  }, [manager])

  useEffect(() => {
    setLoadingStored(true)
    refreshStoredSessions().finally(() => setLoadingStored(false))
  }, [refreshStoredSessions, version])

  const createSession = useCallback(
    async (name: string, sources: { name: string; logs: PinoLogEntry[] }[]) => {
      const id = await manager.createSession(name, sources)
      return id
    },
    [manager]
  )

  const addSource = useCallback(
    async (sessionId: string, sourceName: string, logs: PinoLogEntry[]) => {
      await manager.addSourceToSession(sessionId, sourceName, logs)
    },
    [manager]
  )

  const removeSource = useCallback(
    async (sessionId: string, sourceName: string) => {
      await manager.removeSourceFromSession(sessionId, sourceName)
    },
    [manager]
  )

  const loadSession = useCallback(
    async (id: string) => {
      await manager.loadSessionFromStore(id)
    },
    [manager]
  )

  const activateSession = useCallback(
    (id: string) => {
      manager.activateSession(id)
    },
    [manager]
  )

  const deactivateSession = useCallback(
    (id: string) => {
      manager.deactivateSession(id)
    },
    [manager]
  )

  const deleteSession = useCallback(
    async (id: string) => {
      await manager.deleteSession(id)
    },
    [manager]
  )

  const getActiveLogSources = useCallback((): LogSource[] => {
    return manager.getActiveLogSources()
  }, [manager])

  const summaries = manager.getSessionSummaries()
  const activeSessions = manager.getActiveSessions()

  return {
    summaries,
    storedSessions,
    loadingStored,
    activeSessions,
    createSession,
    addSource,
    removeSource,
    loadSession,
    activateSession,
    deactivateSession,
    deleteSession,
    getActiveLogSources,
    refreshStoredSessions,
    manager,
  }
}
