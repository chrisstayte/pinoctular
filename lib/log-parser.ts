export interface PinoLog {
  level: number;
  time: number;
  pid?: number;
  hostname?: string;
  msg?: string;
  name?: string;
  [key: string]: unknown;
}

export interface ParsedLog extends PinoLog {
  id: string;
  levelName: string;
  timestamp: string;
  rawText: string;
}

const logLevels: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

export function parsePinoLogs(input: string): ParsedLog[] {
  const lines = input.trim().split('\n');
  const logs: ParsedLog[] = [];

  lines.forEach((line, index) => {
    if (!line.trim()) return;

    try {
      const parsed = JSON.parse(line) as PinoLog;
      
      const levelName = logLevels[parsed.level] || `level-${parsed.level}`;
      const timestamp = parsed.time 
        ? new Date(parsed.time).toISOString()
        : new Date().toISOString();

      logs.push({
        ...parsed,
        id: `${index}-${Date.now()}`,
        levelName,
        timestamp,
        rawText: line,
      });
    } catch {
      // If line is not valid JSON, treat it as a plain text log
      logs.push({
        id: `${index}-${Date.now()}`,
        level: 30,
        levelName: 'info',
        time: Date.now(),
        timestamp: new Date().toISOString(),
        msg: line,
        rawText: line,
      });
    }
  });

  return logs;
}

export function getLevelColor(level: string): string {
  switch (level) {
    case 'trace':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    case 'debug':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
    case 'info':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
    case 'warn':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
    case 'fatal':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
  }
}

export function filterLogs(
  logs: ParsedLog[],
  searchTerm: string,
  selectedLevels: string[]
): ParsedLog[] {
  return logs.filter((log) => {
    // Filter by level
    if (selectedLevels.length > 0 && !selectedLevels.includes(log.levelName)) {
      return false;
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        log.msg?.toLowerCase().includes(searchLower) ||
        log.rawText.toLowerCase().includes(searchLower) ||
        log.levelName.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });
}
