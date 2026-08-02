"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  /** Whether the logged-in family is the one that started this campaign —
   * gates the "full editing power" tools (replace art, add a character,
   * author a custom beat) that any room-code guest shouldn't get. */
  isOwner = false,
  /** The owning family's own characters not already in this party — the
   * pool "add a character" can pick from. */
  availableCharacters = [],
}: {
  campaignId: string;
  roomCode: string;
  initialScene: SceneData;
  /** The whole party — one row of roll inputs per member when a check comes up. */
  party: PartyMember[];
  dmFudgeEnabled: boolean;
  showDmTools?: boolean;
  isOwner?: boolean;
  availableCharacters?: { id: string; label: string }[];
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
  const [imageBusy, setImageBusy] = useState(false);
  const [addCharacterId, setAddCharacterId] = useState(availableCharacters[0]?.id ?? "");
  const [addingCharacter, setAddingCharacter] = useState(false);
  const [showCustomBeat, setShowCustomBeat] = useState(false);
  const [customBeatBusy, setCustomBeatBusy] = useState(false);
  const [customBeatError, setCustomBeatError] = useState<string | null>(null);
  const [customProse, setCustomProse] = useState("");
  const [customIsEnding, setCustomIsEnding] = useState(false);
  const [customChoices, setCustomChoices] = useState<
    Array<{ text: string; skill: "" | "might" | "magic" | "cunning" | "heart"; dc: string }>
  >([
    { text: "", skill: "", dc: "" },
    { text: "", skill: "", dc: "" },
    { text: "", skill: "", dc: "" },
  ]);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePrompt, setCustomImagePrompt] = useState("");
  const router = useRouter();

  function updateCustomChoice(index: number, patch: Partial<(typeof customChoices)[number]>) {
    setCustomChoices((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function handleCustomBeatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = new FormData();
    body.append("prose", customProse);
    body.append("isEnding", String(customIsEnding));
    customChoices.forEach((c, i) => {
      if (!c.text.trim()) return;
      body.append(`choice${i + 1}Text`, c.text);
      if (c.skill) body.append(`choice${i + 1}Skill`, c.skill);
      if (c.dc) body.append(`choice${i + 1}Dc`, c.dc);
    });
    if (customImageFile) {
      body.append("image", customImageFile);
    } else if (customImagePrompt.trim()) {
      body.append("imagePrompt", customImagePrompt);
    }
    submitCustomBeat(body);
  }

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
    // The current scene's art finished after its prose/choices already
    // showed up — only patch if it's still the scene on screen (the party
    // may have already moved on by the time this arrives). This screen
    // doesn't play narration, so only imagePath matters here.
    onSceneMedia: (update) => {
      setScene((prev) => (prev.id === update.sceneId ? { ...prev, imagePath: update.imagePath } : prev));
    },
    onGenerationFailed: (message) => {
      setBusy(false);
      setError(message);
    },
    // A new family joined this room with their own character — the server
    // component's `party` prop is stale until this page's data is
    // re-fetched; simplest correct fix given how rare/non-perf-sensitive
    // this event is.
    onPartyChanged: () => router.refresh(),
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

  /** No physical d20 handy (or just faster): fills in a real random 1-20
   * for this party member instead — no animation, just the number,
   * exactly like rolling a die yourself. */
  function rollForMe(characterId: string, needsSecond: boolean) {
    const raw = String(Math.floor(Math.random() * 20) + 1);
    const raw2 = needsSecond ? String(Math.floor(Math.random() * 20) + 1) : "";
    updateDraft(characterId, { raw, raw2 });
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

  async function patchImage(body: FormData) {
    setImageBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/scenes/${scene.id}/image`, {
      method: "PATCH",
      body,
    });
    setImageBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? "Couldn't update that image.");
      return;
    }
    const json = await res.json();
    applySceneUpdate(json.scene);
  }

  function redrawImage() {
    patchImage(new FormData());
  }

  function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    patchImage(body);
    e.target.value = "";
  }

  async function addCharacter() {
    if (!addCharacterId) return;
    setAddingCharacter(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterIds: [addCharacterId] }),
    });
    setAddingCharacter(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? "Couldn't add that character.");
      return;
    }
    router.refresh();
  }

  async function submitCustomBeat(formData: FormData) {
    setCustomBeatBusy(true);
    setCustomBeatError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/beats/custom`, {
      method: "POST",
      body: formData,
    });
    setCustomBeatBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setCustomBeatError(json.message ?? "Couldn't save that beat.");
      return;
    }
    const json = await res.json();
    applySceneUpdate(json.scene);
    setShowCustomBeat(false);
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

      {scene.imagePath ? (
        <Image
          src={publicImageUrl(scene.imagePath)}
          alt="Current scene"
          width={768}
          height={432}
          priority
          className={`rounded-md object-cover ${busy || imageBusy ? "image-breathe" : ""}`}
        />
      ) : (
        // The beat's prose/choices are already here (text arrives before
        // art — see completeBeatAdvance) — this placeholder just holds the
        // spot until the "scene_media" update patches in the real picture.
        <div
          className="image-breathe flex aspect-video w-full max-w-[768px] items-center justify-center rounded-md border border-dashed border-zinc-700 bg-zinc-900 text-sm text-zinc-500"
          aria-hidden="true"
        >
          🎨 drawing this scene&hellip;
        </div>
      )}

      {showDmTools && isOwner && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={imageBusy || busy}
            onClick={redrawImage}
            className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            {imageBusy ? "Redrawing…" : "🎨 Ask GPT to redraw this"}
          </button>
          <label className="cursor-pointer rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800">
            Upload your own image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadImage}
              disabled={imageBusy || busy}
              className="hidden"
            />
          </label>
        </div>
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
                <button
                  type="button"
                  onClick={() => rollForMe(member.id, draft.mode !== "normal")}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  🎲 No die handy? Roll for me
                </button>
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
        {showDmTools && isOwner && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowCustomBeat((v) => !v)}
            className="rounded-full border border-purple-700 px-4 py-2 text-sm text-purple-300 hover:bg-purple-950/30 disabled:opacity-50"
          >
            {showCustomBeat ? "Cancel custom beat" : "✍ Author a custom beat"}
          </button>
        )}
        <a
          href={`/api/campaigns/${campaignId}/keepsake`}
          download
          className="rounded-full border border-amber-700 px-4 py-2 text-sm text-amber-300 hover:bg-amber-950/30"
        >
          Download keepsake
        </a>
        <div className="flex flex-1 gap-2">
          <input
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder={
              showDmTools
                ? "Inject a direction (e.g. bring back the fox)"
                : "Got your own idea? Type it and see what happens (e.g. what if we asked the turtle for help?)"
            }
            aria-label={showDmTools ? "Inject a story direction" : "Suggest your own idea for what happens next"}
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
            {showDmTools ? "Send" : "Try it!"}
          </button>
        </div>
      </div>

      {showDmTools && isOwner && availableCharacters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-400">Bring in another of your characters:</span>
          <select
            value={addCharacterId}
            onChange={(e) => setAddCharacterId(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1"
          >
            {availableCharacters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={addingCharacter}
            onClick={addCharacter}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-900 disabled:opacity-50"
          >
            {addingCharacter ? "Adding…" : "Add to the party"}
          </button>
        </div>
      )}

      {showDmTools && isOwner && showCustomBeat && (
        <form
          onSubmit={handleCustomBeatSubmit}
          className="flex flex-col gap-3 rounded-md border border-purple-800 bg-purple-950/20 p-4"
        >
          <p className="text-sm text-purple-300">
            Full power: write the next beat yourself instead of asking GPT for one.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Prose</span>
            <textarea
              required
              value={customProse}
              onChange={(e) => setCustomProse(e.target.value)}
              rows={3}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={customIsEnding}
              onChange={(e) => setCustomIsEnding(e.target.checked)}
            />
            This is the ending — no choices needed
          </label>

          {!customIsEnding && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-zinc-400">Choices (first two required, third optional)</span>
              {customChoices.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={c.text}
                    onChange={(e) => updateCustomChoice(i, { text: e.target.value })}
                    placeholder={`Choice ${i + 1}`}
                    className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                  />
                  <select
                    value={c.skill}
                    onChange={(e) => updateCustomChoice(i, { skill: e.target.value as typeof c.skill })}
                    aria-label={`Choice ${i + 1} skill`}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                  >
                    <option value="">No roll needed</option>
                    <option value="might">Might</option>
                    <option value="magic">Magic</option>
                    <option value="cunning">Cunning</option>
                    <option value="heart">Heart</option>
                  </select>
                  {c.skill && (
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={c.dc}
                      onChange={(e) => updateCustomChoice(i, { dc: e.target.value })}
                      placeholder="DC"
                      aria-label={`Choice ${i + 1} difficulty`}
                      className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-center text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-400">
              Scene image (optional) — upload your own, describe one for GPT, or leave blank to keep the last art
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setCustomImageFile(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
              {!customImageFile && (
                <input
                  value={customImagePrompt}
                  onChange={(e) => setCustomImagePrompt(e.target.value)}
                  placeholder="Or describe the scene for GPT to draw"
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                />
              )}
            </div>
          </div>

          {customBeatError && <p className="text-sm text-red-400">{customBeatError}</p>}

          <button
            type="submit"
            disabled={customBeatBusy}
            className="w-fit rounded-full bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {customBeatBusy ? "Saving…" : "Save this beat"}
          </button>
        </form>
      )}
    </div>
  );
}
