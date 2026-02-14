'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  ClipboardPaste,
  FileText,
  X,
  Github,
  Plus,
  Play,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ParseLogDiagnostics, PinoLogEntry } from '@/lib/log-types';
import { parseLogsDetailed } from '@/lib/log-types';

interface LogInputProps {
  onLogsLoaded: (logs: PinoLogEntry[], source: string) => void;
  hasLogs: boolean;
  onClear: () => void;
  onAddSource?: (logs: PinoLogEntry[], source: string) => void;
  onDiagnostics?: (source: string, diagnostics: ParseLogDiagnostics) => void;
}

function parseFileText(text: string) {
  return parseLogsDetailed(text);
}

export function LogInput({
  onLogsLoaded,
  hasLogs,
  onClear,
  onAddSource,
  onDiagnostics,
}: LogInputProps) {
  const [mode, setMode] = useState<'idle' | 'paste'>('idle');
  const [pasteValue, setPasteValue] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParsedLogs = useCallback(
    (
      text: string,
      source: string,
      onSuccess: (logs: PinoLogEntry[], source: string) => void
    ) => {
      const { entries, diagnostics } = parseFileText(text);
      onDiagnostics?.(source, diagnostics);

      if (entries.length > 0) {
        onSuccess(entries, source);
      }

      if (diagnostics.skippedLines > 0) {
        setParseWarning(
          `${source}: parsed ${diagnostics.parsedLines}/${diagnostics.totalLines} lines (${diagnostics.skippedLines} skipped).`
        );
      } else {
        setParseWarning(null);
      }
    },
    [onDiagnostics]
  );

  const readFileText = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve((event.target?.result as string) ?? '');
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });
  }, []);

  const handleLoadExample = useCallback(async () => {
    setLoadingExample(true);
    try {
      const res = await fetch('/example.log');
      const text = await res.text();
      handleParsedLogs(text, 'example.log', onLogsLoaded);
    } catch {
      // silently fail
    } finally {
      setLoadingExample(false);
    }
  }, [handleParsedLogs, onLogsLoaded]);

  const handleMultipleFiles = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);
      for (const [index, file] of fileArray.entries()) {
        const text = await readFileText(file);
        handleParsedLogs(text, file.name, (logs, source) => {
          if (index === 0 && !hasLogs) {
            onLogsLoaded(logs, source);
            return;
          }
          onAddSource?.(logs, source);
        });
      }
    },
    [handleParsedLogs, hasLogs, onAddSource, onLogsLoaded, readFileText]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        void handleMultipleFiles(files);
      }
    },
    [handleMultipleFiles]
  );

  const handlePaste = useCallback(() => {
    if (!pasteValue.trim()) return;
    handleParsedLogs(pasteValue, 'Pasted logs', onLogsLoaded);
    setPasteValue('');
    setMode('idle');
  }, [handleParsedLogs, pasteValue, onLogsLoaded]);

  if (hasLogs) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2 text-balance">
          Pinoctular
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload log files or paste your Pino JSON logs. Drop multiple files to
          compare sources.
        </p>
      </div>

      {parseWarning && (
        <div className="w-full max-w-2xl rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{parseWarning}</span>
        </div>
      )}

      {mode === 'idle' ? (
        <div className="flex flex-col gap-4 w-full max-w-lg">
          <div
            className={`relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/40'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload log file"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".log,.txt,.json,.ndjson"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  void handleMultipleFiles(files);
                }
              }}
            />
            <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drop your .log files here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse — supports multiple files
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="outline"
            className="w-full h-12 gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            onClick={() => setMode('paste')}
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste logs
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 gap-2"
            onClick={handleLoadExample}
            disabled={loadingExample}
          >
            {loadingExample ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {loadingExample ? 'Loading example...' : 'Try an example'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-2xl">
          <div className="relative">
            <textarea
              className="w-full h-64 rounded-lg border border-border bg-card text-foreground font-mono text-xs p-4 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              placeholder={
                'Paste your Pino JSON logs here...\n\n{"level":30,"time":1234567890,"msg":"Hello world"}'
              }
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode('idle');
                setPasteValue('');
              }}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePaste}
              disabled={!pasteValue.trim()}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <FileText className="h-3.5 w-3.5" />
              Load logs
            </Button>
          </div>
        </div>
      )}

      <a
        href="https://github.com/chrisstayte/pinoctular"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Github className="h-4 w-4" />
        Check it out on GitHub
      </a>
    </div>
  );
}

export function LogSourceBadge({
  source,
  count,
  onClear,
}: {
  source: string;
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <FileText className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">{source}</span>
      <span className="text-muted-foreground">
        {count.toLocaleString()} {count === 1 ? 'entry' : 'entries'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={onClear}
        aria-label="Clear logs"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function AddSourceButton({
  onAddSource,
  onDiagnostics,
}: {
  onAddSource: (logs: PinoLogEntry[], source: string) => void;
  onDiagnostics?: (source: string, diagnostics: ParseLogDiagnostics) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".log,.txt,.json,.ndjson"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const text = ev.target?.result as string;
              const { entries, diagnostics } = parseLogsDetailed(text);
              onDiagnostics?.(file.name, diagnostics);
              if (entries.length > 0) onAddSource(entries, file.name);
            };
            reader.readAsText(file);
          });
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus className="h-3 w-3" />
        Add source
      </Button>
    </>
  );
}
