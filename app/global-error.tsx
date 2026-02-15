'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="h-12 w-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <span className="text-lg font-bold text-red-500">!</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="text-sm text-gray-500">
                An unexpected error occurred. Your log data is safe in localStorage.
              </p>
            </div>
            {error.message && (
              <pre className="text-xs text-left bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 overflow-auto max-h-32 text-red-600 dark:text-red-400 font-mono">
                {error.message}
              </pre>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
