"use client"

import { useMemo } from "react"
import {
  type SourcedLogEntry,
  type LogLevel,
  buildTimeline,
  formatTimestamp,
  getLevelName,
} from "@/lib/log-types"

interface TimelineHistogramProps {
  logs: SourcedLogEntry[]
  timeRange: [number, number] | null
  onTimeRangeChange: (range: [number, number] | null) => void
}

const LEVEL_BAR_COLORS: Record<LogLevel, string> = {
  fatal: "#c026d3",
  error: "#ef4444",
  warn: "#f59e0b",
  info: "#22c55e",
  debug: "#06b6d4",
  trace: "#6b7280",
}

export function TimelineHistogram({ logs, timeRange, onTimeRangeChange }: TimelineHistogramProps) {
  const buckets = useMemo(() => buildTimeline(logs, 80), [logs])

  if (buckets.length <= 1) return null

  const maxTotal = Math.max(...buckets.map((b) => b.total), 1)
  const barWidth = 100 / buckets.length

  const handleBarClick = (index: number) => {
    const bucket = buckets[index]
    if (
      timeRange &&
      timeRange[0] === bucket.startTime &&
      timeRange[1] === bucket.endTime
    ) {
      onTimeRangeChange(null)
      return
    }
    onTimeRangeChange([bucket.startTime, bucket.endTime])
  }

  const handleRangeSelect = (startIdx: number, endIdx: number) => {
    const start = Math.min(startIdx, endIdx)
    const end = Math.max(startIdx, endIdx)
    onTimeRangeChange([buckets[start].startTime, buckets[end].endTime])
  }

  return (
    <div className="px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Timeline</span>
        <div className="flex items-center gap-3">
          {timeRange && (
            <button
              className="text-[10px] text-primary hover:text-primary/80 transition-colors"
              onClick={() => onTimeRangeChange(null)}
            >
              Clear range
            </button>
          )}
          <div className="flex items-center gap-2">
            {(["error", "warn", "info", "debug"] as LogLevel[]).map((level) => (
              <div key={level} className="flex items-center gap-1">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: LEVEL_BAR_COLORS[level] }}
                />
                <span className="text-[9px] text-muted-foreground">{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TimelineBars
        buckets={buckets}
        maxTotal={maxTotal}
        barWidth={barWidth}
        timeRange={timeRange}
        onBarClick={handleBarClick}
        onRangeSelect={handleRangeSelect}
      />

      <div className="flex justify-between mt-0.5">
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

function TimelineBars({
  buckets,
  maxTotal,
  barWidth,
  timeRange,
  onBarClick,
  onRangeSelect,
}: {
  buckets: ReturnType<typeof buildTimeline>
  maxTotal: number
  barWidth: number
  timeRange: [number, number] | null
  onBarClick: (index: number) => void
  onRangeSelect: (start: number, end: number) => void
}) {
  const levels: LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace"]

  return (
    <div className="relative h-12 flex items-end gap-px">
      {buckets.map((bucket, i) => {
        const heightPercent = (bucket.total / maxTotal) * 100
        const isInRange =
          timeRange &&
          bucket.startTime >= timeRange[0] &&
          bucket.endTime <= timeRange[1]
        const isOutOfRange = timeRange && !isInRange

        return (
          <div
            key={i}
            className={`relative cursor-pointer transition-opacity ${
              isOutOfRange ? "opacity-20" : "opacity-100"
            }`}
            style={{ width: `${barWidth}%`, height: "100%" }}
            onClick={() => onBarClick(i)}
            title={`${formatTimestamp(bucket.startTime)}: ${bucket.total} entries`}
          >
            <div className="absolute bottom-0 w-full flex flex-col-reverse">
              {levels.map((level) => {
                const count = bucket.counts[level]
                if (count === 0) return null
                const h = (count / maxTotal) * 100
                return (
                  <div
                    key={level}
                    className="w-full rounded-sm"
                    style={{
                      height: `${(h / 100) * 48}px`,
                      backgroundColor: LEVEL_BAR_COLORS[level],
                      minHeight: count > 0 ? "1px" : 0,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
