'use client'

import { useState } from 'react'
import { FolderOpen, FileText, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { WatchedFolder } from '@/lib/watch-api'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface WatchedFolderCardProps {
  folder: WatchedFolder
  onSelect: (folder: WatchedFolder) => void
}

export function WatchedFolderCard({ folder, onSelect }: WatchedFolderCardProps) {
  const [loading, setLoading] = useState(false)

  const totalSize = folder.files.reduce((sum, f) => sum + f.size, 0)
  const fileCount = folder.files.length

  const handleClick = () => {
    setLoading(true)
    onSelect(folder)
  }

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 shrink-0">
            {loading ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <FolderOpen className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-foreground truncate">
              {folder.name}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {fileCount} {fileCount === 1 ? 'file' : 'files'}
              </span>
              {totalSize > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatSize(totalSize)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
