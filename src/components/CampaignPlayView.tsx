"use client";

import { useState } from "react";
import Image from "next/image";
import { useCampaignSync } from "@/lib/useCampaignSync";
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
 * compute server-side, so the group sees the math immediately without
 * waiting on the round trip. The server result is always the authoritative
 * one — this never decides the actual outcome.
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

export type PartyMember = {
  id: string;
  label: string;
  skills: Skills;
  readingAge: number;
};

type DraftRoll = { raw: string; raw2: string; mode: RollMode };

function emptyDraft(): DraftRoll {
  return { raw: "", raw2: "", mode: "normal" };
}

export function CampaignPlayView({
  campaignId,
  roomCode,
  initialScene,
  party,
  dmFudgeEnabled,
  /** Full operator mode (the original DM screen): private DM notes, room
   * code, regenerate/force-ending/direction tools. Off for the single-
   * screen family mode, where nobody is "running" the game for anyone
   * else. */
  showDmTools = true,
}: {
  campaignId: string;
  roomCode: string;
  initialScene: SceneData;
  /** The whole party — one row of roll inputs per member when a check comes up. */
  party: PartyMember[];
  dmFudgeEnabled: boolean;
  showDmTools?: boolean;
}) {
  const [scene, setScene] = useState(initialScene);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState("");
  const [editingProse, setEditingProse] = useState(false);
  const [proseDraft, setProseDraft] = useState(initialScene.prose);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftRoll>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);

  /** Applies a new scene whether it came from this screen's own PATCH
   * response or a WebSocket broadcast — the *only* way a beat this screen
   * itself requested ever arrives now, since generation runs in the
   * background (see postBeat). Resets in-progress roll/edit state, and
   * clears the busy/waiting flag, only when it's actually a different
   * scene — a fudge/roll panel referencing the old scene's choices would
   * otherwise dangle against the new one's, and a same-scene refetch (on
   * initial load or reconnect) shouldn't interrupt anything in flight. */
  function applySceneUpdate(newScene: SceneData) {
    // Cleared unconditionally, not just on an id change: "regenerate"
    // updates the *same* scene row in place rather than creating a new
    // one, so an id comparison alone would never clear the waiting state
    // for that action.
    setBusy(false);
    setScene((prev) => {
      if (newScene.id !== prev.id) {
        setPendingChoiceIndex(null);
        setDrafts({});
        setLastResult(null);
        setEditingProse(false);
      }
      setProseDraft(newScene.prose);
      return newScene;
    });
  }

  useCampaignSync<SceneData>({
    campaignId,
    roomCode,
    onScene: applySceneUpdate,
    onGenerationFailed: (message) => {
      setBusy(false);
      setError(message);
    },
  });

  /** Fires the request and returns — the actual next scene always arrives
   * via the WebSocket broadcast (from this screen's own request or
   * another screen's), never from this response directly. Generation
   * happens in the background server-side specifically so this doesn't
   * have to sit on an open HTTP request for 15-30 seconds, which was long
   * enough to trip a host's own proxy timeout. `busy` stays true until
   * applySceneUpdate or the generation_failed handler above clears it. */
  async function postBeat(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/beats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setBusy(false);
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? json.error ?? "Something went wrong generating that beat.");
    }
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
    applySceneUpdate(json.scene);
    setEditingProse(false);
  }

  function pickChoice(index: number) {
    const choice = scene.choices[index];
    if (!choice.skill || choice.dc === null) {
      postBeat({ choiceIndex: index });
      return;
    }
    setPendingChoiceIndex(index);
    setDrafts(Object.fromEntries(party.map((p) => [p.id, emptyDraft()])));
    setLastResult(null);
  }

  function updateDraft(characterId: string, patch: Partial<DraftRoll>) {
    setDrafts((prev) => ({ ...prev, [characterId]: { ...(prev[characterId] ?? emptyDraft()), ...patch } }));
  }

  function submitRoll() {
    if (pendingChoiceIndex === null) return;
    const choice = scene.choices[pendingChoiceIndex];
    if (!choice.skill || choice.dc === null) return;

    const rolls: Array<{ characterId: string; raw: number; raw2?: number; mode?: RollMode }> = [];
    const previews: string[] = [];
    let anySuccess = false;

    for (const member of party) {
      const draft = drafts[member.id] ?? emptyDraft();
      const rawNum = Number(draft.raw);
      if (!Number.isInteger(rawNum) || rawNum < 1 || rawNum > 20) {
        setError(`Enter what ${member.label}'s d20 showed — a number 1-20.`);
        return;
      }
      const raw2Num = draft.raw2 ? Number(draft.raw2) : undefined;
      const complexity = previewComplexity(member.readingAge);

      const preview = previewRoll({
        raw: rawNum,
        raw2: raw2Num,
        mode: draft.mode,
        modifier: choice.skill ? member.skills[choice.skill] : 0,
        useModifier: complexity.useModifier,
        dc: choice.dc ?? 0,
      });
      if (preview.success) anySuccess = true;
      previews.push(
        `${member.label}: ${preview.effectiveRaw}${preview.modifier ? ` + ${preview.modifier}` : ""} = ${preview.total}${preview.isNatural20 ? " (Natural 20!)" : ""}${preview.isNatural1 ? " (Natural 1)" : ""}`,
      );

      rolls.push({ characterId: member.id, raw: rawNum, raw2: raw2Num, mode: draft.mode });
    }

    // A quick local preview only — same "any party member succeeds" rule
    // as the server's resolvePartyRoll, but the server's result (reflected
    // once the new scene arrives) is always the authoritative one.
    setLastResult(`${previews.join(" · ")} — vs DC ${choice.dc} — ${anySuccess ? "Success!" : "Setback."}`);

    postBeat({ choiceIndex: pendingChoiceIndex, roll: rolls });
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
        {showDmTools && (
          <span className="ml-auto rounded-full border border-amber-700 bg-amber-950/40 px-3 py-1 font-mono text-amber-300">
            Room code: {roomCode}
          </span>
        )}
      </div>

      {scene.imagePath && (
        <Image
          src={publicImageUrl(scene.imagePath)}
          alt="Current scene"
          width={768}
          height={432}
          priority
          className={`rounded-md object-cover ${busy ? "image-breathe" : ""}`}
        />
      )}

      {busy && (
        <div className="flex items-center gap-2 text-sm text-amber-200/80">
          <span className="lantern-glow h-2.5 w-2.5 rounded-full bg-amber-300" aria-hidden="true" />
          <span>Working on the next beat&hellip;</span>
        </div>
      )}

      {showDmTools && editingProse ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={proseDraft}
            onChange={(e) => setProseDraft(e.target.value)}
            rows={3}
            aria-label="Edit scene prose"
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
          {showDmTools && (
            <button
              onClick={() => setEditingProse(true)}
              className="shrink-0 text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              edit
            </button>
          )}
        </div>
      )}

      {showDmTools && scene.dmNotes && (
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
                  ({choice.skill} DC {choice.dc}
                  {party.length > 0 &&
                    " — " +
                      party
                        .map((p) => `${p.label} ${p.skills[choice.skill!] >= 0 ? "+" : ""}${p.skills[choice.skill!]}`)
                        .join(", ")}
                  )
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {pendingChoice && pendingChoice.skill && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-700 bg-amber-950/30 p-4">
          <p className="text-sm">
            {pendingChoice.text} — {pendingChoice.skill} check, DC {pendingChoice.dc}. Everyone rolls!
          </p>

          {party.map((member) => {
            const complexity = previewComplexity(member.readingAge);
            const draft = drafts[member.id] ?? emptyDraft();
            return (
              <div key={member.id} className="flex flex-wrap items-center gap-2">
                <span className="w-24 shrink-0 text-sm text-zinc-300">{member.label}</span>
                {complexity.allowAdvantage && (
                  <select
                    value={draft.mode}
                    onChange={(e) => updateDraft(member.id, { mode: e.target.value as RollMode })}
                    aria-label={`${member.label} roll mode`}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="advantage">Advantage</option>
                    <option value="disadvantage">Disadvantage</option>
                  </select>
                )}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.raw}
                  onChange={(e) => updateDraft(member.id, { raw: e.target.value })}
                  placeholder="d20"
                  aria-label={`${member.label} first d20 roll`}
                  className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-center"
                />
                {draft.mode !== "normal" && (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={draft.raw2}
                    onChange={(e) => updateDraft(member.id, { raw2: e.target.value })}
                    placeholder="d20 #2"
                    aria-label={`${member.label} second d20 roll`}
                    className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-center"
                  />
                )}
              </div>
            );
          })}

          <div className="flex gap-2">
            <button
              onClick={submitRoll}
              disabled={busy}
              className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
            >
              Resolve roll
            </button>
          </div>

          {dmFudgeEnabled && showDmTools && (
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
        {showDmTools && (
          <button
            disabled={busy}
            onClick={() => postBeat({ regenerate: true })}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
          >
            Regenerate this beat
          </button>
        )}
        {showDmTools && !scene.isEnding && (
          <button
            disabled={busy}
            onClick={() => postBeat({ forceEnding: true })}
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
          >
            Force an ending
          </button>
        )}
        <a
          href={`/api/campaigns/${campaignId}/keepsake`}
          download
          className="rounded-full border border-amber-700 px-4 py-2 text-sm text-amber-300 hover:bg-amber-950/30"
        >
          Download keepsake
        </a>
        {showDmTools && (
          <div className="flex flex-1 gap-2">
            <input
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="Inject a direction (e.g. bring back the fox)"
              aria-label="Inject a story direction"
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
        )}
      </div>
    </div>
  );
}
