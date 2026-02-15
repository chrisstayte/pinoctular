'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="h-12 w-12 rounded-lg bg-log-error/10 border border-log-error/20 flex items-center justify-center mx-auto">
          <span className="text-lg font-bold text-log-error">!</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering. Your log data is safe in localStorage.
          </p>
        </div>
        {error.message && (
          <pre className="text-xs text-left bg-secondary border border-border rounded-lg p-3 overflow-auto max-h-32 text-log-error font-mono">
            {error.message}
          </pre>
        )}
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    </div>
  );
}
