'use client';

import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import {
  type SourcedLogEntry,
  type SortField,
  type SortDirection,
  getLevelName,
  formatTimestamp,
  formatFullTimestamp,
  LEVEL_BG_COLORS,
  LEVEL_COLORS,
  LEVEL_ROW_COLORS,
  CORE_FIELDS,
  getSourceColor,
} from '@/lib/log-types';
import { JsonSyntax } from '@/components/json-syntax';

interface LogTableProps {
  logs: SourcedLogEntry[];
  allLogs: SourcedLogEntry[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  bookmarks: Set<string>;
  onToggleBookmark: (key: string) => void;
  showBookmarksOnly: boolean;
  contextLines: number;
  selectedRowKey: string | null;
  onSelectRow: (key: string | null) => void;
  sourceNames: string[];
  jumpToKey: string | null;
  onJumpHandled: () => void;
  autoScroll?: boolean;
  onUserScroll?: () => void;
}

function getEntryKey(entry: SourcedLogEntry): string {
  return entry.__key;
}

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (field !== sortField)
    return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />;
  return sortDirection === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-primary" />
  ) : (
    <ArrowDown className="h-3 w-3 text-primary" />
  );
}

function ExtraFields({ entry }: { entry: SourcedLogEntry }) {
  const extras = Object.entries(entry).filter(
    ([key]) =>
      !(CORE_FIELDS as readonly string[]).includes(key) && !key.startsWith('__')
  );
  if (extras.length === 0) return null;

  return (
    <div className="font-mono text-xs text-muted-foreground">
      {extras.map(([key, value]) => (
        <div key={key} className="flex gap-2 py-0.5">
          <span className="text-primary/70 shrink-0">{key}:</span>
          <span className="text-foreground/80 break-all whitespace-pre-wrap">
            {typeof value === 'object'
              ? JSON.stringify(value, null, 2)
              : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const LogRow = memo(function LogRow({
  entry,
  index,
  isSelected,
  isBookmarked,
  isContext,
  entryKey,
  onSelectRow,
  onToggleBookmark,
  showSource,
  sourceColorClass,
  virtualIndex,
  measureRef,
  showGroupSeparator,
}: {
  entry: SourcedLogEntry;
  index: number;
  isSelected: boolean;
  isBookmarked: boolean;
  isContext: boolean;
  entryKey: string;
  onSelectRow: (key: string) => void;
  onToggleBookmark: (key: string) => void;
  showSource: boolean;
  sourceColorClass: string;
  virtualIndex: number;
  measureRef: (node: HTMLTableSectionElement | null) => void;
  showGroupSeparator: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const level = getLevelName(entry.level);
  const rowRef = useRef<HTMLTableRowElement>(null);

  const extraCount = Object.keys(entry).filter(
    (k) =>
      !(CORE_FIELDS as readonly string[]).includes(k) && !k.startsWith('__')
  ).length;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = { ...entry } as Record<string, unknown>;
    delete clean.__source;
    delete clean.__sourceIndex;
    delete clean.__key;
    delete clean.__searchText;
    navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <tbody ref={measureRef} data-index={virtualIndex}>
      {showGroupSeparator && (
        <tr className="h-8 bg-background" aria-hidden="true">
          <td colSpan={99}>
            <div className="flex items-center gap-3 px-4">
              <div className="flex-1 border-t-2 border-border" />
              <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest select-none">&#xb7;&#xb7;&#xb7;</span>
              <div className="flex-1 border-t-2 border-border" />
            </div>
          </td>
        </tr>
      )}
      <tr
        ref={rowRef}
        className={`group border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors ${
          LEVEL_ROW_COLORS[level]
        } ${isSelected ? 'ring-1 ring-primary/40 bg-primary/5' : ''} ${
          isContext ? 'opacity-50' : ''
        } ${isBookmarked ? 'border-l-2 border-l-primary' : ''}`}
        onClick={() => {
          onSelectRow(entryKey);
          setExpanded(!expanded);
        }}
        role="row"
        aria-expanded={expanded}
        data-entry-key={entryKey}
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

        {/* Bookmark */}
        <td className="px-0.5 py-1.5 w-6">
          <button
            className={`transition-opacity ${
              isBookmarked
                ? 'text-primary opacity-100'
                : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(entryKey);
            }}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-3 w-3" />
            ) : (
              <Bookmark className="h-3 w-3" />
            )}
          </button>
        </td>

        {/* Line number */}
        <td className="pr-3 py-1.5 text-right w-10">
          <span className="text-[10px] tabular-nums text-muted-foreground/40 font-mono">
            {index + 1}
          </span>
        </td>

        {/* Timestamp */}
        <td className="px-2 py-1.5 whitespace-nowrap">
          <span
            className="text-xs tabular-nums text-muted-foreground font-mono"
            title={formatFullTimestamp(entry.time)}
          >
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

        {/* Source (only when multiple sources) */}
        {showSource && (
          <td className="px-2 py-1.5 w-24">
            <span
              className={`text-[10px] font-mono truncate ${sourceColorClass}`}
            >
              {entry.__source}
            </span>
          </td>
        )}

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
            <span
              className={`text-xs font-mono ${LEVEL_COLORS[level]} leading-relaxed`}
            >
              {entry.msg || '—'}
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
            {copied ? (
              <Check className="h-3 w-3 text-log-info" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={`border-b border-border/50 ${LEVEL_ROW_COLORS[level]}`}>
          <td
            colSpan={showSource ? 9 : 8}
            className="px-4 py-3 bg-secondary/30"
          >
            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              <div className="flex flex-col gap-1 text-xs font-mono">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">time:</span>
                  <span className="text-foreground">
                    {formatFullTimestamp(entry.time)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">level:</span>
                  <span className={LEVEL_COLORS[level]}>
                    {entry.level} ({level})
                  </span>
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
                    <span className="text-foreground">
                      {entry.hostname as string}
                    </span>
                  </div>
                )}
                {entry.module && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">module:</span>
                    <span className="text-primary/80">
                      {entry.module as string}
                    </span>
                  </div>
                )}
                {entry.msg && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">msg:</span>
                    <span className="text-foreground">{entry.msg}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-muted-foreground">source:</span>
                  <span className="text-foreground">{entry.__source}</span>
                </div>
              </div>
            </div>

            {/* Extra fields */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <ExtraFields entry={entry} />
            </div>

            {/* Raw JSON with syntax highlighting */}
            <details className="mt-3">
              <summary className="text-[10px] text-muted-foreground/60 uppercase tracking-wider cursor-pointer hover:text-muted-foreground">
                Raw JSON
              </summary>
              <div className="mt-2">
                <JsonSyntax
                  data={(() => {
                    const clean = { ...entry } as Record<string, unknown>;
                    delete clean.__source;
                    delete clean.__sourceIndex;
                    delete clean.__key;
                    delete clean.__searchText;
                    return clean;
                  })()}
                />
              </div>
            </details>
          </td>
        </tr>
      )}
    </tbody>
  );
});

export const LogTable = memo(function LogTable({
  logs,
  allLogs,
  sortField,
  sortDirection,
  onSort,
  bookmarks,
  onToggleBookmark,
  showBookmarksOnly,
  contextLines,
  selectedRowKey,
  onSelectRow,
  sourceNames,
  jumpToKey,
  onJumpHandled,
  autoScroll,
  onUserScroll,
}: LogTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const showSource = sourceNames.length > 1;

  const sourceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sourceNames.forEach((sourceName, index) => {
      map.set(sourceName, getSourceColor(index));
    });
    return map;
  }, [sourceNames]);

  // Build display list with context lines
  const displayLogs = useMemo(() => {
    if (!showBookmarksOnly && contextLines === 0) return logs;

    if (showBookmarksOnly) {
      return logs.filter((entry) => bookmarks.has(getEntryKey(entry)));
    }

    // Context lines: for each log in filtered set, also show N surrounding lines from allLogs
    if (contextLines > 0) {
      const filteredKeys = new Set(logs.map(getEntryKey));
      const contextKeys = new Set<string>();

      const sourceIndexMap = new Map<string, SourcedLogEntry[]>();
      const positionByKey = new Map<string, number>();

      for (const entry of allLogs) {
        const sourceEntries = sourceIndexMap.get(entry.__source);
        if (sourceEntries) {
          positionByKey.set(entry.__key, sourceEntries.length);
          sourceEntries.push(entry);
        } else {
          sourceIndexMap.set(entry.__source, [entry]);
          positionByKey.set(entry.__key, 0);
        }
      }

      for (const entry of logs) {
        const sourceEntries = sourceIndexMap.get(entry.__source);
        const idx = positionByKey.get(entry.__key);
        if (!sourceEntries || idx === undefined) continue;

        const start = Math.max(0, idx - contextLines);
        const end = Math.min(sourceEntries.length - 1, idx + contextLines);

        for (let i = start; i <= end; i++) {
          contextKeys.add(sourceEntries[i].__key);
        }
      }

      return allLogs.filter(
        (entry) => filteredKeys.has(entry.__key) || contextKeys.has(entry.__key)
      );
    }

    return logs;
  }, [logs, allLogs, showBookmarksOnly, bookmarks, contextLines]);

  const filteredKeys = useMemo(() => new Set(logs.map(getEntryKey)), [logs]);

  // Indices in displayLogs where a new context group starts (gap between entries)
  const groupSeparators = useMemo(() => {
    if (contextLines === 0) return new Set<number>();
    const separators = new Set<number>();
    for (let i = 1; i < displayLogs.length; i++) {
      const prev = displayLogs[i - 1];
      const curr = displayLogs[i];
      // Gap if different source or non-consecutive index within same source
      if (
        prev.__source !== curr.__source ||
        curr.__sourceIndex !== prev.__sourceIndex + 1
      ) {
        separators.add(i);
      }
    }
    return separators;
  }, [displayLogs, contextLines]);

  const virtualizer = useVirtualizer({
    count: displayLogs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 30,
  });

  // Scroll to selected row (keyboard navigation)
  useEffect(() => {
    if (selectedRowKey) {
      const idx = displayLogs.findIndex(
        (e) => getEntryKey(e) === selectedRowKey
      );
      if (idx !== -1) {
        virtualizer.scrollToIndex(idx, { align: 'auto' });
      }
    }
  }, [selectedRowKey, displayLogs, virtualizer]);

  // Handle jump-to
  useEffect(() => {
    if (jumpToKey) {
      const idx = displayLogs.findIndex((e) => getEntryKey(e) === jumpToKey);
      if (idx !== -1) {
        virtualizer.scrollToIndex(idx, { align: 'center' });
        onSelectRow(jumpToKey);
      }
      onJumpHandled();
    }
  }, [jumpToKey, displayLogs, virtualizer, onJumpHandled, onSelectRow]);

  // Auto-scroll to bottom when streaming
  const prevLogCountRef = useRef(displayLogs.length);
  useEffect(() => {
    if (autoScroll && displayLogs.length > prevLogCountRef.current) {
      virtualizer.scrollToIndex(displayLogs.length - 1, { align: 'end' });
    }
    prevLogCountRef.current = displayLogs.length;
  }, [autoScroll, displayLogs.length, virtualizer]);

  // Detect user scroll-up to disable auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onUserScroll) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!autoScroll) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom > 100) {
          onUserScroll();
        }
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [autoScroll, onUserScroll]);

  if (displayLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No matching log entries</p>
        <p className="text-xs mt-1">
          {showBookmarksOnly
            ? 'No bookmarked entries. Press B to bookmark a row.'
            : 'Try adjusting your filters or search query'}
        </p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <div className="overflow-auto flex-1" ref={scrollRef}>
      <table className="w-full text-left" role="table">
        <thead className="sticky top-0 z-10 bg-card border-b border-border">
          <tr>
            <th className="pl-3 pr-1 py-2 w-6" />
            <th className="px-0.5 py-2 w-6" />
            <th className="pr-3 py-2 w-10">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                #
              </span>
            </th>
            <th className="px-2 py-2">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort('time')}
              >
                Time{' '}
                <SortIcon
                  field="time"
                  sortField={sortField}
                  sortDirection={sortDirection}
                />
              </button>
            </th>
            <th className="px-2 py-2 w-16">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort('level')}
              >
                Level{' '}
                <SortIcon
                  field="level"
                  sortField={sortField}
                  sortDirection={sortDirection}
                />
              </button>
            </th>
            {showSource && (
              <th className="px-2 py-2 w-24">
                <button
                  className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                  onClick={() => onSort('source')}
                >
                  Source{' '}
                  <SortIcon
                    field="source"
                    sortField={sortField}
                    sortDirection={sortDirection}
                  />
                </button>
              </th>
            )}
            <th className="px-2 py-2 w-28">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort('module')}
              >
                Module{' '}
                <SortIcon
                  field="module"
                  sortField={sortField}
                  sortDirection={sortDirection}
                />
              </button>
            </th>
            <th className="px-2 py-2">
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                onClick={() => onSort('msg')}
              >
                Message{' '}
                <SortIcon
                  field="msg"
                  sortField={sortField}
                  sortDirection={sortDirection}
                />
              </button>
            </th>
            <th className="pr-3 py-2 w-8" />
          </tr>
        </thead>
        {paddingTop > 0 && (
          <tbody>
            <tr>
              <td style={{ height: paddingTop, padding: 0, border: 'none' }} />
            </tr>
          </tbody>
        )}
        {virtualItems.map((virtualRow) => {
          const entry = displayLogs[virtualRow.index];
          const key = getEntryKey(entry);
          const isContext = contextLines > 0 && !filteredKeys.has(key);
          const showSeparator = groupSeparators.has(virtualRow.index);
          return (
            <LogRow
              key={key}
              entry={entry}
              index={virtualRow.index}
              isSelected={selectedRowKey === key}
              isBookmarked={bookmarks.has(key)}
              isContext={isContext}
              entryKey={key}
              onSelectRow={onSelectRow}
              onToggleBookmark={onToggleBookmark}
              showSource={showSource}
              sourceColorClass={sourceColorMap.get(entry.__source) ?? getSourceColor(0)}
              virtualIndex={virtualRow.index}
              measureRef={virtualizer.measureElement}
              showGroupSeparator={showSeparator}
            />
          );
        })}
        {paddingBottom > 0 && (
          <tbody>
            <tr>
              <td
                style={{ height: paddingBottom, padding: 0, border: 'none' }}
              />
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
});
