'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  type PinoLogEntry,
  type SourcedLogEntry,
  type LogLevel,
  type SortField,
  type SortDirection,
  type FieldFilter,
  type LogSource,
  type ParseLogDiagnostics,
  type TableColumn,
  LEVEL_BG_COLORS,
  getLevelName,
  tagLogsWithSource,
  matchesFieldFilter,
  detectTraceField,
  exportAsJSON,
  DEFAULT_VISIBLE_COLUMNS,
} from '@/lib/log-types';

const ALL_LEVELS: LogLevel[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];
import {
  LogInput,
  LogSourceBadge,
  AddSourceButton,
} from '@/components/log-input';
import { LogToolbar } from '@/components/log-toolbar';
import { LogTable } from '@/components/log-table';
import { LogStats } from '@/components/log-stats';
import { ThemeToggle } from '@/components/theme-toggle';
import { TimelineHistogram } from '@/components/timeline-histogram';
import { LevelTrendChart } from '@/components/level-trend-chart';
import { ErrorClusters } from '@/components/error-clusters';
import { DiffView } from '@/components/diff-view';
import { RequestTrace } from '@/components/request-trace';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { StreamControls } from '@/components/stream-controls';
import { ColumnToggle } from '@/components/column-toggle';
import { useWatchConfig } from '@/hooks/use-watch-config';
import { useLogStream } from '@/hooks/use-log-stream';
import { fetchLogs, type WatchedFolder } from '@/lib/watch-api';
import { parseLogsDetailed } from '@/lib/log-types';
import { useSessionManager } from '@/hooks/use-session-manager';
import { useStorageStats } from '@/hooks/use-storage-stats';
import { SessionManagerPanel } from '@/components/session-manager-panel';
import { StorageIndicator } from '@/components/storage-indicator';
import {
  Bookmark,
  BookmarkCheck,
  BarChart3,
  GitCompare,
  Network,
  Keyboard,
  List,
  AlertTriangle,
  TrendingUp,
  Settings2,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

type ViewMode = 'table' | 'diff' | 'trace';
type PanelToggle = 'timeline' | 'trends' | 'errors';

const DEFAULT_LEVELS: LogLevel[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

export function LogViewer() {
  // ─── Session management ─────────────────────────────────────────
  const sessionMgr = useSessionManager();
  const { stats: storageStats, refresh: refreshStorage } = useStorageStats(sessionMgr.storedSessions);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ─── Sources state ───────────────────────────────────────────────
  const [sources, setSources] = useState<LogSource[]>([]);

  // ─── Merged log entries with source tags ─────────────────────────
  const allLogs = useMemo<SourcedLogEntry[]>(() => {
    return sources.flatMap((src) => tagLogsWithSource(src.logs, src.name));
  }, [sources]);

  const sourceNames = useMemo(() => sources.map((s) => s.name), [sources]);

  // ─── Filter / search state ──────────────────────────────────────
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 150);
  const [isRegex, setIsRegex] = useState(false);
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(
    new Set(DEFAULT_LEVELS)
  );
  const [activeModules, setActiveModules] = useState<Set<string>>(() => {
    const mods = new Set<string>();
    for (const src of sources) {
      for (const log of src.logs) {
        if (log.module) mods.add(log.module as string);
      }
    }
    return mods;
  });
  const [activeSources, setActiveSources] = useState<Set<string>>(
    () => new Set(sources.map((s) => s.name))
  );
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>([]);
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);

  // ─── Sort state ─────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // ─── UI state ───────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [contextLines, setContextLines] = useState(0);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [jumpToKey, setJumpToKey] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [panels, setPanels] = useState<Set<PanelToggle>>(new Set(['timeline']));
  const [visibleColumns, setVisibleColumns] = useState<Set<TableColumn>>(
    () => new Set(DEFAULT_VISIBLE_COLUMNS)
  );
  const [parseDiagnostics, setParseDiagnostics] = useState<
    Record<string, ParseLogDiagnostics>
  >({});

  // ─── Watch / streaming state ──────────────────────────────────
  const watchConfig = useWatchConfig();
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeWatchFolder, setActiveWatchFolder] = useState<string | null>(null);
  const knownFilesRef = useRef<Set<string>>(new Set());

  const handleNewStreamLines = useCallback(
    (source: string, lines: string[]) => {
      const { entries } = parseLogsDetailed(lines.join('\n'));
      if (entries.length === 0) return;
      setSources((prev) => {
        // Find existing source matching the watched file
        const watchSourceName = `watch:${activeWatchFolder}`;
        const idx = prev.findIndex((s) => s.name === watchSourceName);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            logs: [...updated[idx].logs, ...entries],
          };
          return updated;
        }
        return prev;
      });
    },
    [activeWatchFolder]
  );

  const handleFoldersUpdated = useCallback(
    async (folders: import('@/lib/watch-api').WatchedFolder[]) => {
      if (!activeWatchFolder) return;
      const folder = folders.find((f) => f.name === activeWatchFolder);
      if (!folder) return;

      const currentFiles = new Set(folder.files.map((f) => f.name));
      const removedFiles = [...knownFilesRef.current].filter((f) => !currentFiles.has(f));
      const newFiles = folder.files.filter((f) => !knownFilesRef.current.has(f.name));

      if (newFiles.length === 0 && removedFiles.length === 0) return;

      if (removedFiles.length > 0) {
        // Files were removed — re-fetch all logs for the folder since
        // entries aren't tagged by source file
        knownFilesRef.current = currentFiles;
        const result = await fetchLogs(activeWatchFolder, 10000);
        if (!result) return;
        const allEntries: PinoLogEntry[] = [];
        for (const file of result.files) {
          const { entries } = parseLogsDetailed(file.lines.join('\n'));
          allEntries.push(...entries);
        }
        const sourceName = `watch:${activeWatchFolder}`;
        setSources((prev) => {
          const idx = prev.findIndex((s) => s.name === sourceName);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], logs: allEntries };
            return updated;
          }
          return prev;
        });
        return;
      }

      // Only new files — fetch just those
      for (const f of newFiles) {
        knownFilesRef.current.add(f.name);
      }
      for (const file of newFiles) {
        const result = await fetchLogs(activeWatchFolder, 10000, file.name);
        if (!result) continue;
        for (const fileData of result.files) {
          const { entries } = parseLogsDetailed(fileData.lines.join('\n'));
          if (entries.length === 0) continue;
          setSources((prev) => {
            const watchSourceName = `watch:${activeWatchFolder}`;
            const idx = prev.findIndex((s) => s.name === watchSourceName);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                logs: [...updated[idx].logs, ...entries],
              };
              return updated;
            }
            return prev;
          });
        }
      }
    },
    [activeWatchFolder]
  );

  // Always stream when a watched folder is active
  const { isConnected } = useLogStream({
    folder: activeWatchFolder,
    enabled: activeWatchFolder !== null,
    onNewLines: handleNewStreamLines,
    onFoldersUpdated: handleFoldersUpdated,
  });

  // Diff state
  const [diffSourceA, setDiffSourceA] = useState('');
  const [diffSourceB, setDiffSourceB] = useState('');

  // ─── Derived data ───────────────────────────────────────────────
  const modules = useMemo(() => {
    const set = new Set<string>();
    for (const log of allLogs) {
      if (log.module) set.add(log.module as string);
    }
    return Array.from(set).sort();
  }, [allLogs]);

  const availableFields = useMemo(() => {
    const set = new Set<string>();
    const sample = allLogs.slice(0, 200);
    for (const entry of sample) {
      for (const key of Object.keys(entry)) {
        if (!key.startsWith('__')) set.add(key);
      }
    }
    return Array.from(set).sort();
  }, [allLogs]);

  const traceField = useMemo(() => detectTraceField(allLogs), [allLogs]);

  const logsBySource = useMemo(() => {
    const map = new Map<string, SourcedLogEntry[]>();
    for (const entry of allLogs) {
      const group = map.get(entry.__source);
      if (group) group.push(entry);
      else map.set(entry.__source, [entry]);
    }
    return map;
  }, [allLogs]);

  // ─── Regex validation ──────────────────────────────────────────
  const compiledRegex = useMemo(() => {
    if (!isRegex || !debouncedSearch) return null;
    try {
      return new RegExp(debouncedSearch, 'i');
    } catch {
      return null;
    }
  }, [isRegex, debouncedSearch]);

  const regexError = useMemo(() => {
    if (!isRegex || !debouncedSearch) return null;
    if (compiledRegex) return null;
    try {
      new RegExp(debouncedSearch, 'i');
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [isRegex, debouncedSearch, compiledRegex]);

  const normalizedSearch = useMemo(() => debouncedSearch.toLowerCase(), [debouncedSearch]);

  // ─── Filter and sort logs ──────────────────────────────────────
  const filteredLogs = useMemo(() => {
    let result = allLogs.filter((entry) => {
      // Level filter
      const level = getLevelName(entry.level);
      if (!activeLevels.has(level)) return false;

      // Source filter
      if (sourceNames.length > 1 && !activeSources.has(entry.__source))
        return false;

      // Module filter
      if (modules.length > 0) {
        const entryModule = (entry.module as string) || '';
        if (entryModule && !activeModules.has(entryModule)) return false;
      }

      // Time range filter
      if (timeRange) {
        if (entry.time < timeRange[0] || entry.time > timeRange[1])
          return false;
      }

      // Field filters
      for (const filter of fieldFilters) {
        if (!matchesFieldFilter(entry, filter)) return false;
      }

      // Search filter
      if (debouncedSearch) {
        if (isRegex) {
          if (!compiledRegex) return true;
          if (!compiledRegex.test(entry.__searchText)) return false;
        } else if (!entry.__searchText.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'time':
          cmp = a.time - b.time;
          break;
        case 'level':
          cmp = a.level - b.level;
          break;
        case 'module':
          cmp = ((a.module as string) || '').localeCompare(
            (b.module as string) || ''
          );
          break;
        case 'msg':
          cmp = (a.msg || '').localeCompare(b.msg || '');
          break;
        case 'source':
          cmp = a.__source.localeCompare(b.__source);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [
    allLogs,
    debouncedSearch,
    isRegex,
    compiledRegex,
    normalizedSearch,
    activeLevels,
    activeModules,
    activeSources,
    modules,
    sourceNames,
    fieldFilters,
    timeRange,
    sortField,
    sortDirection,
  ]);

  const filteredLogByKey = useMemo(() => {
    return new Map(filteredLogs.map((entry) => [entry.__key, entry]));
  }, [filteredLogs]);

  // ─── Callbacks ─────────────────────────────────────────────────
  const handleLogsLoaded = useCallback(
    async (newLogs: PinoLogEntry[], src: string) => {
      setSources([{ name: src, logs: newLogs }]);
      setSearch('');
      setIsRegex(false);
      setActiveLevels(
        new Set(DEFAULT_LEVELS)
      );
      const mods = new Set<string>();
      for (const log of newLogs) {
        if (log.module) mods.add(log.module as string);
      }
      setActiveModules(mods);
      setActiveSources(new Set([src]));
      setSortField('time');
      setSortDirection('asc');
      setFieldFilters([]);
      setTimeRange(null);
      setBookmarks(new Set());
      setShowBookmarksOnly(false);
      setContextLines(0);
      setViewMode('table');

      // Create a new SQLite session
      try {
        const baseName = src.replace(/\.[^.]+$/, '')
        const sessionName = baseName || `Session ${new Date().toLocaleString()}`;
        const id = await sessionMgr.createSession(sessionName, [{ name: src, logs: newLogs }]);
        setActiveSessionId(id);
        refreshStorage();
      } catch {
        // SQLite/IndexedDB unavailable — continue with in-memory only
      }
    },
    [sessionMgr, refreshStorage]
  );

  const handleAddSource = useCallback(
    async (newLogs: PinoLogEntry[], src: string) => {
      setSources((prev) => [...prev, { name: src, logs: newLogs }]);
      setActiveSources((prev) => new Set([...prev, src]));
      const mods = new Set<string>();
      for (const log of newLogs) {
        if (log.module) mods.add(log.module as string);
      }
      setActiveModules((prev) => new Set([...prev, ...mods]));

      // Add to active session
      if (activeSessionId) {
        try {
          await sessionMgr.addSource(activeSessionId, src, newLogs);
          refreshStorage();
        } catch {
          // continue with in-memory only
        }
      }
    },
    [activeSessionId, sessionMgr, refreshStorage]
  );

  const handleClear = useCallback(() => {
    setSources([]);
    setSearch('');
    setFieldFilters([]);
    setTimeRange(null);
    setBookmarks(new Set());
    setParseDiagnostics({});
    setAutoScroll(true);
    setActiveWatchFolder(null);
    setActiveSessionId(null);
  }, []);

  const handleWatchFolderSelect = useCallback(
    async (folder: WatchedFolder) => {
      const result = await fetchLogs(folder.name, 10000);
      if (!result) return;

      const allEntries: PinoLogEntry[] = [];
      for (const file of result.files) {
        const { entries } = parseLogsDetailed(file.lines.join('\n'));
        allEntries.push(...entries);
      }

      // Track known files so we can detect new ones via WebSocket
      knownFilesRef.current = new Set(folder.files.map((f) => f.name));

      const sourceName = `watch:${folder.name}`;
      setSources([{ name: sourceName, logs: allEntries, watched: { folder: folder.name, name: folder.name } }]);
      setSearch('');
      setIsRegex(false);
      setActiveLevels(new Set(DEFAULT_LEVELS));
      const mods = new Set<string>();
      for (const log of allEntries) {
        if (log.module) mods.add(log.module as string);
      }
      setActiveModules(mods);
      setActiveSources(new Set([sourceName]));
      setSortField('time');
      setSortDirection('asc');
      setFieldFilters([]);
      setTimeRange(null);
      setBookmarks(new Set());
      setShowBookmarksOnly(false);
      setContextLines(0);
      setViewMode('table');
      setActiveWatchFolder(folder.name);
      setAutoScroll(true);
    },
    []
  );

  const toggleLevel = useCallback((level: LogLevel) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const setAllLevels = useCallback((levels: LogLevel[]) => {
    setActiveLevels(new Set(levels));
  }, []);

  const setAllModules = useCallback((mods: string[]) => {
    setActiveModules(new Set(mods));
  }, []);

  const toggleModule = useCallback((mod: string) => {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }, []);

  const toggleSource = useCallback((name: string) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField]
  );

  const toggleBookmark = useCallback((key: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const togglePanel = useCallback((panel: PanelToggle) => {
    setPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  }, []);

  const toggleColumn = useCallback((column: TableColumn) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) {
        // Don't allow hiding all columns — keep at least one
        if (next.size > 1) next.delete(column);
      } else {
        next.add(column);
      }
      return next;
    });
  }, []);

  const handleJumpToEntry = useCallback((entry: SourcedLogEntry) => {
    setViewMode('table');
    setJumpToKey(entry.__key);
  }, []);

  const handleDiagnostics = useCallback(
    (source: string, diagnostics: ParseLogDiagnostics) => {
      setParseDiagnostics((prev) => ({ ...prev, [source]: diagnostics }));
    },
    []
  );

  // ─── Session handlers ───────────────────────────────────────────
  const handleLoadSession = useCallback(
    async (id: string) => {
      try {
        await sessionMgr.loadSession(id);
        const session = sessionMgr.manager.getSession(id);
        if (session) {
          const sessionSources = sessionMgr.manager.getSessionSources(id);
          setSources(sessionSources);
          setActiveSessionId(id);
          setSearch('');
          setIsRegex(false);
          setActiveLevels(new Set(DEFAULT_LEVELS));
          const mods = new Set<string>();
          for (const src of sessionSources) {
            for (const log of src.logs) {
              if (log.module) mods.add(log.module as string);
            }
          }
          setActiveModules(mods);
          setActiveSources(new Set(sessionSources.map((s) => s.name)));
          setSortField('time');
          setSortDirection('asc');
          setFieldFilters([]);
          setTimeRange(null);
          setBookmarks(new Set());
          setShowBookmarksOnly(false);
          setViewMode('table');
        }
      } catch {
        // load failed
      }
    },
    [sessionMgr]
  );

  const handleActivateSession = useCallback(
    (id: string) => {
      sessionMgr.activateSession(id);
      // Reload sources from all active sessions
      const activeSources = sessionMgr.getActiveLogSources();
      setSources(activeSources);
      setActiveSources(new Set(activeSources.map((s) => s.name)));
    },
    [sessionMgr]
  );

  const handleDeactivateSession = useCallback(
    (id: string) => {
      sessionMgr.deactivateSession(id);
      // Reload sources from remaining active sessions
      const activeSources = sessionMgr.getActiveLogSources();
      setSources(activeSources);
      setActiveSources(new Set(activeSources.map((s) => s.name)));
      if (activeSessionId === id) {
        const remaining = sessionMgr.activeSessions;
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [sessionMgr, activeSessionId]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await sessionMgr.deleteSession(id);
      if (activeSessionId === id) {
        const remaining = sessionMgr.activeSessions;
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          const activeSources = sessionMgr.getActiveLogSources();
          setSources(activeSources);
          setActiveSources(new Set(activeSources.map((s) => s.name)));
        } else {
          setSources([]);
          setActiveSessionId(null);
        }
      } else {
        const activeSources = sessionMgr.getActiveLogSources();
        setSources(activeSources);
        setActiveSources(new Set(activeSources.map((s) => s.name)));
      }
      refreshStorage();
    },
    [sessionMgr, activeSessionId, refreshStorage]
  );

  useEffect(() => {
    try {
      const storedState = window.localStorage.getItem('pinoctular:view-state');
      if (!storedState) return;
      const parsed = JSON.parse(storedState) as {
        viewMode?: ViewMode;
        contextLines?: number;
        showBookmarksOnly?: boolean;
        panels?: PanelToggle[];
        visibleColumns?: TableColumn[];
      };
      if (parsed.viewMode) setViewMode(parsed.viewMode);
      if (typeof parsed.contextLines === 'number') setContextLines(parsed.contextLines);
      if (typeof parsed.showBookmarksOnly === 'boolean') setShowBookmarksOnly(parsed.showBookmarksOnly);
      if (parsed.panels?.length) setPanels(new Set(parsed.panels));
      if (parsed.visibleColumns?.length) setVisibleColumns(new Set(parsed.visibleColumns));
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'pinoctular:view-state',
      JSON.stringify({
        viewMode,
        contextLines,
        showBookmarksOnly,
        panels: Array.from(panels),
        visibleColumns: Array.from(visibleColumns),
      })
    );
  }, [viewMode, contextLines, showBookmarksOnly, panels, visibleColumns]);

  // ─── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        document.getElementById('log-search-input')?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (search) {
          setSearch('');
          return;
        }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (isInput) return;

      // Shift+X = clear all filters
      if (e.key === 'X' && e.shiftKey) {
        e.preventDefault();
        setSearch('');
        setIsRegex(false);
        setActiveLevels(new Set(ALL_LEVELS));
        const mods = new Set<string>();
        for (const src of sources) {
          for (const log of src.logs) {
            if (log.module) mods.add(log.module as string);
          }
        }
        setActiveModules(mods);
        setActiveSources(new Set(sources.map((s) => s.name)));
        setFieldFilters([]);
        setTimeRange(null);
        setShowBookmarksOnly(false);
        return;
      }

      // j/k navigation
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const keys = filteredLogs.map((entry) => entry.__key);
        if (keys.length === 0) return;

        if (!selectedRowKey) {
          setSelectedRowKey(keys[0]);
          return;
        }

        const currentIdx = keys.indexOf(selectedRowKey);
        const nextIdx =
          e.key === 'j'
            ? Math.min(currentIdx + 1, keys.length - 1)
            : Math.max(currentIdx - 1, 0);
        setSelectedRowKey(keys[nextIdx]);
        return;
      }

      // b = bookmark
      if (e.key === 'b' && selectedRowKey) {
        e.preventDefault();
        toggleBookmark(selectedRowKey);
        return;
      }

      // c = copy
      if (e.key === 'c' && selectedRowKey) {
        e.preventDefault();
        const entry = filteredLogByKey.get(selectedRowKey);
        if (entry) {
          const clean = { ...entry } as Record<string, unknown>;
          delete clean.__source;
          delete clean.__sourceIndex;
          delete clean.__key;
          delete clean.__searchText;
          navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
        }
        return;
      }

      // e = export
      if (e.key === 'e') {
        e.preventDefault();
        const content = exportAsJSON(filteredLogs);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'logs-export.json';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // 1-6 = toggle log levels
      const levelMap: Record<string, LogLevel> = {
        '1': 'trace',
        '2': 'debug',
        '3': 'info',
        '4': 'warn',
        '5': 'error',
        '6': 'fatal',
      };
      if (levelMap[e.key]) {
        e.preventDefault();
        toggleLevel(levelMap[e.key]);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    filteredLogs,
    filteredLogByKey,
    selectedRowKey,
    toggleBookmark,
    toggleLevel,
    debouncedSearch,
    showShortcuts,
    sources,
    search,
  ]);

  const parseSummary = useMemo(() => {
    const diagnostics = Object.entries(parseDiagnostics);
    if (diagnostics.length === 0) return null;

    const totalLines = diagnostics.reduce((sum, [, d]) => sum + d.totalLines, 0);
    const parsedLines = diagnostics.reduce((sum, [, d]) => sum + d.parsedLines, 0);
    const skippedLines = diagnostics.reduce((sum, [, d]) => sum + d.skippedLines, 0);
    const topErrors = diagnostics.flatMap(([source, d]) =>
      d.errors.map((error) => `${source} — ${error}`)
    );

    return { totalLines, parsedLines, skippedLines, topErrors: topErrors.slice(0, 3) };
  }, [parseDiagnostics]);

  const hasLogs = allLogs.length > 0;
  const totalSourceLabel =
    sources.length > 1 ? `${sources.length} sources` : sources[0]?.name || '';

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground font-mono">
                P
              </span>
            </div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight hidden sm:block">
              Pinoctular
            </h1>
            {process.env.NEXT_PUBLIC_APP_VERSION && (
              <span className="text-[10px] text-muted-foreground font-mono hidden sm:block">
                v{process.env.NEXT_PUBLIC_APP_VERSION}
              </span>
            )}
          </div>
          {hasLogs && (
            <>
              <div className="w-px h-4 bg-border hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2">
                <LogSourceBadge
                  source={totalSourceLabel}
                  count={allLogs.length}
                  onClear={handleClear}
                />
                <AddSourceButton onAddSource={handleAddSource} onDiagnostics={handleDiagnostics} />
              </div>
              {/* Mobile: compact source info */}
              <div className="flex sm:hidden items-center gap-1.5 min-w-0">
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {allLogs.length.toLocaleString()} logs
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Storage indicator */}
          <div className="hidden sm:flex">
            <StorageIndicator stats={storageStats} />
          </div>

          {/* Session manager button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={() => setSessionPanelOpen(true)}
            title="Sessions"
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {sessionMgr.summaries.length > 0
                ? `${sessionMgr.summaries.length}`
                : ''}
            </span>
          </Button>

          {/* ── Mobile/tablet controls trigger (< lg) ── */}
          {hasLogs && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 lg:hidden"
              onClick={() => setMobileSheetOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* ── Mobile controls sheet ── */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto px-5 pb-8"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-sm">Controls</SheetTitle>
            <SheetDescription className="text-xs">
              {totalSourceLabel} — {allLogs.length.toLocaleString()} logs
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5">
            {/* Source info + actions */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Source
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <LogSourceBadge
                  source={totalSourceLabel}
                  count={allLogs.length}
                  onClear={() => {
                    handleClear();
                    setMobileSheetOpen(false);
                  }}
                />
                <AddSourceButton
                  onAddSource={(logs, src) => {
                    handleAddSource(logs, src);
                    setMobileSheetOpen(false);
                  }}
                  onDiagnostics={handleDiagnostics}
                />
              </div>
            </div>

            {/* Level filters */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Level
              </h3>
              <div className="flex items-center gap-1 mb-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-5 text-[10px] px-1.5 ${
                    activeLevels.size === ALL_LEVELS.length
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                  onClick={() => setAllLevels([...ALL_LEVELS])}
                >
                  All
                </Button>
                <span className="text-muted-foreground/30 text-[10px]">
                  /
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-5 text-[10px] px-1.5 ${
                    activeLevels.size === 0
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                  onClick={() => setAllLevels([])}
                >
                  None
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {ALL_LEVELS.map((level) => {
                  const active = activeLevels.has(level);
                  return (
                    <button
                      key={level}
                      onClick={() => toggleLevel(level)}
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                        active
                          ? LEVEL_BG_COLORS[level]
                          : 'bg-transparent border-border text-muted-foreground/50 opacity-50'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Module filters */}
            {modules.length > 1 && (
              <div className="space-y-2">
                <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Module
                </h3>
                <div className="flex items-center gap-1 mb-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-5 text-[10px] px-1.5 ${
                      activeModules.size === modules.length
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setAllModules([...modules])}
                  >
                    All
                  </Button>
                  <span className="text-muted-foreground/30 text-[10px]">
                    /
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-5 text-[10px] px-1.5 ${
                      activeModules.size === 0
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setAllModules([])}
                  >
                    None
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {modules.map((mod) => {
                    const active = activeModules.has(mod);
                    return (
                      <button
                        key={mod}
                        onClick={() => toggleModule(mod)}
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-transparent border-border text-muted-foreground/50 opacity-50'
                        }`}
                      >
                        {mod}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* View mode */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                View
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => {
                    setViewMode('table');
                    setMobileSheetOpen(false);
                  }}
                >
                  <List className="h-3.5 w-3.5" />
                  Table
                </Button>
                {sourceNames.length > 1 && (
                  <Button
                    variant={viewMode === 'diff' ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-xs gap-1.5"
                    onClick={() => {
                      setViewMode('diff');
                      if (!diffSourceA && sourceNames.length >= 2) {
                        setDiffSourceA(sourceNames[0]);
                        setDiffSourceB(sourceNames[1]);
                      }
                      setMobileSheetOpen(false);
                    }}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Diff
                  </Button>
                )}
                {traceField && (
                  <Button
                    variant={viewMode === 'trace' ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-xs gap-1.5"
                    onClick={() => {
                      setViewMode('trace');
                      setMobileSheetOpen(false);
                    }}
                  >
                    <Network className="h-3.5 w-3.5" />
                    Traces
                  </Button>
                )}
              </div>
            </div>

            {/* Panels */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Panels
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  variant={panels.has('timeline') ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => togglePanel('timeline')}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Timeline
                </Button>
                <Button
                  variant={panels.has('trends') ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => togglePanel('trends')}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Trends
                </Button>
                <Button
                  variant={panels.has('errors') ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={() => togglePanel('errors')}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Errors
                </Button>
              </div>
            </div>

            {/* Bookmarks */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Bookmarks
              </h3>
              <Button
                variant={showBookmarksOnly ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs gap-1.5"
                onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              >
                {showBookmarksOnly ? (
                  <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                {showBookmarksOnly
                  ? 'Showing bookmarks'
                  : 'Show bookmarks only'}
                {bookmarks.size > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({bookmarks.size})
                  </span>
                )}
              </Button>
            </div>

            {/* Context lines */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Context Lines
              </h3>
              <select
                className="h-8 text-xs bg-secondary border border-border rounded px-2 text-foreground w-full"
                value={contextLines}
                onChange={(e) => setContextLines(Number(e.target.value))}
              >
                <option value={0}>No context</option>
                <option value={1}>+/- 1 line</option>
                <option value={3}>+/- 3 lines</option>
                <option value={5}>+/- 5 lines</option>
                <option value={10}>+/- 10 lines</option>
              </select>
            </div>

            {/* Level stats */}
            <div className="space-y-2">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Level Distribution
              </h3>
              <LogStats logs={allLogs} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Input screen or log viewer */}
      {!hasLogs ? (
        <LogInput
          onLogsLoaded={handleLogsLoaded}
          hasLogs={hasLogs}
          onClear={handleClear}
          onAddSource={handleAddSource}
          onDiagnostics={handleDiagnostics}
          watchAvailable={watchConfig.available}
          watchFolders={watchConfig.folders}
          onWatchFolderSelect={handleWatchFolderSelect}
        />
      ) : (
        <>
          {parseSummary && parseSummary.skippedLines > 0 && (
            <Alert className="mx-4 mt-3 mb-1 border-amber-500/30 bg-amber-500/10">
              <AlertTitle>Parse diagnostics</AlertTitle>
              <AlertDescription className="text-xs">
                Parsed {parseSummary.parsedLines.toLocaleString()} of{' '}
                {parseSummary.totalLines.toLocaleString()} lines. Skipped{' '}
                {parseSummary.skippedLines.toLocaleString()} malformed lines.
                {parseSummary.topErrors.length > 0 && (
                  <ul className="mt-2 list-disc ml-4 space-y-1">
                    {parseSummary.topErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* ── Desktop controls bar (lg+) ── */}
          <div className="hidden lg:flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
            {/* View mode toggles */}
            <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setViewMode('table')}
              >
                <List className="h-3 w-3 mr-1" />
                Table
              </Button>
              {sourceNames.length > 1 && (
                <Button
                  variant={viewMode === 'diff' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    setViewMode('diff');
                    if (!diffSourceA && sourceNames.length >= 2) {
                      setDiffSourceA(sourceNames[0]);
                      setDiffSourceB(sourceNames[1]);
                    }
                  }}
                >
                  <GitCompare className="h-3 w-3 mr-1" />
                  Diff
                </Button>
              )}
              {traceField && (
                <Button
                  variant={viewMode === 'trace' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setViewMode('trace')}
                >
                  <Network className="h-3 w-3 mr-1" />
                  Traces
                </Button>
              )}
            </div>

            {/* Panel toggles */}
            <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
              <Button
                variant={panels.has('timeline') ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => togglePanel('timeline')}
                title="Timeline histogram"
              >
                <BarChart3 className="h-3 w-3" />
              </Button>
              <Button
                variant={panels.has('trends') ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => togglePanel('trends')}
                title="Level trends"
              >
                <TrendingUp className="h-3 w-3" />
              </Button>
              <Button
                variant={panels.has('errors') ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => togglePanel('errors')}
                title="Error clusters"
              >
                <AlertTriangle className="h-3 w-3" />
              </Button>
            </div>

            {/* Column toggle */}
            <ColumnToggle
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              hasMultipleSources={sourceNames.length > 1}
            />

            {/* Bookmarks toggle */}
            <Button
              variant={showBookmarksOnly ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
            >
              {showBookmarksOnly ? (
                <BookmarkCheck className="h-3 w-3 text-primary" />
              ) : (
                <Bookmark className="h-3 w-3" />
              )}
              {bookmarks.size > 0 && (
                <span className="text-[9px]">{bookmarks.size}</span>
              )}
            </Button>

            {/* Context lines */}
            <select
              className="h-6 text-[10px] bg-secondary border border-border rounded px-1 text-foreground"
              value={contextLines}
              onChange={(e) => setContextLines(Number(e.target.value))}
              title="Context lines"
            >
              <option value={0}>No context</option>
              <option value={1}>+/- 1 line</option>
              <option value={3}>+/- 3 lines</option>
              <option value={5}>+/- 5 lines</option>
              <option value={10}>+/- 10 lines</option>
            </select>

            {/* Stream controls (watched folder only) */}
            {activeWatchFolder && (
              <StreamControls
                isConnected={isConnected}
                autoScroll={autoScroll}
                onAutoScrollToggle={() => setAutoScroll((v) => !v)}
              />
            )}

            {/* Keyboard shortcuts button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-3 w-3" />
            </Button>

            <div className="ml-auto w-48">
              <LogStats logs={allLogs} />
            </div>
          </div>

          {/* Toolbar (table & trace views) */}
          {viewMode !== 'diff' && (
            <LogToolbar
              search={search}
              onSearchChange={setSearch}
              isRegex={isRegex}
              onRegexToggle={() => setIsRegex(!isRegex)}
              regexError={regexError}
              activeLevels={activeLevels}
              onToggleLevel={toggleLevel}
              onSetAllLevels={setAllLevels}
              modules={modules}
              activeModules={activeModules}
              onToggleModule={toggleModule}
              onSetAllModules={setAllModules}
              filteredCount={filteredLogs.length}
              totalCount={allLogs.length}
              fieldFilters={fieldFilters}
              onAddFieldFilter={(f) => setFieldFilters((prev) => [...prev, f])}
              onRemoveFieldFilter={(id) =>
                setFieldFilters((prev) => prev.filter((f) => f.id !== id))
              }
              availableFields={availableFields}
              filteredLogs={filteredLogs}
              sourceNames={sourceNames}
              activeSources={activeSources}
              onToggleSource={toggleSource}
            />
          )}

          {/* Collapsible panels */}
          {viewMode === 'table' && (
            <>
              {panels.has('timeline') && (
                <TimelineHistogram
                  logs={allLogs}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                />
              )}
              {panels.has('trends') && <LevelTrendChart logs={allLogs} />}
              {panels.has('errors') && (
                <ErrorClusters
                  logs={allLogs}
                  onJumpToEntry={handleJumpToEntry}
                />
              )}
            </>
          )}

          {/* Main content area */}
          {viewMode === 'table' && (
            <LogTable
              logs={filteredLogs}
              allLogs={allLogs}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              bookmarks={bookmarks}
              onToggleBookmark={toggleBookmark}
              showBookmarksOnly={showBookmarksOnly}
              contextLines={contextLines}
              selectedRowKey={selectedRowKey}
              onSelectRow={setSelectedRowKey}
              sourceNames={sourceNames}
              jumpToKey={jumpToKey}
              onJumpHandled={() => setJumpToKey(null)}
              autoScroll={activeWatchFolder !== null && autoScroll}
              onUserScroll={() => setAutoScroll(false)}
              visibleColumns={visibleColumns}
            />
          )}

          {viewMode === 'diff' && sourceNames.length > 1 && (
            <DiffView
              sourceNames={sourceNames}
              logsBySource={logsBySource}
              sourceA={diffSourceA || sourceNames[0]}
              sourceB={diffSourceB || sourceNames[1]}
              onSourceAChange={setDiffSourceA}
              onSourceBChange={setDiffSourceB}
            />
          )}

          {viewMode === 'trace' && traceField && (
            <RequestTrace
              logs={filteredLogs}
              traceField={traceField}
              onJumpToEntry={handleJumpToEntry}
            />
          )}
        </>
      )}

      {/* Keyboard shortcuts dialog */}
      <KeyboardShortcuts open={showShortcuts} onOpenChange={setShowShortcuts} />

      {/* Session manager panel */}
      <Sheet open={sessionPanelOpen} onOpenChange={setSessionPanelOpen}>
        <SheetContent side="right" className="w-80 sm:w-96 overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-sm">Sessions</SheetTitle>
            <SheetDescription className="text-xs">
              Manage your log sessions stored in the browser
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            <StorageIndicator stats={storageStats} />
            <SessionManagerPanel
              summaries={sessionMgr.summaries}
              storedSessions={sessionMgr.storedSessions}
              onActivate={handleActivateSession}
              onDeactivate={handleDeactivateSession}
              onDelete={handleDeleteSession}
              onLoad={handleLoadSession}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
