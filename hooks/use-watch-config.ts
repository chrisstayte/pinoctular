'use client'

import { useState, useEffect } from 'react'
import { checkWatchAvailable, type WatchedFolder } from '@/lib/watch-api'

interface WatchConfig {
  available: boolean
  folders: WatchedFolder[]
  loading: boolean
}

export function useWatchConfig(): WatchConfig {
  const [state, setState] = useState<WatchConfig>({
    available: false,
    folders: [],
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    let retries = 0
    const maxRetries = 5

    const check = () => {
      checkWatchAvailable().then((result) => {
        if (cancelled) return
        if (result) {
          setState({
            available: true,
            folders: result.folders,
            loading: false,
          })
        } else if (retries < maxRetries) {
          // Server may not be ready yet — retry with backoff
          retries++
          setTimeout(check, retries * 1000)
        } else {
          setState({
            available: false,
            folders: [],
            loading: false,
          })
        }
      })
    }

    check()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
