"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 2500;

/**
 * Shown while a brand-new campaign's opening beat is still generating in
 * the background (see POST /api/campaigns — this used to be an inline
 * await, which was slow enough to trip a host's proxy timeout). Polls for
 * the first scene and swaps to the real view via router.refresh() the
 * moment it exists, or shows a plain error if generation failed.
 */
export function FirstSceneWaiter({ campaignId, backHref }: { campaignId: string; backHref: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.scene) {
          router.refresh();
          return;
        }
        if (json.campaign?.status === "failed") {
          setFailed("Something went wrong starting this adventure.");
        }
      } catch {
        // Best-effort — just try again on the next tick.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId, router]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-red-400">{failed}</p>
        <Link href={backHref} className="text-sm text-zinc-400 underline hover:text-zinc-200">
          Try starting a new adventure
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="lantern-glow h-3 w-3 rounded-full bg-amber-300" aria-hidden="true" />
      <p className="text-lg text-amber-200/80">Writing the opening scene&hellip;</p>
      <p className="max-w-sm text-sm text-zinc-500">
        This can take up to about 30 seconds the first time — art and narration are both being generated.
      </p>
    </div>
  );
}
