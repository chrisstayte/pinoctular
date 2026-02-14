'use client'

import { Radio, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StreamControlsProps {
  isConnected: boolean
  autoScroll: boolean
  onAutoScrollToggle: () => void
}

export function StreamControls({
  isConnected,
  autoScroll,
  onAutoScrollToggle,
}: StreamControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="flex items-center gap-1 px-2 h-6 text-[10px] text-muted-foreground"
        title={isConnected ? 'Connected — receiving live updates' : 'Connecting...'}
      >
        <span className="relative flex items-center">
          <Radio className="h-3 w-3" />
          <span
            className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            }`}
          />
        </span>
        Live
      </span>

      <Button
        variant={autoScroll ? 'secondary' : 'ghost'}
        size="sm"
        className="h-6 px-2 text-[10px] gap-1"
        onClick={onAutoScrollToggle}
        title={autoScroll ? 'Stop auto-scrolling' : 'Follow new logs'}
      >
        <ArrowDownToLine className="h-3 w-3" />
        Follow
      </Button>
    </div>
  )
}
