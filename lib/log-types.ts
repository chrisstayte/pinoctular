export interface PinoLogEntry {
  level: number
  time: number
  pid?: number
  hostname?: string
  msg?: string
  module?: string
  [key: string]: unknown
}

// Extended entry that tracks which source a log came from (multi-source support)
export interface SourcedLogEntry extends PinoLogEntry {
  __source: string
  __sourceIndex: number
  __key: string
  __searchText: string
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export const PINO_LEVELS: Record<number, LogLevel> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
}

export const LEVEL_NUMBERS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

export const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: 'text-log-trace',
  debug: 'text-log-debug',
  info: 'text-log-info',
  warn: 'text-log-warn',
  error: 'text-log-error',
  fatal: 'text-log-fatal',
}

export const LEVEL_BG_COLORS: Record<LogLevel, string> = {
  trace: 'bg-log-trace/10 text-log-trace border-log-trace/20',
  debug: 'bg-log-debug/10 text-log-debug border-log-debug/20',
  info: 'bg-log-info/10 text-log-info border-log-info/20',
  warn: 'bg-log-warn/10 text-log-warn border-log-warn/20',
  error: 'bg-log-error/10 text-log-error border-log-error/20',
  fatal: 'bg-log-fatal/10 text-log-fatal border-log-fatal/20',
}

export const LEVEL_ROW_COLORS: Record<LogLevel, string> = {
  trace: 'bg-log-trace/[0.03]',
  debug: 'bg-log-debug/[0.03]',
  info: 'bg-log-info/[0.03]',
  warn: 'bg-log-warn/[0.05]',
  error: 'bg-log-error/[0.07]',
  fatal: 'bg-log-fatal/[0.10]',
}

export const SOURCE_COLORS = [
  'text-blue-400',
  'text-emerald-400',
  'text-amber-400',
  'text-rose-400',
  'text-violet-400',
  'text-cyan-400',
  'text-orange-400',
  'text-pink-400',
] as const

export function getSourceColor(index: number): string {
  return SOURCE_COLORS[index % SOURCE_COLORS.length]
}

export function getLevelName(level: number): LogLevel {
  return PINO_LEVELS[level] || 'info'
}

export function formatTimestamp(time: number): string {
  const date = new Date(time)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

export function formatFullTimestamp(time: number): string {
  const date = new Date(time)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

export interface ParseLogDiagnostics {
  totalLines: number
  parsedLines: number
  skippedLines: number
  errors: string[]
}

export interface ParseLogsResult {
  entries: PinoLogEntry[]
  diagnostics: ParseLogDiagnostics
}

export function parseLogsDetailed(raw: string): ParseLogsResult {
  const lines = raw.split('\n').filter((line) => line.trim())
  const entries: PinoLogEntry[] = []
  const errors: string[] = []

  for (const [index, line] of lines.entries()) {
    try {
      const parsed = JSON.parse(line)
      if (typeof parsed === 'object' && parsed !== null && 'level' in parsed && 'time' in parsed) {
        entries.push(parsed as PinoLogEntry)
      } else if (errors.length < 5) {
        errors.push(`Line ${index + 1}: missing required fields (level/time)`)
      }
    } catch (error) {
      if (errors.length < 5) {
        const message = error instanceof Error ? error.message : 'Invalid JSON'
        errors.push(`Line ${index + 1}: ${message}`)
      }
    }
  }

  return {
    entries,
    diagnostics: {
      totalLines: lines.length,
      parsedLines: entries.length,
      skippedLines: lines.length - entries.length,
      errors,
    },
  }
}

export function parseLogs(raw: string): PinoLogEntry[] {
  return parseLogsDetailed(raw).entries
}

export type SortField = 'time' | 'level' | 'module' | 'msg' | 'source'
export type SortDirection = 'asc' | 'desc'

export const CORE_FIELDS = ['level', 'time', 'pid', 'hostname', 'msg', 'module'] as const

// ─── Multi-source helpers ────────────────────────────────────────────

export interface LogSource {
  name: string
  logs: PinoLogEntry[]
}

export function tagLogsWithSource(logs: PinoLogEntry[], source: string): SourcedLogEntry[] {
  return logs.map((entry, i) => ({
    ...entry,
    __source: source,
    __sourceIndex: i,
    __key: `${source}:${i}`,
    __searchText: JSON.stringify(entry).toLowerCase(),
  }))
}

// ─── Field filter helpers ────────────────────────────────────────────

export interface FieldFilter {
  id: string
  field: string
  operator: 'equals' | 'contains' | 'not_equals' | 'not_contains' | 'regex'
  value: string
}

export function matchesFieldFilter(entry: PinoLogEntry, filter: FieldFilter): boolean {
  const fieldValue = entry[filter.field]
  if (fieldValue === undefined) return filter.operator === 'not_equals' || filter.operator === 'not_contains'
  const strValue = typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue)
  const target = filter.value

  switch (filter.operator) {
    case 'equals':
      return strValue === target
    case 'not_equals':
      return strValue !== target
    case 'contains':
      return strValue.toLowerCase().includes(target.toLowerCase())
    case 'not_contains':
      return !strValue.toLowerCase().includes(target.toLowerCase())
    case 'regex':
      try {
        return new RegExp(target, 'i').test(strValue)
      } catch {
        return false
      }
    default:
      return true
  }
}

// ─── Error clustering ────────────────────────────────────────────────

export interface ErrorCluster {
  pattern: string
  count: number
  entries: SourcedLogEntry[]
  firstSeen: number
  lastSeen: number
}

function normalizeMessage(msg: string): string {
  return msg
    .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
    .replace(/\b\d{4,}\b/g, '<num>')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\/[\w\-/.]+/g, '<path>')
    .replace(/"[^"]{20,}"/g, '"<str>"')
}

export function clusterErrors(logs: SourcedLogEntry[]): ErrorCluster[] {
  const errors = logs.filter((e) => e.level >= 50 && e.msg)
  const map = new Map<string, ErrorCluster>()

  for (const entry of errors) {
    const pattern = normalizeMessage(entry.msg!)
    const existing = map.get(pattern)
    if (existing) {
      existing.count++
      existing.entries.push(entry)
      if (entry.time < existing.firstSeen) existing.firstSeen = entry.time
      if (entry.time > existing.lastSeen) existing.lastSeen = entry.time
    } else {
      map.set(pattern, {
        pattern,
        count: 1,
        entries: [entry],
        firstSeen: entry.time,
        lastSeen: entry.time,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

// ─── Request tracing ─────────────────────────────────────────────────

const TRACE_FIELDS = ['requestId', 'request_id', 'traceId', 'trace_id', 'correlationId', 'correlation_id', 'reqId', 'req_id', 'spanId', 'span_id'] as const

export function detectTraceField(logs: PinoLogEntry[]): string | null {
  const sample = logs.slice(0, 200)
  for (const field of TRACE_FIELDS) {
    const matchCount = sample.filter((e) => e[field] !== undefined).length
    if (matchCount > sample.length * 0.1) return field
  }
  for (const entry of sample) {
    if (typeof entry.req === 'object' && entry.req !== null && 'id' in (entry.req as Record<string, unknown>)) {
      return 'req.id'
    }
  }
  return null
}

export function getTraceValue(entry: PinoLogEntry, field: string): string | null {
  if (field === 'req.id') {
    const req = entry.req as Record<string, unknown> | undefined
    return req?.id != null ? String(req.id) : null
  }
  const val = entry[field]
  return val != null ? String(val) : null
}

export function groupByTrace(logs: SourcedLogEntry[], field: string): Map<string, SourcedLogEntry[]> {
  const groups = new Map<string, SourcedLogEntry[]>()
  for (const entry of logs) {
    const val = getTraceValue(entry, field)
    if (val) {
      const group = groups.get(val)
      if (group) group.push(entry)
      else groups.set(val, [entry])
    }
  }
  return groups
}

// ─── Timeline helpers ────────────────────────────────────────────────

export interface TimelineBucket {
  startTime: number
  endTime: number
  counts: Record<LogLevel, number>
  total: number
}

export function buildTimeline(logs: SourcedLogEntry[], bucketCount: number = 60): TimelineBucket[] {
  if (logs.length === 0) return []

  let minTime = logs[0].time
  let maxTime = logs[0].time
  for (let i = 1; i < logs.length; i++) {
    const time = logs[i].time
    if (time < minTime) minTime = time
    if (time > maxTime) maxTime = time
  }
  const range = maxTime - minTime
  if (range === 0) {
    const counts = { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 }
    for (const e of logs) counts[getLevelName(e.level)]++
    return [{ startTime: minTime, endTime: maxTime, counts, total: logs.length }]
  }

  const bucketSize = range / bucketCount
  const buckets: TimelineBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    startTime: minTime + i * bucketSize,
    endTime: minTime + (i + 1) * bucketSize,
    counts: { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 },
    total: 0,
  }))

  for (const entry of logs) {
    const idx = Math.min(Math.floor((entry.time - minTime) / bucketSize), bucketCount - 1)
    const level = getLevelName(entry.level)
    buckets[idx].counts[level]++
    buckets[idx].total++
  }

  return buckets
}

// ─── Diff helpers ────────────────────────────────────────────────────

export interface DiffResult {
  type: 'added' | 'removed' | 'common'
  entry: SourcedLogEntry
}

export function diffLogs(logsA: SourcedLogEntry[], logsB: SourcedLogEntry[]): DiffResult[] {
  const makeDiffKey = (entry: SourcedLogEntry): string => `${entry.level}|${entry.time}|${entry.msg ?? ''}`

  const setA = new Set(logsA.map(makeDiffKey))
  const setB = new Set(logsB.map(makeDiffKey))

  const results: DiffResult[] = []

  for (const entry of logsA) {
    const key = makeDiffKey(entry)
    results.push({ type: setB.has(key) ? 'common' : 'removed', entry })
  }
  for (const entry of logsB) {
    const key = makeDiffKey(entry)
    if (!setA.has(key)) {
      results.push({ type: 'added', entry })
    }
  }

  return results.sort((a, b) => a.entry.time - b.entry.time)
}

// ─── Export helpers ──────────────────────────────────────────────────

export function exportAsJSON(logs: PinoLogEntry[]): string {
  return logs.map((e) => {
    const clean = { ...e } as Record<string, unknown>
    delete clean.__source
    delete clean.__sourceIndex
    delete clean.__key
    delete clean.__searchText
    return JSON.stringify(clean)
  }).join('\n')
}

export function exportAsCSV(logs: PinoLogEntry[]): string {
  if (logs.length === 0) return ''

  const allKeys = new Set<string>()
  for (const entry of logs) {
    for (const key of Object.keys(entry)) {
      if (!key.startsWith('__')) allKeys.add(key)
    }
  }
  const headers = Array.from(allKeys)

  const escapeCSV = (val: unknown): string => {
    if (val === undefined || val === null) return ''
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = [headers.join(',')]
  for (const entry of logs) {
    rows.push(headers.map((h) => escapeCSV(entry[h])).join(','))
  }
  return rows.join('\n')
}
