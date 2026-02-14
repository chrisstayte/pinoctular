'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createLogStream, type StreamMessage, type LogStream } from '@/lib/watch-api'

interface UseLogStreamOptions {
  folder: string | null
  enabled: boolean
  onNewLines: (source: string, lines: string[]) => void
}

interface UseLogStreamResult {
  isConnected: boolean
  error: string | null
}

export function useLogStream({ folder, enabled, onNewLines }: UseLogStreamOptions): UseLogStreamResult {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<LogStream | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef = useRef(0)
  const onNewLinesRef = useRef(onNewLines)
  onNewLinesRef.current = onNewLines

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (!enabled || !folder) {
      cleanup()
      return
    }

    const connect = () => {
      const stream = createLogStream()
      streamRef.current = stream

      stream.onMessage((msg: StreamMessage) => {
        if (msg.type === 'log') {
          onNewLinesRef.current(msg.source, msg.lines)
        } else if (msg.type === 'pong') {
          setIsConnected(true)
          setError(null)
          retriesRef.current = 0
          stream.subscribe(folder)
        } else if (msg.type === 'error') {
          setError(msg.message)
        }
      })

      stream.onClose(() => {
        setIsConnected(false)
        streamRef.current = null

        if (enabled && folder) {
          const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000)
          retriesRef.current++
          reconnectTimerRef.current = setTimeout(connect, delay)
        }
      })

      stream.onError(() => {
        setError('Connection error')
      })
    }

    connect()

    return cleanup
  }, [enabled, folder, cleanup])

  return { isConnected, error }
}
