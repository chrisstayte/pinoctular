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

    checkWatchAvailable().then((result) => {
      if (cancelled) return
      if (result) {
        setState({
          available: true,
          folders: result.folders,
          loading: false,
        })
      } else {
        setState({
          available: false,
          folders: [],
          loading: false,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
