"use client";

import { useState } from "react";
import Image from "next/image";

// Trivial and duplicated on purpose rather than imported: the real
// publicImageUrl lives in src/server/art/imageStore.ts, which is
// server-only and must not be pulled into client bundles.
function publicImageUrl(filename: string): string {
  return `/api/images/${filename}`;
}

const DEFAULT_PROMPTS = [
  "Arriving at the edge of town for the first time, looking up in wonder.",
  "Exploring a narrow market alley between leaning wooden houses.",
  "Meeting a friendly local at their doorway.",
  "Resting at dusk as lanterns are lit across the town.",
  "Standing at the very edge, looking out over the water below.",
];

type CharacterOption = { id: string; name: string };
type WorldSettingOption = { id: string; name: string };

type SceneResult = { prompt: string; filename: string; fromFallback: boolean };

export function ArtConsistencyTest({
  characters,
  worldSettings,
}: {
  characters: CharacterOption[];
  worldSettings: WorldSettingOption[];
}) {
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const [worldSettingId, setWorldSettingId] = useState(worldSettings[0]?.id ?? "");
  const [prompts, setPrompts] = useState<string[]>(DEFAULT_PROMPTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portraitFilename, setPortraitFilename] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneResult[]>([]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setScenes([]);

    const res = await fetch("/api/art-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, worldSettingId, scenePrompts: prompts }),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? json.error ?? "Generation failed.");
      return;
    }

    const json = await res.json();
    setPortraitFilename(json.portraitFilename);
    setScenes(json.scenes);
  }

  return (
    <div className="flex flex-col gap-6 text-zinc-50">
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-zinc-400">Scene prompts</span>
        {prompts.map((prompt, i) => (
          <input
            key={i}
            value={prompt}
            onChange={(e) =>
              setPrompts((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
            }
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
        ))}
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !characterId || !worldSettingId}
        className="w-fit rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
      >
        {loading ? "Generating (this takes a while)…" : "Generate 5 test scenes"}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {portraitFilename && (
        <div>
          <p className="mb-2 text-sm text-zinc-400">Character reference portrait</p>
          <Image
            src={publicImageUrl(portraitFilename)}
            alt="Character portrait"
            width={256}
            height={256}
            className="rounded-md object-cover"
          />
        </div>
      )}

      {scenes.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-zinc-400">Generated scenes</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {scenes.map((scene, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Image
                  src={publicImageUrl(scene.filename)}
                  alt={scene.prompt}
                  width={512}
                  height={288}
                  className="rounded-md object-cover"
                />
                <p className="text-xs text-zinc-500">
                  {scene.prompt}
                  {scene.fromFallback && (
                    <span className="ml-2 text-amber-400">(fallback image — generation failed)</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
