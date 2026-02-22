'use client'

import { HardDrive } from 'lucide-react'
import type { StorageStats } from '@/hooks/use-storage-stats'
import { formatBytes } from '@/hooks/use-storage-stats'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface StorageIndicatorProps {
  stats: StorageStats
}

export function StorageIndicator({ stats }: StorageIndicatorProps) {
  const { usage, quota, usagePercent, totalSessionSize, sessions } = stats

  const barColor =
    usagePercent > 90
      ? 'bg-destructive'
      : usagePercent > 70
        ? 'bg-amber-500'
        : 'bg-primary'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <HardDrive className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatBytes(usage)}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="font-medium">Storage Usage</div>
            <div className="space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Total used</span>
                <span>{formatBytes(usage)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Sessions</span>
                <span>{formatBytes(totalSessionSize)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Available</span>
                <span>{formatBytes(Math.max(0, quota - usage))}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Quota</span>
                <span>{formatBytes(quota)}</span>
              </div>
            </div>
            {sessions.length > 0 && (
              <>
                <div className="border-t border-border pt-2 font-medium">
                  Per Session
                </div>
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex justify-between gap-4">
                      <span className="text-muted-foreground truncate">
                        {s.name}
                      </span>
                      <span className="shrink-0">{formatBytes(s.sizeBytes)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
