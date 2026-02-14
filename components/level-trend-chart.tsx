"use client"

import { useMemo } from "react"
import {
  type SourcedLogEntry,
  type LogLevel,
  buildTimeline,
  formatTimestamp,
} from "@/lib/log-types"

interface LevelTrendChartProps {
  logs: SourcedLogEntry[]
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  fatal: "#c026d3",
  error: "#ef4444",
  warn: "#f59e0b",
  info: "#22c55e",
  debug: "#06b6d4",
  trace: "#6b7280",
}

export function LevelTrendChart({ logs }: LevelTrendChartProps) {
  const buckets = useMemo(() => buildTimeline(logs, 40), [logs])

  if (buckets.length <= 1) return null

  const levels: LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace"]
  const maxCount = Math.max(...buckets.flatMap((b) => levels.map((l) => b.counts[l])), 1)
  const height = 60
  const width = 100

  return (
    <div className="px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Level Trends</span>
        <div className="flex items-center gap-2">
          {levels.filter((l) => buckets.some((b) => b.counts[l] > 0)).map((level) => (
            <div key={level} className="flex items-center gap-1">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: LEVEL_COLORS[level] }}
              />
              <span className="text-[9px] text-muted-foreground">{level}</span>
            </div>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-16"
        preserveAspectRatio="none"
      >
        {levels.map((level) => {
          const points = buckets.map((bucket, i) => {
            const x = (i / (buckets.length - 1)) * width
            const y = height - (bucket.counts[level] / maxCount) * (height - 4) - 2
            return `${x},${y}`
          })

          const hasData = buckets.some((b) => b.counts[level] > 0)
          if (!hasData) return null

          return (
            <polyline
              key={level}
              points={points.join(" ")}
              fill="none"
              stroke={LEVEL_COLORS[level]}
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          )
        })}
      </svg>

      <div className="flex justify-between">
        <span className="text-[9px] text-muted-foreground font-mono">
          {formatTimestamp(buckets[0].startTime)}
        </span>
        <span className="text-[9px] text-muted-foreground font-mono">
          {formatTimestamp(buckets[buckets.length - 1].endTime)}
        </span>
      </div>
    </div>
  )
}
