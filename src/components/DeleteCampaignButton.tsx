"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** A small "×" that asks for one confirming click before it actually
 * deletes — no modal, since this sits inline in a list row and a whole
 * dialog would be overkill for an action this reversible-feeling-but-
 * actually-isn't (there's no undo). */
export function DeleteCampaignButton({ campaignId, label }: { campaignId: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-2 text-xs">
        <span className="text-zinc-500">Delete {label}?</span>
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-full border border-red-800 px-2 py-1 text-red-400 hover:bg-red-950/40 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirming(true);
      }}
      aria-label={`Delete ${label}`}
      title="Delete this story"
      className="shrink-0 rounded-full px-2 py-1 text-xs text-zinc-600 hover:bg-red-950/30 hover:text-red-400"
    >
      ✕
    </button>
  );
}
