'use client'

import { useState, useEffect, useCallback } from 'react'
import { getStorageEstimate, type SessionInfo } from '@/lib/db/indexeddb-store'

export interface StorageStats {
  usage: number
  quota: number
  available: number
  usagePercent: number
  sessions: SessionInfo[]
  totalSessionSize: number
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function useStorageStats(sessions: SessionInfo[]) {
  const [stats, setStats] = useState<StorageStats>({
    usage: 0,
    quota: 0,
    available: 0,
    usagePercent: 0,
    sessions: [],
    totalSessionSize: 0,
  })

  const refresh = useCallback(async () => {
    try {
      const estimate = await getStorageEstimate()
      const totalSessionSize = sessions.reduce((sum, s) => sum + s.sizeBytes, 0)
      setStats({
        usage: estimate.usage,
        quota: estimate.quota,
        available: Math.max(0, estimate.quota - estimate.usage),
        usagePercent: estimate.quota > 0 ? (estimate.usage / estimate.quota) * 100 : 0,
        sessions,
        totalSessionSize,
      })
    } catch {
      // Storage API unavailable
    }
  }, [sessions])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { stats, refresh }
}
