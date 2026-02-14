"use client"

import { useState } from "react"
import {
  Search,
  X,
  Download,
  Filter,
  Plus,
  Trash2,
  Regex,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  type LogLevel,
  type FieldFilter,
  type SourcedLogEntry,
  LEVEL_BG_COLORS,
  exportAsJSON,
  exportAsCSV,
} from "@/lib/log-types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ALL_LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"]

interface LogToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  isRegex: boolean
  onRegexToggle: () => void
  regexError: string | null
  activeLevels: Set<LogLevel>
  onToggleLevel: (level: LogLevel) => void
  onSetAllLevels: (levels: LogLevel[]) => void
  modules: string[]
  activeModules: Set<string>
  onToggleModule: (mod: string) => void
  filteredCount: number
  totalCount: number
  // Field filters
  fieldFilters: FieldFilter[]
  onAddFieldFilter: (filter: FieldFilter) => void
  onRemoveFieldFilter: (id: string) => void
  availableFields: string[]
  // Export
  filteredLogs: SourcedLogEntry[]
  // Sources
  sourceNames: string[]
  activeSources: Set<string>
  onToggleSource: (name: string) => void
}

export function LogToolbar({
  search,
  onSearchChange,
  isRegex,
  onRegexToggle,
  regexError,
  activeLevels,
  onToggleLevel,
  onSetAllLevels,
  modules,
  activeModules,
  onToggleModule,
  filteredCount,
  totalCount,
  fieldFilters,
  onAddFieldFilter,
  onRemoveFieldFilter,
  availableFields,
  filteredLogs,
  sourceNames,
  activeSources,
  onToggleSource,
}: LogToolbarProps) {
  const allLevelsActive = activeLevels.size === ALL_LEVELS.length
  const allModulesActive = activeModules.size === modules.length

  const handleExport = (format: "json" | "csv") => {
    const content = format === "json" ? exportAsJSON(filteredLogs) : exportAsCSV(filteredLogs)
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `logs-export.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-card">
      {/* Search bar row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={isRegex ? "Regex pattern..." : "Search logs..."}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`pl-9 pr-16 h-8 text-sm bg-secondary border-border font-mono placeholder:font-sans ${
              regexError ? "border-log-error/50 focus-visible:ring-log-error/30" : ""
            }`}
            id="log-search-input"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              className={`p-0.5 rounded transition-colors ${
                isRegex
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground/40 hover:text-muted-foreground"
              }`}
              onClick={onRegexToggle}
              title="Toggle regex search"
            >
              <Regex className="h-3.5 w-3.5" />
            </button>
            {search && (
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {regexError && (
          <span className="text-[10px] text-log-error shrink-0">{regexError}</span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Download className="h-3 w-3" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("json")} className="text-xs">
              Export as JSON (NDJSON)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("csv")} className="text-xs">
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredCount === totalCount
            ? `${totalCount.toLocaleString()} logs`
            : `${filteredCount.toLocaleString()} / ${totalCount.toLocaleString()}`}
        </span>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">Level</span>
        <div className="flex items-center gap-0.5 mr-1">
          <Button
            variant="ghost"
            size="sm"
            className={`h-5 text-[10px] px-1.5 ${allLevelsActive ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => onSetAllLevels([...ALL_LEVELS])}
          >
            All
          </Button>
          <span className="text-muted-foreground/30 text-[10px]">/</span>
          <Button
            variant="ghost"
            size="sm"
            className={`h-5 text-[10px] px-1.5 ${activeLevels.size === 0 ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => onSetAllLevels([])}
          >
            None
          </Button>
        </div>
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

        {/* Source filters */}
        {sourceNames.length > 1 && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">Source</span>
            {sourceNames.map((name) => {
              const active = activeSources.has(name)
              return (
                <button
                  key={name}
                  onClick={() => onToggleSource(name)}
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                    active
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-transparent border-border text-muted-foreground/50 opacity-50"
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </>
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

      {/* Field filters row */}
      <FieldFilterRow
        filters={fieldFilters}
        onAdd={onAddFieldFilter}
        onRemove={onRemoveFieldFilter}
        availableFields={availableFields}
      />
    </div>
  )
}

function FieldFilterRow({
  filters,
  onAdd,
  onRemove,
  availableFields,
}: {
  filters: FieldFilter[]
  onAdd: (filter: FieldFilter) => void
  onRemove: (id: string) => void
  availableFields: string[]
}) {
  const [adding, setAdding] = useState(false)
  const [field, setField] = useState("")
  const [operator, setOperator] = useState<FieldFilter["operator"]>("contains")
  const [value, setValue] = useState("")

  const handleAdd = () => {
    if (!field || !value) return
    onAdd({
      id: `${field}-${operator}-${value}-${Date.now()}`,
      field,
      operator,
      value,
    })
    setField("")
    setValue("")
    setAdding(false)
  }

  if (filters.length === 0 && !adding) {
    return (
      <div className="flex items-center">
        <button
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setAdding(true)}
        >
          <Filter className="h-3 w-3" />
          Add field filter
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Filter className="h-3 w-3 text-muted-foreground shrink-0" />

      {filters.map((filter) => (
        <div
          key={filter.id}
          className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px]"
        >
          <span className="font-mono text-primary">{filter.field}</span>
          <span className="text-muted-foreground">
            {filter.operator === "equals" ? "=" : filter.operator === "not_equals" ? "!=" : filter.operator === "contains" ? "~" : filter.operator === "not_contains" ? "!~" : "re:"}
          </span>
          <span className="font-mono text-foreground">{filter.value}</span>
          <button
            className="text-muted-foreground hover:text-foreground ml-0.5"
            onClick={() => onRemove(filter.id)}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="inline-flex items-center gap-1">
          <select
            className="text-[10px] bg-secondary border border-border rounded px-1 py-0.5 text-foreground h-5"
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="">field</option>
            {availableFields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            className="text-[10px] bg-secondary border border-border rounded px-1 py-0.5 text-foreground h-5"
            value={operator}
            onChange={(e) => setOperator(e.target.value as FieldFilter["operator"])}
          >
            <option value="contains">contains</option>
            <option value="equals">equals</option>
            <option value="not_contains">not contains</option>
            <option value="not_equals">not equals</option>
            <option value="regex">regex</option>
          </select>
          <input
            type="text"
            className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground font-mono h-5 w-24"
            placeholder="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
              if (e.key === "Escape") { setAdding(false); setField(""); setValue("") }
            }}
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[10px]"
            onClick={handleAdd}
            disabled={!field || !value}
          >
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[10px] text-muted-foreground"
            onClick={() => { setAdding(false); setField(""); setValue("") }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-2.5 w-2.5" />
          Add
        </button>
      )}
    </div>
  )
}
