'use client'

import {
  Database,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Clock,
  FileText,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SessionSummary } from '@/lib/db/session-manager'
import type { SessionInfo } from '@/lib/db/indexeddb-store'
import { formatBytes } from '@/hooks/use-storage-stats'

interface SessionManagerPanelProps {
  summaries: SessionSummary[]
  storedSessions: SessionInfo[]
  onActivate: (id: string) => void
  onDeactivate: (id: string) => void
  onDelete: (id: string) => void
  onLoad: (id: string) => void
}

export function SessionManagerPanel({
  summaries,
  storedSessions,
  onActivate,
  onDeactivate,
  onDelete,
  onLoad,
}: SessionManagerPanelProps) {
  // Find stored sessions that aren't loaded yet
  const loadedIds = new Set(summaries.map((s) => s.id))
  const unloaded = storedSessions.filter((s) => !loadedIds.has(s.id))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        <span className="uppercase tracking-wider font-medium">Sessions</span>
        <span className="ml-auto text-[10px]">
          {summaries.length} loaded
          {unloaded.length > 0 && `, ${unloaded.length} stored`}
        </span>
      </div>

      {summaries.length === 0 && unloaded.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          No sessions yet. Upload logs to create one.
        </p>
      )}

      {/* Loaded sessions */}
      {summaries.map((session) => {
        const stored = storedSessions.find((s) => s.id === session.id)
        return (
          <div
            key={session.id}
            className={`rounded-lg border p-3 space-y-2 transition-colors ${
              session.active
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-card/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Database
                  className={`h-3.5 w-3.5 shrink-0 ${
                    session.active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span className="text-xs font-medium truncate">
                  {session.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() =>
                    session.active
                      ? onDeactivate(session.id)
                      : onActivate(session.id)
                  }
                  title={session.active ? 'Deactivate session' : 'Activate session'}
                >
                  {session.active ? (
                    <Eye className="h-3 w-3 text-primary" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(session.id)}
                  title="Delete session"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {session.logCount.toLocaleString()} logs
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {session.sourceCount} {session.sourceCount === 1 ? 'source' : 'sources'}
              </span>
              {stored && (
                <span>{formatBytes(stored.sizeBytes)}</span>
              )}
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="h-3 w-3" />
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )
      })}

      {/* Unloaded stored sessions */}
      {unloaded.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
            <div className="flex-1 h-px bg-border" />
            <span className="uppercase tracking-wider">Stored</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {unloaded.map((session) => (
            <div
              key={session.id}
              className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">
                    {session.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => onLoad(session.id)}
                    title="Load session"
                  >
                    <Upload className="h-3 w-3" />
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(session.id)}
                    title="Delete session"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{formatBytes(session.sizeBytes)}</span>
                <span className="flex items-center gap-1 ml-auto">
                  <Clock className="h-3 w-3" />
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
