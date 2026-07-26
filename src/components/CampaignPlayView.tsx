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

/**
 * Display-only preview of what src/server/dice/rollResolution.ts will
 * compute server-side, so the DM sees the math immediately without waiting
 * on the round trip. The server result is always the authoritative one —
 * this never decides the actual outcome.
 */
type RollMode = "normal" | "advantage" | "disadvantage";

function previewComplexity(readingAge: number): { useModifier: boolean; allowAdvantage: boolean } {
  if (readingAge <= 3) return { useModifier: false, allowAdvantage: false };
  if (readingAge <= 5) return { useModifier: true, allowAdvantage: false };
  return { useModifier: true, allowAdvantage: true };
}

function previewRoll(params: {
  raw: number;
  raw2?: number;
  mode: RollMode;
  modifier: number;
  useModifier: boolean;
  dc: number;
}) {
  let effectiveRaw = params.raw;
  if (params.raw2 !== undefined) {
    if (params.mode === "advantage") effectiveRaw = Math.max(params.raw, params.raw2);
    else if (params.mode === "disadvantage") effectiveRaw = Math.min(params.raw, params.raw2);
  }
  const isNatural20 = effectiveRaw === 20;
  const isNatural1 = effectiveRaw === 1;
  const modifier = params.useModifier ? params.modifier : 0;
  const total = effectiveRaw + modifier;
  const success = isNatural20 ? true : isNatural1 ? false : total >= params.dc;
  return { effectiveRaw, modifier, total, success, isNatural20, isNatural1 };
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

type Skills = { might: number; magic: number; cunning: number; heart: number };

export function CampaignPlayView({
  campaignId,
  initialScene,
  readingAge,
  skills,
  dmFudgeEnabled,
}: {
  campaignId: string;
  initialScene: SceneData;
  readingAge: number;
  skills: Skills;
  dmFudgeEnabled: boolean;
}) {
  const [scene, setScene] = useState(initialScene);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState("");
  const [editingProse, setEditingProse] = useState(false);
  const [proseDraft, setProseDraft] = useState(initialScene.prose);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(null);
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [raw, setRaw] = useState("");
  const [raw2, setRaw2] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const complexity = previewComplexity(readingAge);

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
    setPendingChoiceIndex(null);
    setRaw("");
    setRaw2("");
    setRollMode("normal");
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

  function pickChoice(index: number) {
    const choice = scene.choices[index];
    if (!choice.skill || choice.dc === null) {
      postBeat({ choiceIndex: index });
      return;
    }
    setPendingChoiceIndex(index);
    setLastResult(null);
  }

  function submitRoll() {
    if (pendingChoiceIndex === null) return;
    const choice = scene.choices[pendingChoiceIndex];
    const rawNum = Number(raw);
    if (!Number.isInteger(rawNum) || rawNum < 1 || rawNum > 20) {
      setError("Enter what the d20 showed — a number 1-20.");
      return;
    }
    const raw2Num = raw2 ? Number(raw2) : undefined;

    const preview = previewRoll({
      raw: rawNum,
      raw2: raw2Num,
      mode: rollMode,
      modifier: choice.skill ? skills[choice.skill] : 0,
      useModifier: complexity.useModifier,
      dc: choice.dc ?? 0,
    });
    setLastResult(
      `Rolled ${preview.effectiveRaw}${preview.modifier ? ` + ${preview.modifier}` : ""} = ${preview.total} vs DC ${choice.dc} — ${preview.success ? "Success!" : "Setback."}${preview.isNatural20 ? " Natural 20!" : ""}${preview.isNatural1 ? " Natural 1." : ""}`,
    );

    postBeat({
      choiceIndex: pendingChoiceIndex,
      roll: { raw: rawNum, raw2: raw2Num, mode: rollMode },
    });
  }

  function fudge(outcome: "success" | "failure") {
    if (pendingChoiceIndex === null) return;
    postBeat({ choiceIndex: pendingChoiceIndex, fudge: outcome });
  }

  const pendingChoice = pendingChoiceIndex !== null ? scene.choices[pendingChoiceIndex] : null;

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

      {lastResult && <p className="text-sm text-amber-300">{lastResult}</p>}

      {!scene.isEnding && (
        <div className="flex flex-col gap-2">
          {scene.choices.map((choice, i) => (
            <button
              key={i}
              disabled={busy}
              onClick={() => pickChoice(i)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-left hover:bg-zinc-800 disabled:opacity-50"
            >
              <span>{choice.text}</span>
              {choice.skill && choice.dc && (
                <span className="ml-2 text-xs text-zinc-500">
                  ({choice.skill} DC {choice.dc}, your modifier {skills[choice.skill] >= 0 ? "+" : ""}
                  {skills[choice.skill]})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {pendingChoice && pendingChoice.skill && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-700 bg-amber-950/30 p-4">
          <p className="text-sm">
            {pendingChoice.text} — {pendingChoice.skill} check, DC {pendingChoice.dc}. What did the d20 show?
          </p>

          {complexity.allowAdvantage && (
            <select
              value={rollMode}
              onChange={(e) => setRollMode(e.target.value as RollMode)}
              className="w-fit rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="advantage">Advantage (roll twice, take higher)</option>
              <option value="disadvantage">Disadvantage (roll twice, take lower)</option>
            </select>
          )}

          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={20}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="d20"
              className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-center"
            />
            {rollMode !== "normal" && (
              <input
                type="number"
                min={1}
                max={20}
                value={raw2}
                onChange={(e) => setRaw2(e.target.value)}
                placeholder="d20 #2"
                className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-center"
              />
            )}
            <button
              onClick={submitRoll}
              disabled={busy}
              className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
            >
              Resolve roll
            </button>
          </div>

          {dmFudgeEnabled && (
            <div className="flex gap-2 border-t border-amber-800 pt-2">
              <span className="text-xs text-amber-400">DM fudge:</span>
              <button
                onClick={() => fudge("success")}
                disabled={busy}
                className="text-xs underline hover:text-amber-200"
              >
                Force success
              </button>
              <button
                onClick={() => fudge("failure")}
                disabled={busy}
                className="text-xs underline hover:text-amber-200"
              >
                Force failure
              </button>
            </div>
          )}

          <button
            onClick={() => setPendingChoiceIndex(null)}
            className="w-fit text-xs text-zinc-500 underline hover:text-zinc-300"
          >
            Cancel
          </button>
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
