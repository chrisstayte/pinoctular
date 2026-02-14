'use client';

import { useMemo, useState, useRef, useEffect, memo } from 'react';
import {
  type SourcedLogEntry,
  type LogLevel,
  buildTimeline,
  formatTimestamp,
} from '@/lib/log-types';

interface TimelineHistogramProps {
  logs: SourcedLogEntry[];
  timeRange: [number, number] | null;
  onTimeRangeChange: (range: [number, number] | null) => void;
}

const LEVEL_BAR_COLORS: Record<LogLevel, string> = {
  fatal: '#c026d3',
  error: '#ef4444',
  warn: '#f59e0b',
  info: '#22c55e',
  debug: '#06b6d4',
  trace: '#6b7280',
};

const LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

export const TimelineHistogram = memo(function TimelineHistogram({
  logs,
  timeRange,
  onTimeRangeChange,
}: TimelineHistogramProps) {
  const buckets = useMemo(() => buildTimeline(logs, 80), [logs]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{
    type: 'selecting' | 'drag-start' | 'drag-end' | 'drag-range';
    startX: number;
    startIndex: number;
    currentIndex: number;
    originalRange?: [number, number];
    dragOffsetIndex?: number;
  } | null>(null);

  const maxTotal =
    buckets.length > 1 ? Math.max(...buckets.map((b) => b.total), 1) : 1;
  const barWidth = buckets.length > 1 ? 100 / buckets.length : 100;

  const getIndexFromX = (clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const fraction = x / rect.width;
    return Math.max(
      0,
      Math.min(buckets.length - 1, Math.floor(fraction * buckets.length))
    );
  };

  const getRelativeX = (clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return clientX - rect.left;
  };

  const getRangeIndices = (): [number, number] | null => {
    if (!timeRange) return null;
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].startTime >= timeRange[0] && startIdx === -1) startIdx = i;
      if (buckets[i].endTime <= timeRange[1]) endIdx = i;
    }
    if (startIdx === -1 || endIdx === -1) return null;
    return [startIdx, endIdx];
  };

  const rangeIndices = getRangeIndices();

  const isNearEdge = (clientX: number): 'start' | 'end' | null => {
    if (!rangeIndices || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const startPx = (rangeIndices[0] / buckets.length) * rect.width;
    const endPx = ((rangeIndices[1] + 1) / buckets.length) * rect.width;
    const x = clientX - rect.left;
    const threshold = 8;
    if (Math.abs(x - startPx) < threshold) return 'start';
    if (Math.abs(x - endPx) < threshold) return 'end';
    return null;
  };

  const isInsideRange = (clientX: number): boolean => {
    if (!rangeIndices || !containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    const startPx = (rangeIndices[0] / buckets.length) * rect.width;
    const endPx = ((rangeIndices[1] + 1) / buckets.length) * rect.width;
    const x = clientX - rect.left;
    return x >= startPx + 8 && x <= endPx - 8;
  };

  const getCursor = (clientX: number): string => {
    const edge = isNearEdge(clientX);
    if (edge) return 'ew-resize';
    if (isInsideRange(clientX)) return 'grab';
    return 'crosshair';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragState) return;
    setHoverX(getRelativeX(e.clientX));
    setHoverIndex(getIndexFromX(e.clientX));
    const el = containerRef.current;
    if (el) el.style.cursor = getCursor(e.clientX);
  };

  const handleMouseLeave = () => {
    if (!dragState) {
      setHoverX(null);
      setHoverIndex(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const edge = isNearEdge(e.clientX);
    const index = getIndexFromX(e.clientX);

    if (edge === 'start' && rangeIndices) {
      setDragState({
        type: 'drag-start',
        startX: e.clientX,
        startIndex: rangeIndices[0],
        currentIndex: rangeIndices[0],
        originalRange: timeRange!,
      });
    } else if (edge === 'end' && rangeIndices) {
      setDragState({
        type: 'drag-end',
        startX: e.clientX,
        startIndex: rangeIndices[1],
        currentIndex: rangeIndices[1],
        originalRange: timeRange!,
      });
    } else if (isInsideRange(e.clientX) && rangeIndices) {
      setDragState({
        type: 'drag-range',
        startX: e.clientX,
        startIndex: index,
        currentIndex: index,
        originalRange: timeRange!,
        dragOffsetIndex: index - rangeIndices[0],
      });
    } else {
      setDragState({
        type: 'selecting',
        startX: e.clientX,
        startIndex: index,
        currentIndex: index,
      });
    }
  };

  // Global mouse events for drag operations
  useEffect(() => {
    if (!dragState) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const index = getIndexFromX(e.clientX);
      setHoverX(getRelativeX(e.clientX));
      setHoverIndex(index);

      setDragState((prev) => {
        if (!prev) return null;
        const updated = { ...prev, currentIndex: index };

        if (prev.type === 'selecting') {
          const start = Math.min(prev.startIndex, index);
          const end = Math.max(prev.startIndex, index);
          onTimeRangeChange([buckets[start].startTime, buckets[end].endTime]);
        } else if (prev.type === 'drag-start' && rangeIndices) {
          const newStart = Math.min(index, rangeIndices[1]);
          onTimeRangeChange([
            buckets[newStart].startTime,
            buckets[rangeIndices[1]].endTime,
          ]);
        } else if (prev.type === 'drag-end' && rangeIndices) {
          const newEnd = Math.max(index, rangeIndices[0]);
          onTimeRangeChange([
            buckets[rangeIndices[0]].startTime,
            buckets[newEnd].endTime,
          ]);
        } else if (
          prev.type === 'drag-range' &&
          rangeIndices &&
          prev.dragOffsetIndex !== undefined
        ) {
          const rangeLen = rangeIndices[1] - rangeIndices[0];
          let newStart = index - prev.dragOffsetIndex;
          newStart = Math.max(
            0,
            Math.min(newStart, buckets.length - 1 - rangeLen)
          );
          const newEnd = newStart + rangeLen;
          onTimeRangeChange([
            buckets[newStart].startTime,
            buckets[newEnd].endTime,
          ]);
        }

        return updated;
      });
    };

    const handleGlobalMouseUp = () => {
      if (
        dragState.type === 'selecting' &&
        dragState.startIndex === dragState.currentIndex
      ) {
        const bucket = buckets[dragState.startIndex];
        if (
          timeRange &&
          timeRange[0] === bucket.startTime &&
          timeRange[1] === bucket.endTime
        ) {
          onTimeRangeChange(null);
        } else {
          onTimeRangeChange([bucket.startTime, bucket.endTime]);
        }
      }
      setDragState(null);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, buckets, timeRange, rangeIndices, onTimeRangeChange]);

  // Early return after all hooks
  if (buckets.length <= 1) return null;

  const hoverBucket = hoverIndex !== null ? buckets[hoverIndex] : null;
  const hoverTime = hoverBucket ? formatTimestamp(hoverBucket.startTime) : null;

  const selStartFrac = rangeIndices ? rangeIndices[0] / buckets.length : 0;
  const selEndFrac = rangeIndices ? (rangeIndices[1] + 1) / buckets.length : 0;

  const dragPreviewIndices: [number, number] | null =
    dragState?.type === 'selecting'
      ? [
          Math.min(dragState.startIndex, dragState.currentIndex),
          Math.max(dragState.startIndex, dragState.currentIndex),
        ]
      : null;

  return (
    <div className="px-4 py-2 border-b border-border bg-card select-none">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Timeline
        </span>
        <div className="flex items-center gap-3">
          {timeRange && (
            <button
              className="text-[10px] text-primary hover:text-primary/80 transition-colors"
              onClick={() => onTimeRangeChange(null)}
            >
              Clear range
            </button>
          )}
          <div className="flex items-center gap-2">
            {(['error', 'warn', 'info', 'debug'] as LogLevel[]).map((level) => (
              <div key={level} className="flex items-center gap-1">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: LEVEL_BAR_COLORS[level] }}
                />
                <span className="text-[9px] text-muted-foreground">
                  {level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Histogram area with overlays */}
      <div
        ref={containerRef}
        className="relative h-12"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-px">
          {buckets.map((bucket, i) => {
            const isInRange =
              timeRange &&
              bucket.startTime >= timeRange[0] &&
              bucket.endTime <= timeRange[1];
            const isOutOfRange = timeRange && !isInRange;
            const isInDragPreview =
              dragPreviewIndices &&
              i >= dragPreviewIndices[0] &&
              i <= dragPreviewIndices[1];

            return (
              <div
                key={i}
                className={`relative transition-opacity duration-75 ${
                  isOutOfRange && !isInDragPreview
                    ? 'opacity-20'
                    : 'opacity-100'
                }`}
                style={{ width: `${barWidth}%`, height: '100%' }}
              >
                <div className="absolute bottom-0 w-full flex flex-col-reverse">
                  {LEVELS.map((level) => {
                    const count = bucket.counts[level];
                    if (count === 0) return null;
                    const h = (count / maxTotal) * 100;
                    return (
                      <div
                        key={level}
                        className="w-full"
                        style={{
                          height: `${(h / 100) * 48}px`,
                          backgroundColor: LEVEL_BAR_COLORS[level],
                          minHeight: count > 0 ? '1px' : 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selection range overlay */}
        {rangeIndices && (
          <>
            {/* Selected range highlight */}
            <div
              className="absolute top-0 bottom-0 border-y-2 border-primary/40 bg-primary/10 pointer-events-none"
              style={{
                left: `${selStartFrac * 100}%`,
                width: `${(selEndFrac - selStartFrac) * 100}%`,
              }}
            />

            {/* Left thumb handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-primary rounded-sm cursor-ew-resize z-10"
              style={{
                left: `${selStartFrac * 100}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-3 h-6 rounded-sm bg-primary border border-primary-foreground/20 shadow-md flex items-center justify-center">
                <div className="flex gap-px">
                  <div className="w-px h-2 bg-primary-foreground/50 rounded-full" />
                  <div className="w-px h-2 bg-primary-foreground/50 rounded-full" />
                </div>
              </div>
            </div>

            {/* Right thumb handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-primary rounded-sm cursor-ew-resize z-10"
              style={{
                left: `${selEndFrac * 100}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-3 h-6 rounded-sm bg-primary border border-primary-foreground/20 shadow-md flex items-center justify-center">
                <div className="flex gap-px">
                  <div className="w-px h-2 bg-primary-foreground/50 rounded-full" />
                  <div className="w-px h-2 bg-primary-foreground/50 rounded-full" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Drag-preview overlay (while selecting new range) */}
        {dragPreviewIndices && !rangeIndices && (
          <div
            className="absolute top-0 bottom-0 bg-primary/15 border-y-2 border-primary/30 pointer-events-none"
            style={{
              left: `${(dragPreviewIndices[0] / buckets.length) * 100}%`,
              width: `${
                ((dragPreviewIndices[1] - dragPreviewIndices[0] + 1) /
                  buckets.length) *
                100
              }%`,
            }}
          />
        )}

        {/* Hover line indicator */}
        {hoverX !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/40 pointer-events-none z-20"
            style={{ left: `${hoverX}px` }}
          />
        )}

        {/* Hover tooltip */}
        {hoverX !== null && hoverBucket && (
          <div
            className="absolute -top-7 pointer-events-none z-30 transform -translate-x-1/2"
            style={{ left: `${hoverX}px` }}
          >
            <div className="bg-popover border border-border text-popover-foreground text-[9px] font-mono px-1.5 py-0.5 rounded shadow-md whitespace-nowrap">
              {hoverTime} &middot; {hoverBucket.total} entries
            </div>
          </div>
        )}
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-muted-foreground font-mono">
          {formatTimestamp(buckets[0].startTime)}
        </span>
        {rangeIndices && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-primary font-mono font-medium">
              {formatTimestamp(buckets[rangeIndices[0]].startTime)}
            </span>
            <span className="text-[9px] text-muted-foreground">&mdash;</span>
            <span className="text-[9px] text-primary font-mono font-medium">
              {formatTimestamp(buckets[rangeIndices[1]].endTime)}
            </span>
          </div>
        )}
        <span className="text-[9px] text-muted-foreground font-mono">
          {formatTimestamp(buckets[buckets.length - 1].endTime)}
        </span>
      </div>
    </div>
  );
});
