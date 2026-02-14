"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown, Copy, Check } from "lucide-react"
import {
  type PinoLogEntry,
  type LogLevel,
  type SortField,
  type SortDirection,
  getLevelName,
  formatTimestamp,
  formatFullTimestamp,
  LEVEL_BG_COLORS,
  LEVEL_COLORS,
  LEVEL_ROW_COLORS,
  CORE_FIELDS,
} from "@/lib/log-types"

interface LogTableProps {
  logs: PinoLogEntry[]
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (field !== sortField) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />
  return sortDirection === "asc" ? (
    <ArrowUp className="h-3 w-3 text-primary" />
  ) : (
    <ArrowDown className="h-3 w-3 text-primary" />
  )
}

function ExtraFields({ entry }: { entry: PinoLogEntry }) {
  const extras = Object.entries(entry).filter(
    ([key]) => !(CORE_FIELDS as readonly string[]).includes(key)
  )
  if (extras.length === 0) return null

  return (
    <div className="font-mono text-xs text-muted-foreground">
      {extras.map(([key, value]) => (
        <div key={key} className="flex gap-2 py-0.5">
          <span className="text-primary/70 shrink-0">{key}:</span>
          <span className="text-foreground/80 break-all whitespace-pre-wrap">
            {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function LogRow({ entry, index }: { entry: PinoLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const level = getLevelName(entry.level)

  const extraCount = Object.keys(entry).filter(
    (key) => !(CORE_FIELDS as readonly string[]).includes(key)
  ).length

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <tr
        className={`group border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors ${LEVEL_ROW_COLORS[level]}`}
        onClick={() => setExpanded(!expanded)}
        role="row"
        aria-expanded={expanded}
      >
        {/* Expand icon */}
        <td className="pl-3 pr-1 py-1.5 w-6">
          {extraCount > 0 ? (
            expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            )
          ) : (
            <span className="inline-block w-3" />
          )}
        </td>

        {/* Line number */}
        <td className="pr-3 py-1.5 text-right w-10">
          <span className="text-[10px] tabular-nums text-muted-foreground/40 font-mono">
            {index + 1}
          </span>
        </td>

        {/* Timestamp */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <span className="text-xs tabular-nums text-muted-foreground font-mono" title={formatFullTimestamp(entry.time)}>
            {formatTimestamp(entry.time)}
          </span>
        </td>

        {/* Level */}
        <td className="px-2 py-1.5 w-16">
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider ${LEVEL_BG_COLORS[level]}`}
          >
            {level}
          </span>
        </td>

        {/* Module */}
        <td className="px-2 py-1.5 w-28">
          {entry.module && (
            <span className="text-xs text-primary/80 font-mono">
              {entry.module as string}
            </span>
          )}
        </td>

        {/* Message */}
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono ${LEVEL_COLORS[level]} leading-relaxed`}>
              {entry.msg || "—"}
            </span>
            {extraCount > 0 && (
              <span className="text-[10px] text-muted-foreground/40 bg-secondary rounded px-1 py-0 shrink-0">
                +{extraCount}
              </span>
            )}
          </div>
        </td>

        {/* Copy button */}
        <td className="pr-3 py-1.5 w-8">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            aria-label="Copy log entry as JSON"
          >
            {copied ? <Check className="h-3 w-3 text-log-info" /> : <Copy className="h-3 w-3" />}
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={`border-b border-border/50 ${LEVEL_ROW_COLORS[level]}`}>
          <td colSpan={7} className="px-4 py-3 bg-secondary/30">
            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              {/* Core fields */}
              <div className="flex flex-col gap-1 text-xs font-mono">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">time:</span>
                  <span className="text-foreground">{formatFullTimestamp(entry.time)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">level:</span>
                  <span className={LEVEL_COLORS[level]}>{entry.level} ({level})</span>
                </div>
                {entry.pid !== undefined && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">pid:</span>
                    <span className="text-foreground">{entry.pid}</span>
                  </div>
                )}
                {entry.hostname && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">hostname:</span>
                    <span className="text-foreground">{entry.hostname as string}</span>
                  </div>
                )}
                {entry.module && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">module:</span>
                    <span className="text-primary/80">{entry.module as string}</span>
                  </div>
                )}
                {entry.msg && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">msg:</span>
                    <span className="text-foreground">{entry.msg}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Extra fields */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <ExtraFields entry={entry} />
            </div>

            {/* Raw JSON */}
            <details className="mt-3">
              <summary className="text-[10px] text-muted-foreground/60 uppercase tracking-wider cursor-pointer hover:text-muted-foreground">
                Raw JSON
              </summary>
              <pre className="mt-2 p-3 rounded bg-background border border-border text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(entry, null, 2)}
              </pre>
            </details>
          </td>
        </tr>
      )}
    </>
  )
}

export function LogTable({ logs, sortField, sortDirection, onSort }: LogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No matching log entries</p>
        <p className="text-xs mt-1">Try adjusting your filters or search query</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="w-full text-left" role="table">
        <thead className="sticky top-0 z-10 bg-card border-b border-border">
          <tr>
            <th className="pl-3 pr-1 py-2 w-6" />
            <th className="pr-3 py-2 w-10">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">#</span>
            </th>
            <th className="px-2 py-2">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort("time")}
              >
                Time <SortIcon field="time" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="px-2 py-2 w-16">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort("level")}
              >
                Level <SortIcon field="level" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="px-2 py-2 w-28">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort("module")}
              >
                Module <SortIcon field="module" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="px-2 py-2">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort("msg")}
              >
                Message <SortIcon field="msg" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </th>
            <th className="pr-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {logs.map((entry, i) => (
            <LogRow key={`${entry.time}-${i}`} entry={entry} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
