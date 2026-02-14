"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  type LogLevel,
  LEVEL_BG_COLORS,
  LEVEL_NUMBERS,
} from "@/lib/log-types"

const ALL_LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"]

interface LogToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  activeLevels: Set<LogLevel>
  onToggleLevel: (level: LogLevel) => void
  modules: string[]
  activeModules: Set<string>
  onToggleModule: (mod: string) => void
  filteredCount: number
  totalCount: number
}

export function LogToolbar({
  search,
  onSearchChange,
  activeLevels,
  onToggleLevel,
  modules,
  activeModules,
  onToggleModule,
  filteredCount,
  totalCount,
}: LogToolbarProps) {
  const allLevelsActive = activeLevels.size === ALL_LEVELS.length
  const allModulesActive = activeModules.size === modules.length

  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-card">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-8 text-sm bg-secondary border-border font-mono placeholder:font-sans"
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredCount === totalCount
            ? `${totalCount.toLocaleString()} logs`
            : `${filteredCount.toLocaleString()} / ${totalCount.toLocaleString()}`}
        </span>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">Level</span>
        {ALL_LEVELS.map((level) => {
          const active = activeLevels.has(level)
          return (
            <button
              key={level}
              onClick={() => onToggleLevel(level)}
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                active
                  ? LEVEL_BG_COLORS[level]
                  : "bg-transparent border-border text-muted-foreground/50 opacity-50"
              }`}
              aria-label={`${active ? "Hide" : "Show"} ${level} logs`}
            >
              {level}
            </button>
          )
        })}
        {!allLevelsActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] text-muted-foreground px-1.5"
            onClick={() => ALL_LEVELS.forEach((l) => { if (!activeLevels.has(l)) onToggleLevel(l) })}
          >
            Show all
          </Button>
        )}

        {modules.length > 1 && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">Module</span>
            {modules.map((mod) => {
              const active = activeModules.has(mod)
              return (
                <button
                  key={mod}
                  onClick={() => onToggleModule(mod)}
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                    active
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-transparent border-border text-muted-foreground/50 opacity-50"
                  }`}
                  aria-label={`${active ? "Hide" : "Show"} module ${mod}`}
                >
                  {mod}
                </button>
              )
            })}
            {!allModulesActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] text-muted-foreground px-1.5"
                onClick={() => modules.forEach((m) => { if (!activeModules.has(m)) onToggleModule(m) })}
              >
                Show all
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
