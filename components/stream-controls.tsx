'use client'

import { Radio, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StreamControlsProps {
  isStreaming: boolean
  onStreamToggle: () => void
  autoScroll: boolean
  onAutoScrollToggle: () => void
  isConnected: boolean
}

export function StreamControls({
  isStreaming,
  onStreamToggle,
  autoScroll,
  onAutoScrollToggle,
  isConnected,
}: StreamControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={isStreaming ? 'secondary' : 'ghost'}
        size="sm"
        className="h-6 px-2 text-[10px] gap-1"
        onClick={onStreamToggle}
        title={isStreaming ? 'Stop live streaming' : 'Start live streaming'}
      >
        <span className="relative flex items-center">
          <Radio className="h-3 w-3" />
          {isStreaming && isConnected && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </span>
        Live
      </Button>

      {isStreaming && (
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
      )}
    </div>
  )
}
