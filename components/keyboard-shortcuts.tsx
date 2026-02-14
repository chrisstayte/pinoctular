"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts = [
  { keys: ["j"], desc: "Next row" },
  { keys: ["k"], desc: "Previous row" },
  { keys: ["Enter"], desc: "Expand/collapse selected row" },
  { keys: ["/"], desc: "Focus search" },
  { keys: ["Escape"], desc: "Clear search / close panels" },
  { keys: ["b"], desc: "Bookmark selected row" },
  { keys: ["c"], desc: "Copy selected row as JSON" },
  { keys: ["e"], desc: "Export filtered logs" },
  { keys: ["1–6"], desc: "Toggle log level (trace–fatal)" },
  { keys: ["?"], desc: "Show this help" },
]

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Navigate and control the log viewer with keyboard shortcuts
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1 py-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.desc}
              className="flex items-center justify-between py-1.5 px-1"
            >
              <span className="text-xs text-foreground">{shortcut.desc}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-mono font-medium bg-secondary border border-border rounded text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
