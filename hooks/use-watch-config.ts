'use client'

import { useState, useEffect } from 'react'
import { checkWatchAvailable, type WatchedFolder } from '@/lib/watch-api'

interface WatchConfig {
  available: boolean
  folders: WatchedFolder[]
  loading: boolean
}

const WATCH_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WATCH === 'true'

export function useWatchConfig(): WatchConfig {
  const [state, setState] = useState<WatchConfig>({
    available: false,
    folders: [],
    loading: WATCH_FEATURE_ENABLED,
  })

  useEffect(() => {
    if (!WATCH_FEATURE_ENABLED) {
      setState({
        available: false,
        folders: [],
        loading: false,
      })
      return
    }

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
