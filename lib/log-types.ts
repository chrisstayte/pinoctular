export interface PinoLogEntry {
  level: number
  time: number
  pid?: number
  hostname?: string
  msg?: string
  module?: string
  [key: string]: unknown
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

export function parseLogs(raw: string): PinoLogEntry[] {
  const lines = raw.split('\n').filter((line) => line.trim())
  const entries: PinoLogEntry[] = []

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      if (typeof parsed === 'object' && parsed !== null && 'level' in parsed && 'time' in parsed) {
        entries.push(parsed as PinoLogEntry)
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return entries
}

export type SortField = 'time' | 'level' | 'module' | 'msg'
export type SortDirection = 'asc' | 'desc'

export const CORE_FIELDS = ['level', 'time', 'pid', 'hostname', 'msg', 'module'] as const
