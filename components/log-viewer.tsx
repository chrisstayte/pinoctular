"use client"

import { useState, useMemo, useCallback } from "react"
import {
  type PinoLogEntry,
  type LogLevel,
  type SortField,
  type SortDirection,
  getLevelName,
} from "@/lib/log-types"
import { LogInput, LogSourceBadge } from "@/components/log-input"
import { LogToolbar } from "@/components/log-toolbar"
import { LogTable } from "@/components/log-table"
import { LogStats } from "@/components/log-stats"

export function LogViewer() {
  const [logs, setLogs] = useState<PinoLogEntry[]>([])
  const [source, setSource] = useState("")
  const [search, setSearch] = useState("")
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(
    new Set(["trace", "debug", "info", "warn", "error", "fatal"])
  )
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>("time")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Extract unique modules from logs
  const modules = useMemo(() => {
    const set = new Set<string>()
    for (const log of logs) {
      if (log.module) set.add(log.module as string)
    }
    return Array.from(set).sort()
  }, [logs])

  const handleLogsLoaded = useCallback(
    (newLogs: PinoLogEntry[], src: string) => {
      setLogs(newLogs)
      setSource(src)
      setSearch("")
      setActiveLevels(new Set(["trace", "debug", "info", "warn", "error", "fatal"]))
      // Initialize all modules as active
      const mods = new Set<string>()
      for (const log of newLogs) {
        if (log.module) mods.add(log.module as string)
      }
      setActiveModules(mods)
      setSortField("time")
      setSortDirection("asc")
    },
    []
  )

  const handleClear = useCallback(() => {
    setLogs([])
    setSource("")
    setSearch("")
  }, [])

  const toggleLevel = useCallback((level: LogLevel) => {
    setActiveLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }, [])

  const toggleModule = useCallback((mod: string) => {
    setActiveModules((prev) => {
      const next = new Set(prev)
      if (next.has(mod)) {
        next.delete(mod)
      } else {
        next.add(mod)
      }
      return next
    })
  }, [])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortDirection("asc")
      }
    },
    [sortField]
  )

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    const searchLower = search.toLowerCase()

    let result = logs.filter((entry) => {
      // Level filter
      const level = getLevelName(entry.level)
      if (!activeLevels.has(level)) return false

      // Module filter
      if (modules.length > 0) {
        const entryModule = (entry.module as string) || ""
        if (entryModule && !activeModules.has(entryModule)) return false
        if (!entryModule && activeModules.size < modules.length) {
          // Show entries without module only if not all modules are filtered out
        }
      }

      // Search filter
      if (searchLower) {
        const searchableText = JSON.stringify(entry).toLowerCase()
        if (!searchableText.includes(searchLower)) return false
      }

      return true
    })

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "time":
          cmp = a.time - b.time
          break
        case "level":
          cmp = a.level - b.level
          break
        case "module":
          cmp = ((a.module as string) || "").localeCompare((b.module as string) || "")
          break
        case "msg":
          cmp = (a.msg || "").localeCompare(b.msg || "")
          break
      }
      return sortDirection === "asc" ? cmp : -cmp
    })

    return result
  }, [logs, search, activeLevels, activeModules, modules, sortField, sortDirection])

  const hasLogs = logs.length > 0

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground font-mono">P</span>
            </div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Pino Log Viewer</h1>
            {process.env.NEXT_PUBLIC_APP_VERSION && (
              <span className="text-[10px] text-muted-foreground font-mono">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            )}
          </div>
          {hasLogs && (
            <>
              <div className="w-px h-4 bg-border" />
              <LogSourceBadge source={source} count={logs.length} onClear={handleClear} />
            </>
          )}
        </div>
        {hasLogs && (
          <div className="w-48">
            <LogStats logs={logs} />
          </div>
        )}
      </header>

      {/* Input screen or log viewer */}
      {!hasLogs ? (
        <LogInput onLogsLoaded={handleLogsLoaded} hasLogs={hasLogs} onClear={handleClear} />
      ) : (
        <>
          <LogToolbar
            search={search}
            onSearchChange={setSearch}
            activeLevels={activeLevels}
            onToggleLevel={toggleLevel}
            modules={modules}
            activeModules={activeModules}
            onToggleModule={toggleModule}
            filteredCount={filteredLogs.length}
            totalCount={logs.length}
          />
          <LogTable
            logs={filteredLogs}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </>
      )}
    </div>
  )
}
