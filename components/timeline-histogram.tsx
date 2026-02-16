'use client';

import { useMemo, useState, useRef, useEffect, memo } from 'react';
import {
  type SourcedLogEntry,
  type LogLevel,
  buildTimeline,
  formatGraphTimestamp,
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

  const rangeIndices = useMemo((): [number, number] | null => {
    if (!timeRange) return null;
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].startTime >= timeRange[0] && startIdx === -1) startIdx = i;
      if (buckets[i].endTime <= timeRange[1]) endIdx = i;
    }
    if (startIdx === -1 || endIdx === -1) return null;
    return [startIdx, endIdx];
  }, [timeRange, buckets]);

  const isTouchDevice = useRef(false);

  // Refs for values accessed inside the drag effect's event handlers.
  // This lets us keep the effect dependency list minimal (only dragState)
  // while still reading current values inside the handlers.
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const rangeIndicesRef = useRef(rangeIndices);
  rangeIndicesRef.current = rangeIndices;
  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;
  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;
  const onTimeRangeChangeRef = useRef(onTimeRangeChange);
  onTimeRangeChangeRef.current = onTimeRangeChange;

  const isNearEdge = (clientX: number): 'start' | 'end' | null => {
    if (!rangeIndices || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const startPx = (rangeIndices[0] / buckets.length) * rect.width;
    const endPx = ((rangeIndices[1] + 1) / buckets.length) * rect.width;
    const x = clientX - rect.left;
    const threshold = isTouchDevice.current ? 24 : 8;
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
    const pad = isTouchDevice.current ? 24 : 8;
    return x >= startPx + pad && x <= endPx - pad;
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

  const beginDrag = (clientX: number) => {
    const edge = isNearEdge(clientX);
    const index = getIndexFromX(clientX);

    if (edge === 'start' && rangeIndices) {
      setDragState({
        type: 'drag-start',
        startX: clientX,
        startIndex: rangeIndices[0],
        currentIndex: rangeIndices[0],
        originalRange: timeRange!,
      });
    } else if (edge === 'end' && rangeIndices) {
      setDragState({
        type: 'drag-end',
        startX: clientX,
        startIndex: rangeIndices[1],
        currentIndex: rangeIndices[1],
        originalRange: timeRange!,
      });
    } else if (isInsideRange(clientX) && rangeIndices) {
      setDragState({
        type: 'drag-range',
        startX: clientX,
        startIndex: index,
        currentIndex: index,
        originalRange: timeRange!,
        dragOffsetIndex: index - rangeIndices[0],
      });
    } else {
      setDragState({
        type: 'selecting',
        startX: clientX,
        startIndex: index,
        currentIndex: index,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isTouchDevice.current = false;
    beginDrag(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isTouchDevice.current = true;
    const touch = e.touches[0];
    beginDrag(touch.clientX);
  };

  // Global mouse/touch events for drag operations.
  // Only depends on whether a drag is active (boolean) to avoid
  // re-registering listeners on every state change during drag.
  const isDragging = dragState !== null;
  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (clientX: number) => {
      const index = getIndexFromX(clientX);
      setHoverX(getRelativeX(clientX));
      setHoverIndex(index);

      setDragState((prev) => {
        if (!prev) return null;
        return { ...prev, currentIndex: index };
      });

      // Read current values from refs to avoid stale closures
      const ds = dragStateRef.current;
      const ri = rangeIndicesRef.current;
      const b = bucketsRef.current;
      const onChange = onTimeRangeChangeRef.current;

      if (!ds) return;

      if (ds.type === 'selecting') {
        const start = Math.min(ds.startIndex, index);
        const end = Math.max(ds.startIndex, index);
        onChange([b[start].startTime, b[end].endTime]);
      } else if (ds.type === 'drag-start' && ri) {
        const newStart = Math.min(index, ri[1]);
        onChange([b[newStart].startTime, b[ri[1]].endTime]);
      } else if (ds.type === 'drag-end' && ri) {
        const newEnd = Math.max(index, ri[0]);
        onChange([b[ri[0]].startTime, b[newEnd].endTime]);
      } else if (
        ds.type === 'drag-range' &&
        ri &&
        ds.dragOffsetIndex !== undefined
      ) {
        const rangeLen = ri[1] - ri[0];
        let newStart = index - ds.dragOffsetIndex;
        newStart = Math.max(0, Math.min(newStart, b.length - 1 - rangeLen));
        const newEnd = newStart + rangeLen;
        onChange([b[newStart].startTime, b[newEnd].endTime]);
      }
    };

    const handleDragEnd = () => {
      const ds = dragStateRef.current;
      const tr = timeRangeRef.current;
      const b = bucketsRef.current;
      const onChange = onTimeRangeChangeRef.current;

      if (ds && ds.type === 'selecting' && ds.startIndex === ds.currentIndex) {
        const bucket = b[ds.startIndex];
        if (
          tr &&
          tr[0] === bucket.startTime &&
          tr[1] === bucket.endTime
        ) {
          onChange(null);
        } else {
          onChange([bucket.startTime, bucket.endTime]);
        }
      }
      setDragState(null);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const handleGlobalMouseUp = () => handleDragEnd();
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      handleDragMove(e.touches[0].clientX);
    };
    const handleGlobalTouchEnd = () => handleDragEnd();

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalTouchMove, {
      passive: false,
    });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  // Early return after all hooks
  if (buckets.length <= 1) return null;

  const hoverBucket = hoverIndex !== null ? buckets[hoverIndex] : null;
  const hoverLabel = hoverBucket ? formatGraphTimestamp(hoverBucket.startTime) : null;

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
        className="relative h-12 touch-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
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
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-4 h-8 rounded-sm bg-primary border border-primary-foreground/20 shadow-md flex items-center justify-center">
                <div className="flex gap-px">
                  <div className="w-px h-2.5 bg-primary-foreground/50 rounded-full" />
                  <div className="w-px h-2.5 bg-primary-foreground/50 rounded-full" />
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
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-4 h-8 rounded-sm bg-primary border border-primary-foreground/20 shadow-md flex items-center justify-center">
                <div className="flex gap-px">
                  <div className="w-px h-2.5 bg-primary-foreground/50 rounded-full" />
                  <div className="w-px h-2.5 bg-primary-foreground/50 rounded-full" />
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
        {hoverX !== null && hoverBucket && hoverLabel && (
          <div
            className="absolute -top-8 pointer-events-none z-30 transform -translate-x-1/2"
            style={{ left: `${hoverX}px` }}
          >
            <div className="bg-popover border border-border text-popover-foreground text-[10px] font-mono px-2 py-1 rounded shadow-md whitespace-nowrap">
              <span className="font-semibold">{hoverLabel.date}</span>{' '}
              {hoverLabel.time} &middot; {hoverBucket.total} entries
            </div>
          </div>
        )}
      </div>

      {/* Time labels */}
      <div className="flex justify-between items-start mt-1">
        <div className="font-mono text-muted-foreground">
          <div className="text-[11px] font-medium">{formatGraphTimestamp(buckets[0].startTime).date}</div>
          <div className="text-[10px]">{formatGraphTimestamp(buckets[0].startTime).time}</div>
        </div>
        {rangeIndices && (
          <div className="flex items-center gap-1.5 text-center">
            <div className="font-mono text-primary">
              <div className="text-[11px] font-semibold">{formatGraphTimestamp(buckets[rangeIndices[0]].startTime).date}</div>
              <div className="text-[10px] font-medium">{formatGraphTimestamp(buckets[rangeIndices[0]].startTime).time}</div>
            </div>
            <span className="text-[10px] text-muted-foreground">&mdash;</span>
            <div className="font-mono text-primary">
              <div className="text-[11px] font-semibold">{formatGraphTimestamp(buckets[rangeIndices[1]].endTime).date}</div>
              <div className="text-[10px] font-medium">{formatGraphTimestamp(buckets[rangeIndices[1]].endTime).time}</div>
            </div>
          </div>
        )}
        <div className="font-mono text-muted-foreground text-right">
          <div className="text-[11px] font-medium">{formatGraphTimestamp(buckets[buckets.length - 1].endTime).date}</div>
          <div className="text-[10px]">{formatGraphTimestamp(buckets[buckets.length - 1].endTime).time}</div>
        </div>
      </div>
    </div>
  );
});
