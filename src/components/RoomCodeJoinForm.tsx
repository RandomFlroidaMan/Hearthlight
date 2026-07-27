"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Story-screen landing: type in the room code shown on the DM screen to
 * join that campaign's live session.
 */
export function RoomCodeJoinForm() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/campaigns/room/${encodeURIComponent(code.trim())}`);

    if (!res.ok) {
      setSubmitting(false);
      setError("That code didn't match a session. Double-check and try again.");
      return;
    }

    const json = await res.json();
    router.push(`/story/campaigns/${json.campaignId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col items-center gap-4">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ROOM CODE"
        maxLength={4}
        autoFocus
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-center font-mono text-3xl tracking-[0.3em] text-zinc-50 placeholder:text-zinc-600"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || code.trim().length === 0}
        className="w-fit rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
      >
        {submitting ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
