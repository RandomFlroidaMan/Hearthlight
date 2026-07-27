"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Adventure } from "@/lib/adventures";

type CharacterOption = { id: string; name: string; displayName: string | null };
type WorldSettingOption = { id: string; name: string };

export function PartyCampaignForm({
  characters,
  adventures,
  worldSettings,
}: {
  characters: CharacterOption[];
  adventures: Adventure[];
  worldSettings: WorldSettingOption[];
}) {
  const [characterIds, setCharacterIds] = useState<string[]>(characters[0] ? [characters[0].id] : []);
  const [source, setSource] = useState<"adventure" | "custom">("adventure");
  const [adventureId, setAdventureId] = useState(adventures[0]?.id ?? "");
  const [worldSettingId, setWorldSettingId] = useState(worldSettings[0]?.id ?? "");
  const [tone, setTone] = useState("");
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

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterIds,
        ...(source === "adventure" ? { adventureId } : { worldSettingId }),
        tone: tone || null,
      }),
    });

    if (!res.ok) {
      setSubmitting(false);
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? json.error ?? "Couldn't start this adventure.");
      return;
    }

    const json = await res.json();
    router.push(`/play/campaigns/${json.campaign.id}`);
  }

  const canSubmit =
    characterIds.length > 0 && (source === "adventure" ? Boolean(adventureId) : Boolean(worldSettingId));

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6 text-zinc-50">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-zinc-400">Who&apos;s playing? (pick everyone joining)</legend>
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

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm text-zinc-400">Pick a story</legend>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSource("adventure")}
            className={`rounded-full px-3 py-1 ${source === "adventure" ? "bg-zinc-50 text-zinc-950" : "border border-zinc-700 text-zinc-400"}`}
          >
            Choose a prebuilt story
          </button>
          <button
            type="button"
            onClick={() => setSource("custom")}
            className={`rounded-full px-3 py-1 ${source === "custom" ? "bg-zinc-50 text-zinc-950" : "border border-zinc-700 text-zinc-400"}`}
          >
            Use a saved world setting
          </button>
        </div>

        {source === "adventure" ? (
          <div className="flex flex-col gap-2">
            {adventures.map((a) => (
              <label
                key={a.id}
                className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="adventure"
                    checked={adventureId === a.id}
                    onChange={() => setAdventureId(a.id)}
                  />
                  <span className="font-medium">{a.title}</span>
                </span>
                <span className="pl-6 text-sm text-zinc-400">{a.blurb}</span>
              </label>
            ))}
          </div>
        ) : worldSettings.length === 0 ? (
          <p className="text-sm text-amber-400">No saved world settings yet — pick a prebuilt story instead.</p>
        ) : (
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
        )}
      </fieldset>

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
        disabled={submitting || !canSubmit}
        className="w-fit rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
      >
        {submitting ? "Starting the adventure…" : "Start adventure"}
      </button>
    </form>
  );
}
