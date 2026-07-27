"use client";

/** App-wide error boundary (DM screens, forms, library pages). Next 16's
 * error.tsx convention: unstable_retry() re-fetches and re-renders the
 * boundary's children in place, so a transient failure doesn't force a
 * full page reload — see error.js version history (unstable_retry added
 * in 16.2.0, replacing reset() as the recommended recovery function). */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">Something went wrong.</h2>
      <p className="max-w-md text-sm text-zinc-500">
        {error.digest ? `Error reference: ${error.digest}` : "Please try again."}
      </p>
      <button
        onClick={() => unstable_retry()}
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Try again
      </button>
    </div>
  );
}
