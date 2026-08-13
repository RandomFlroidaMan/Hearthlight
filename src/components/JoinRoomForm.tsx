"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CharacterOption = { id: string; name: string; displayName: string | null };

/**
 * Bring your own character into someone else's game — the room-code
 * counterpart to starting a fresh adventure. Anyone who knows the code can
 * join, from any family, with any of their own characters (a Klingon
 * showing up in a fantasy party, say).
 */
export function JoinRoomForm({ characters }: { characters: CharacterOption[] }) {
  const [code, setCode] = useState("");
  const [characterIds, setCharacterIds] = useState<string[]>(characters[0] ? [characters[0].id] : []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggleCharacter(id: string) {
    setCharacterIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const roomRes = await fetch(`/api/campaigns/room/${encodeURIComponent(code.trim())}`);
    if (!roomRes.ok) {
      setSubmitting(false);
      setError("That code didn't match a session. Double-check and try again.");
      return;
    }
    const { campaignId } = await roomRes.json();

    const joinRes = await fetch(`/api/campaigns/${campaignId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterIds }),
    });
    setSubmitting(false);

    if (!joinRes.ok) {
      const json = await joinRes.json().catch(() => ({}));
      setError(json.message ?? "Couldn't join that adventure.");
      return;
    }

    router.push(`/play/campaigns/${campaignId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-6">
      <label className="flex flex-col items-center gap-2">
        <span className="text-sm text-zinc-400">Room code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          aria-label="Room code"
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-center font-mono text-3xl tracking-[0.3em] text-zinc-50 placeholder:text-zinc-600"
        />
      </label>

      {characters.length === 0 ? (
        <p className="text-sm text-amber-400">You need a character first — create one before joining.</p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-zinc-400">Which of your characters are joining?</legend>
          {characters.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={characterIds.includes(c.id)}
                onChange={() => toggleCharacter(c.id)}
              />
              <span>{c.displayName ?? c.name}</span>
            </label>
          ))}
        </fieldset>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || code.trim().length === 0 || characterIds.length === 0}
        className="w-fit rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
      >
        {submitting ? "Joining…" : "Join adventure"}
      </button>
    </form>
  );
}
