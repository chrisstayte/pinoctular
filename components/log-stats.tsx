'use client';

import { memo } from 'react';
import {
  type SourcedLogEntry,
  type LogLevel,
  getLevelName,
} from '@/lib/log-types';

interface LogStatsProps {
  logs: SourcedLogEntry[];
}

export const LogStats = memo(function LogStats({ logs }: LogStatsProps) {
  const levelCounts = logs.reduce<Record<LogLevel, number>>(
    (acc, entry) => {
      const level = getLevelName(entry.level);
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 }
  );

  const total = logs.length;
  if (total === 0) return null;

  const levels: LogLevel[] = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
  ];

  return (
    <div className="flex items-center gap-1 h-1.5 w-full rounded-full overflow-hidden bg-secondary">
      {levels.map((level) => {
        const count = levelCounts[level];
        if (count === 0) return null;
        const percent = (count / total) * 100;

        const barColors: Record<LogLevel, string> = {
          trace: 'bg-log-trace/60',
          debug: 'bg-log-debug/60',
          info: 'bg-log-info/60',
          warn: 'bg-log-warn/60',
          error: 'bg-log-error/60',
          fatal: 'bg-log-fatal/60',
        };

        return (
          <div
            key={level}
            className={`h-full ${barColors[level]} transition-all`}
            style={{ width: `${percent}%` }}
            title={`${level}: ${count} (${percent.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
});
