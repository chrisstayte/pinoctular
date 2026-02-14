'use client';

import { useState, useMemo, memo } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import {
  type SourcedLogEntry,
  type ErrorCluster,
  clusterErrors,
  formatTimestamp,
  getLevelName,
  LEVEL_COLORS,
} from '@/lib/log-types';

interface ErrorClustersProps {
  logs: SourcedLogEntry[];
  onJumpToEntry: (entry: SourcedLogEntry) => void;
}

export const ErrorClusters = memo(function ErrorClusters({
  logs,
  onJumpToEntry,
}: ErrorClustersProps) {
  const clusters = useMemo(() => clusterErrors(logs), [logs]);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  if (clusters.length === 0) return null;

  return (
    <div className="px-4 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-3.5 w-3.5 text-log-error" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Error Clusters
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({clusters.length} {clusters.length === 1 ? 'pattern' : 'patterns'})
        </span>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {clusters.slice(0, 20).map((cluster) => (
          <ClusterRow
            key={cluster.pattern}
            cluster={cluster}
            expanded={expandedCluster === cluster.pattern}
            onToggle={() =>
              setExpandedCluster(
                expandedCluster === cluster.pattern ? null : cluster.pattern
              )
            }
            onJumpToEntry={onJumpToEntry}
          />
        ))}
      </div>
    </div>
  );
});

function ClusterRow({
  cluster,
  expanded,
  onToggle,
  onJumpToEntry,
}: {
  cluster: ErrorCluster;
  expanded: boolean;
  onToggle: () => void;
  onJumpToEntry: (entry: SourcedLogEntry) => void;
}) {
  return (
    <div className="rounded border border-border/50 bg-secondary/20">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary/40 transition-colors"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-[11px] font-mono text-log-error truncate flex-1">
          {cluster.entries[0]?.msg || cluster.pattern}
        </span>
        <span className="text-[10px] font-semibold text-log-error bg-log-error/10 rounded px-1.5 py-0.5 shrink-0">
          {cluster.count}x
        </span>
        <span className="text-[9px] text-muted-foreground shrink-0">
          {formatTimestamp(cluster.firstSeen)} —{' '}
          {formatTimestamp(cluster.lastSeen)}
        </span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-0.5 border-t border-border/30 pt-1">
          {cluster.entries.slice(0, 10).map((entry, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-2 px-1 py-0.5 text-left rounded hover:bg-secondary/60 transition-colors"
              onClick={() => onJumpToEntry(entry)}
            >
              <span className="text-[9px] font-mono text-muted-foreground">
                {formatTimestamp(entry.time)}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground truncate">
                {entry.__source}
              </span>
              <span className="text-[10px] font-mono text-foreground/70 truncate flex-1">
                {entry.msg}
              </span>
            </button>
          ))}
          {cluster.entries.length > 10 && (
            <span className="text-[9px] text-muted-foreground px-1">
              ...and {cluster.entries.length - 10} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
