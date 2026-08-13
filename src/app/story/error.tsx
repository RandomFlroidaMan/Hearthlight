"use client";

/** Error boundary for the kid-facing story screen only — same dark stage
 * and warm lantern-glow language as the loading state, so a crash doesn't
 * suddenly flash a jarring default error page mid-adventure. Never shows
 * the raw error message here (that's for the DM to see server-side via
 * error.digest, not for the story screen). */
export default function StoryError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-center text-zinc-50">
      <span className="lantern-glow h-4 w-4 rounded-full bg-amber-300" aria-hidden="true" />
      <p className="max-w-md text-2xl">The story took a little nap.</p>
      <button
        onClick={() => unstable_retry()}
        className="rounded-full bg-zinc-50 px-6 py-3 text-lg font-medium text-zinc-950 hover:bg-zinc-200"
      >
        Wake it back up
      </button>
    </div>
  );
}
