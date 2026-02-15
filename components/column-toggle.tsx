'use client';

import { Columns3, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  type TableColumn,
  ALL_COLUMNS,
  COLUMN_LABELS,
} from '@/lib/log-types';

interface ColumnToggleProps {
  visibleColumns: Set<TableColumn>;
  onToggleColumn: (column: TableColumn) => void;
  hasMultipleSources: boolean;
}

export function ColumnToggle({
  visibleColumns,
  onToggleColumn,
  hasMultipleSources,
}: ColumnToggleProps) {
  const columns = hasMultipleSources
    ? ALL_COLUMNS
    : ALL_COLUMNS.filter((c) => c !== 'source');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1"
          title="Toggle columns"
        >
          <Columns3 className="h-3 w-3" />
          <span className="hidden xl:inline">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Visible Columns
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={visibleColumns.has(column)}
            onCheckedChange={() => onToggleColumn(column)}
            className="text-xs"
          >
            {COLUMN_LABELS[column]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
