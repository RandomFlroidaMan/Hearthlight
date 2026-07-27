"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

export function NewCampaignForm({
  characters,
  worldSettings,
}: {
  characters: Option[];
  worldSettings: Option[];
}) {
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const [worldSettingId, setWorldSettingId] = useState(worldSettings[0]?.id ?? "");
  const [tone, setTone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterIds: [characterId], worldSettingId, tone: tone || null }),
    });

    if (!res.ok) {
      setSubmitting(false);
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? json.error ?? "Couldn't start this campaign.");
      return;
    }

    const json = await res.json();
    router.push(`/dm/campaigns/${json.campaign.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6 text-zinc-50">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Character</span>
        <select
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        >
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">World setting</span>
        <select
          value={worldSettingId}
          onChange={(e) => setWorldSettingId(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        >
          {worldSettings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Tone (optional)</span>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="e.g. cozy and slow, or a little more adventurous"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !characterId || !worldSettingId}
        className="w-fit rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
      >
        {submitting ? "Starting the adventure…" : "Start adventure"}
      </button>
    </form>
  );
}
