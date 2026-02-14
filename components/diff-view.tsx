"use client"

import { useMemo } from "react"
import { Plus, Minus, Equal } from "lucide-react"
import {
  type SourcedLogEntry,
  type DiffResult,
  diffLogs,
  formatTimestamp,
  getLevelName,
  LEVEL_COLORS,
  LEVEL_BG_COLORS,
} from "@/lib/log-types"

interface DiffViewProps {
  sourceNames: string[]
  logsBySource: Map<string, SourcedLogEntry[]>
  sourceA: string
  sourceB: string
  onSourceAChange: (name: string) => void
  onSourceBChange: (name: string) => void
}

export function DiffView({
  sourceNames,
  logsBySource,
  sourceA,
  sourceB,
  onSourceAChange,
  onSourceBChange,
}: DiffViewProps) {
  const logsA = logsBySource.get(sourceA) || []
  const logsB = logsBySource.get(sourceB) || []
  const diff = useMemo(() => diffLogs(logsA, logsB), [logsA, logsB])

  const stats = useMemo(() => {
    const added = diff.filter((d) => d.type === "added").length
    const removed = diff.filter((d) => d.type === "removed").length
    const common = diff.filter((d) => d.type === "common").length
    return { added, removed, common }
  }, [diff])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Diff</span>
        <select
          className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
          value={sourceA}
          onChange={(e) => onSourceAChange(e.target.value)}
        >
          {sourceNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">vs</span>
        <select
          className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
          value={sourceB}
          onChange={(e) => onSourceBChange(e.target.value)}
        >
          {sourceNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3 ml-auto text-[10px]">
          <span className="flex items-center gap-1 text-red-400">
            <Minus className="h-3 w-3" />
            {stats.removed}
          </span>
          <span className="flex items-center gap-1 text-green-400">
            <Plus className="h-3 w-3" />
            {stats.added}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Equal className="h-3 w-3" />
            {stats.common}
          </span>
        </div>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-left" role="table">
          <thead className="sticky top-0 z-10 bg-card border-b border-border">
            <tr>
              <th className="px-2 py-1.5 w-6" />
              <th className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="px-2 py-1.5 w-16 text-[10px] text-muted-foreground uppercase tracking-wider">Level</th>
              <th className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">Source</th>
              <th className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">Message</th>
            </tr>
          </thead>
          <tbody>
            {diff.slice(0, 500).map((result, i) => (
              <DiffRow key={i} result={result} />
            ))}
          </tbody>
        </table>
        {diff.length > 500 && (
          <div className="text-center py-3 text-xs text-muted-foreground">
            Showing first 500 of {diff.length} entries
          </div>
        )}
      </div>
    </div>
  )
}

function DiffRow({ result }: { result: DiffResult }) {
  const { type, entry } = result
  const level = getLevelName(entry.level)

  const bgClass =
    type === "added"
      ? "bg-green-500/10"
      : type === "removed"
      ? "bg-red-500/10"
      : ""

  const iconClass =
    type === "added"
      ? "text-green-400"
      : type === "removed"
      ? "text-red-400"
      : "text-muted-foreground/30"

  return (
    <tr className={`border-b border-border/30 ${bgClass}`}>
      <td className="px-2 py-1">
        {type === "added" ? (
          <Plus className={`h-3 w-3 ${iconClass}`} />
        ) : type === "removed" ? (
          <Minus className={`h-3 w-3 ${iconClass}`} />
        ) : (
          <Equal className={`h-3 w-3 ${iconClass}`} />
        )}
      </td>
      <td className="px-2 py-1">
        <span className="text-xs tabular-nums text-muted-foreground font-mono">
          {formatTimestamp(entry.time)}
        </span>
      </td>
      <td className="px-2 py-1">
        <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider ${LEVEL_BG_COLORS[level]}`}>
          {level}
        </span>
      </td>
      <td className="px-2 py-1">
        <span className="text-[10px] text-muted-foreground font-mono">{entry.__source}</span>
      </td>
      <td className="px-2 py-1">
        <span className={`text-xs font-mono ${LEVEL_COLORS[level]}`}>
          {entry.msg || "—"}
        </span>
      </td>
    </tr>
  )
}
