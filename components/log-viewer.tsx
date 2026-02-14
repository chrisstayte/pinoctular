'use client';

import { useState, useMemo } from 'react';
import { Upload, FileText, Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parsePinoLogs, filterLogs, getLevelColor, type ParsedLog } from '@/lib/log-parser';

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

export default function LogViewer() {
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [pastedLogs, setPastedLogs] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsedLogs = parsePinoLogs(text);
    setLogs(parsedLogs);
    setPastedLogs('');
  };

  const handlePasteLogs = () => {
    if (!pastedLogs.trim()) return;
    const parsedLogs = parsePinoLogs(pastedLogs);
    setLogs(parsedLogs);
  };

  const handleClearLogs = () => {
    setLogs([]);
    setPastedLogs('');
    setSearchTerm('');
    setSelectedLevels([]);
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level]
    );
  };

  const filteredLogs = useMemo(() => {
    const filtered = filterLogs(logs, searchTerm, selectedLevels);
    return sortOrder === 'asc' ? filtered : [...filtered].reverse();
  }, [logs, searchTerm, selectedLevels, sortOrder]);

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Pinoctular</h1>
        <p className="text-gray-500 dark:text-gray-400">A lightweight Pino log viewer</p>
      </div>

      {logs.length === 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Log File
              </CardTitle>
              <CardDescription>
                Upload a .log file containing Pino JSON logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="file"
                accept=".log,.txt"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Paste Logs
              </CardTitle>
              <CardDescription>
                Paste your Pino JSON logs directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste your Pino logs here..."
                value={pastedLogs}
                onChange={(e) => setPastedLogs(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <Button onClick={handlePasteLogs} className="w-full">
                Load Logs
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filters and Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <Input
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      Sort: {sortOrder === 'asc' ? '↑ Oldest' : '↓ Newest'}
                    </Button>
                    <Button variant="outline" onClick={handleClearLogs}>
                      <X className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filter by level:
                  </span>
                  {LOG_LEVELS.map((level) => (
                    <Badge
                      key={level}
                      className={`cursor-pointer ${
                        selectedLevels.includes(level)
                          ? getLevelColor(level)
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                      onClick={() => toggleLevel(level)}
                    >
                      {level}
                    </Badge>
                  ))}
                  {selectedLevels.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLevels([])}
                      className="h-6 px-2"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {filteredLogs.length} of {logs.length} logs
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log List */}
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-shrink-0">
                      <Badge className={getLevelColor(log.levelName)}>
                        {log.levelName.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {log.timestamp}
                        </span>
                        {log.name && (
                          <Badge variant="outline" className="text-xs">
                            {log.name}
                          </Badge>
                        )}
                        {log.pid && (
                          <Badge variant="outline" className="text-xs">
                            PID: {log.pid}
                          </Badge>
                        )}
                      </div>
                      {log.msg && (
                        <p className="text-sm font-medium">{log.msg}</p>
                      )}
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-50">
                          View raw log
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto text-xs font-mono">
                          {log.rawText}
                        </pre>
                      </details>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredLogs.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center text-gray-500 dark:text-gray-400">
                No logs match your filters
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
