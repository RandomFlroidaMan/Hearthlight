"use client";

import { useState } from "react";
import Image from "next/image";
// Type-only import — erased at compile time, so this does not pull
// server-side runtime code (or the OpenAI/Prisma clients it touches) into
// the client bundle. Runtime values from src/server must never be imported
// here; only `import type` is safe.
import type { Choice } from "@/server/storyEngine/beatSchema";

// Trivial and duplicated on purpose rather than imported: the real
// publicImageUrl lives in src/server/art/imageStore.ts, which is
// server-only and must not be pulled into client bundles.
function publicImageUrl(filename: string): string {
  return `/api/images/${filename}`;
}

type SceneData = {
  id: string;
  order: number;
  act: string;
  prose: string;
  imagePath: string | null;
  dmNotes: string | null;
  choices: Choice[];
  isEnding: boolean;
};

export function CampaignPlayView({
  campaignId,
  initialScene,
}: {
  campaignId: string;
  initialScene: SceneData;
}) {
  const [scene, setScene] = useState(initialScene);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState("");
  const [editingProse, setEditingProse] = useState(false);
  const [proseDraft, setProseDraft] = useState(initialScene.prose);

  async function postBeat(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/beats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? json.error ?? "Something went wrong generating that beat.");
      return;
    }

    const json = await res.json();
    setScene(json.scene);
    setProseDraft(json.scene.prose);
  }

  async function saveProse() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prose: proseDraft }),
    });
    setBusy(false);

    if (!res.ok) {
      setError("Couldn't save that edit.");
      return;
    }

    const json = await res.json();
    setScene(json.scene);
    setEditingProse(false);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6 text-zinc-50">
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="rounded-full border border-zinc-700 px-2 py-1">act: {scene.act}</span>
        <span>scene {scene.order}</span>
        {scene.isEnding && <span className="text-amber-400">ending</span>}
      </div>

      {scene.imagePath && (
        <Image
          src={publicImageUrl(scene.imagePath)}
          alt="Current scene"
          width={768}
          height={432}
          className="rounded-md object-cover"
        />
      )}

      {editingProse ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={proseDraft}
            onChange={(e) => setProseDraft(e.target.value)}
            rows={3}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-lg"
          />
          <div className="flex gap-2">
            <button
              onClick={saveProse}
              disabled={busy}
              className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setProseDraft(scene.prose);
                setEditingProse(false);
              }}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg">{scene.prose}</p>
          <button
            onClick={() => setEditingProse(true)}
            className="shrink-0 text-xs text-zinc-500 underline hover:text-zinc-300"
          >
            edit
          </button>
        </div>
      )}

      {scene.dmNotes && (
        <div className="rounded-md border border-purple-900 bg-purple-950/30 p-3 text-sm text-purple-200">
          <p className="mb-1 text-xs uppercase tracking-wide text-purple-400">DM notes (private)</p>
          {scene.dmNotes}
        </div>
      )}

      {!scene.isEnding && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500">
            Choosing resolves as an automatic success for now — real dice resolution lands in Phase 5.
          </p>
          {scene.choices.map((choice, i) => (
            <button
              key={i}
              disabled={busy}
              onClick={() => postBeat({ choiceIndex: i })}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-left hover:bg-zinc-800 disabled:opacity-50"
            >
              <span>{choice.text}</span>
              {choice.skill && choice.dc && (
                <span className="ml-2 text-xs text-zinc-500">
                  ({choice.skill} DC {choice.dc})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
        <button
          disabled={busy}
          onClick={() => postBeat({ regenerate: true })}
          className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
        >
          Regenerate this beat
        </button>
        {!scene.isEnding && (
          <button
            disabled={busy}
            onClick={() => postBeat({ forceEnding: true })}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
          >
            Force an ending
          </button>
        )}
        <div className="flex flex-1 gap-2">
          <input
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="Inject a direction (e.g. bring back the fox)"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !direction}
            onClick={() => {
              postBeat({ direction });
              setDirection("");
            }}
            className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
