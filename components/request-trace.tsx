"use client"

import { useState, useMemo } from "react"
import { Search, ChevronDown, ChevronRight, Network } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  type SourcedLogEntry,
  groupByTrace,
  formatTimestamp,
  getLevelName,
  LEVEL_COLORS,
  LEVEL_BG_COLORS,
} from "@/lib/log-types"

interface RequestTraceProps {
  logs: SourcedLogEntry[]
  traceField: string
  onJumpToEntry: (entry: SourcedLogEntry) => void
}

export function RequestTrace({ logs, traceField, onJumpToEntry }: RequestTraceProps) {
  const [search, setSearch] = useState("")
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null)

  const groups = useMemo(() => groupByTrace(logs, traceField), [logs, traceField])

  const filteredGroups = useMemo(() => {
    const entries = Array.from(groups.entries())
      .map(([id, entries]) => ({
        id,
        entries: entries.sort((a, b) => a.time - b.time),
        hasError: entries.some((e) => e.level >= 50),
        duration: entries.length > 1 ? entries[entries.length - 1].time - entries[0].time : 0,
      }))
      .sort((a, b) => {
        // Errors first, then by recency
        if (a.hasError !== b.hasError) return a.hasError ? -1 : 1
        return b.entries[0].time - a.entries[0].time
      })

    if (!search) return entries
    const s = search.toLowerCase()
    return entries.filter(
      (g) =>
        g.id.toLowerCase().includes(s) ||
        g.entries.some((e) => e.msg?.toLowerCase().includes(s))
    )
  }, [groups, search])

  if (groups.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Network className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No trace data found</p>
        <p className="text-xs mt-1">Logs must contain a {traceField} field</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <Network className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Request Traces
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({groups.size} traces via {traceField})
        </span>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search traces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-6 text-xs bg-secondary border-border"
          />
        </div>
      </div>

      <div className="overflow-auto flex-1">
        {filteredGroups.slice(0, 100).map((group) => (
          <TraceGroup
            key={group.id}
            group={group}
            expanded={expandedTrace === group.id}
            onToggle={() =>
              setExpandedTrace(expandedTrace === group.id ? null : group.id)
            }
            onJumpToEntry={onJumpToEntry}
          />
        ))}
        {filteredGroups.length > 100 && (
          <div className="text-center py-3 text-xs text-muted-foreground">
            Showing first 100 of {filteredGroups.length} traces
          </div>
        )}
      </div>
    </div>
  )
}

function TraceGroup({
  group,
  expanded,
  onToggle,
  onJumpToEntry,
}: {
  group: {
    id: string
    entries: SourcedLogEntry[]
    hasError: boolean
    duration: number
  }
  expanded: boolean
  onToggle: () => void
  onJumpToEntry: (entry: SourcedLogEntry) => void
}) {
  return (
    <div className={`border-b border-border/50 ${group.hasError ? "bg-log-error/[0.03]" : ""}`}>
      <button
        className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-secondary/40 transition-colors"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className={`text-[11px] font-mono truncate ${group.hasError ? "text-log-error" : "text-foreground"}`}>
          {group.id}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0 bg-secondary rounded px-1.5 py-0.5">
          {group.entries.length} entries
        </span>
        {group.duration > 0 && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {group.duration < 1000
              ? `${group.duration}ms`
              : `${(group.duration / 1000).toFixed(1)}s`}
          </span>
        )}
        <span className="text-[9px] text-muted-foreground shrink-0 ml-auto">
          {formatTimestamp(group.entries[0].time)}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-2">
          <div className="border-l-2 border-primary/20 ml-1 pl-3 space-y-0.5">
            {group.entries.map((entry, i) => {
              const level = getLevelName(entry.level)
              return (
                <button
                  key={i}
                  className="w-full flex items-center gap-2 px-1 py-0.5 text-left rounded hover:bg-secondary/60 transition-colors"
                  onClick={() => onJumpToEntry(entry)}
                >
                  <span className="text-[9px] font-mono text-muted-foreground tabular-nums shrink-0">
                    {formatTimestamp(entry.time)}
                  </span>
                  <span className={`text-[9px] font-bold uppercase ${LEVEL_COLORS[level]} shrink-0`}>
                    {level.slice(0, 3)}
                  </span>
                  <span className="text-[10px] font-mono text-foreground/70 truncate flex-1">
                    {entry.msg || "—"}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 shrink-0">
                    {entry.__source}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
