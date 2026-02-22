import initSqlJs, { type Database } from 'sql.js'

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null

function getWasmUrl(): string {
  const basePath = process.env.NODE_ENV === 'production'
    ? (process.env.__NEXT_ROUTER_BASEPATH ?? '')
    : ''
  return `${window.location.origin}${basePath}/sql-wasm.wasm`
}

function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => getWasmUrl() })
  }
  return sqlPromise
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_index INTEGER NOT NULL,
    level INTEGER NOT NULL,
    time INTEGER NOT NULL,
    pid INTEGER,
    hostname TEXT,
    msg TEXT,
    module TEXT,
    raw_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
  CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time);
  CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
  CREATE INDEX IF NOT EXISTS idx_logs_module ON logs(module);
`

export interface SessionMeta {
  id: string
  name: string
  createdAt: number
  sourceCount: number
  logCount: number
}

export async function createSessionDb(data?: ArrayLike<number>): Promise<Database> {
  const SQL = await getSql()
  const db = data ? new SQL.Database(new Uint8Array(data)) : new SQL.Database()
  if (!data) {
    db.run(SCHEMA)
  }
  return db
}

export function insertLogs(
  db: Database,
  logs: import('@/lib/log-types').PinoLogEntry[],
  source: string
) {
  db.run('BEGIN TRANSACTION')
  const stmt = db.prepare(
    'INSERT INTO logs (source, source_index, level, time, pid, hostname, msg, module, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i]
    const raw = { ...entry }
    stmt.run([
      source,
      i,
      entry.level,
      entry.time,
      entry.pid ?? null,
      entry.hostname ?? null,
      entry.msg ?? null,
      (entry.module as string) ?? null,
      JSON.stringify(raw),
    ])
  }
  stmt.free()
  db.run('COMMIT')
}

export function removeSource(db: Database, source: string) {
  db.run('DELETE FROM logs WHERE source = ?', [source])
}

export function getSources(db: Database): string[] {
  const results = db.exec('SELECT DISTINCT source FROM logs ORDER BY source')
  if (results.length === 0) return []
  return results[0].values.map((row: unknown[]) => row[0] as string)
}

export function getLogCount(db: Database): number {
  const results = db.exec('SELECT COUNT(*) FROM logs')
  if (results.length === 0) return 0
  return results[0].values[0][0] as number
}

export function getSourceCount(db: Database): number {
  const results = db.exec('SELECT COUNT(DISTINCT source) FROM logs')
  if (results.length === 0) return 0
  return results[0].values[0][0] as number
}

export function queryAllLogs(db: Database): import('@/lib/log-types').PinoLogEntry[] {
  const results = db.exec('SELECT source, source_index, raw_json FROM logs ORDER BY time ASC')
  if (results.length === 0) return []
  return results[0].values.map((row: unknown[]) => {
    const parsed = JSON.parse(row[2] as string)
    return parsed
  })
}

export function queryLogSources(db: Database): { name: string; logs: import('@/lib/log-types').PinoLogEntry[] }[] {
  const sources = getSources(db)
  return sources.map((source) => {
    const results = db.exec('SELECT raw_json FROM logs WHERE source = ? ORDER BY source_index ASC', [source])
    const logs = results.length > 0
      ? results[0].values.map((row: unknown[]) => JSON.parse(row[0] as string))
      : []
    return { name: source, logs }
  })
}

export function exportDb(db: Database): Uint8Array {
  return db.export()
}
