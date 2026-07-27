"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useCampaignSync } from "@/lib/useCampaignSync";
import { useAudioEngine } from "@/lib/useAudioEngine";
import type { Choice } from "@/server/storyEngine/beatSchema";
import type { BeatOutcome } from "@/server/storyEngine/generateBeat";
import type { AudioManifest } from "@/server/audio/assetManifest";

function publicImageUrl(filename: string): string {
  return `/api/images/${filename}`;
}

function publicAudioUrl(filename: string): string {
  return `/api/audio/${filename}`;
}

type SceneData = {
  id: string;
  prose: string;
  imagePath: string | null;
  narrationPath: string | null;
  ambientTrack: string | null;
  choices: Choice[];
  isEnding: boolean;
};

type MuteFlags = {
  narrationMuted: boolean;
  ambienceMuted: boolean;
  effectsMuted: boolean;
};

/**
 * The public story screen: full-bleed art, prose, and tappable choices only
 * — no mechanics, no DM notes, no DC/skill labels. Stays live with the DM
 * screen via useCampaignSync — either screen can drive, per the brief.
 * This is also the only screen that plays audio — narration, ambience, and
 * sound effects — since both screens are in the same room and the DM's
 * phone shouldn't also be making noise.
 */
export function StoryScreenView({
  campaignId,
  roomCode,
  initialScene,
  initialMute,
  audioManifest,
}: {
  campaignId: string;
  roomCode: string;
  initialScene: SceneData;
  initialMute: MuteFlags;
  audioManifest: AudioManifest;
}) {
  const [scene, setScene] = useState(initialScene);
  const [loading, setLoading] = useState(false);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(null);
  const [narrationMuted, setNarrationMuted] = useState(initialMute.narrationMuted);
  const [ambienceMuted, setAmbienceMuted] = useState(initialMute.ambienceMuted);
  const [effectsMuted, setEffectsMuted] = useState(initialMute.effectsMuted);

  const engine = useAudioEngine(narrationMuted, ambienceMuted, effectsMuted);

  function applySceneUpdate(newScene: SceneData) {
    setScene((prev) => {
      if (newScene.id !== prev.id) {
        setPendingChoiceIndex(null);
      }
      return newScene;
    });
  }

  useCampaignSync<SceneData>({ campaignId, roomCode, onScene: applySceneUpdate });

  // Every scene change — this screen's own action, the DM's action, or a
  // reconnect resync — (re)plays narration and switches ambience to match.
  useEffect(() => {
    engine.playNarration(scene.narrationPath ? publicAudioUrl(scene.narrationPath) : null);
  }, [engine, scene.narrationPath]);

  useEffect(() => {
    const track = scene.ambientTrack;
    const url = track && track !== "none" ? audioManifest.ambient[track as keyof AudioManifest["ambient"]] : null;
    engine.setAmbience(track && track !== "none" ? track : null, url ?? null);
  }, [engine, scene.ambientTrack, audioManifest]);

  function playOutcomeSfx(outcome: BeatOutcome) {
    if (outcome.itemAwarded) {
      engine.playSfx(audioManifest.sfx["item-reward"]);
      return;
    }
    if (!outcome.hadCheck) return;
    if (outcome.isNatural20) {
      engine.playSfx(audioManifest.sfx.natural20);
    } else {
      engine.playSfx(audioManifest.sfx[outcome.success ? "success" : "setback"]);
    }
  }

  async function choose(index: number, raw?: number) {
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/beats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choiceIndex: index, ...(raw ? { roll: { raw } } : {}) }),
    });
    setLoading(false);
    setPendingChoiceIndex(null);
    if (res.ok) {
      const json = await res.json();
      if (json.outcome) playOutcomeSfx(json.outcome as BeatOutcome);
      applySceneUpdate(json.scene);
    }
  }

  function tapChoice(index: number) {
    engine.playSfx(audioManifest.sfx["choice-select"]);
    const choice = scene.choices[index];
    if (choice.skill) {
      setPendingChoiceIndex(index);
      return;
    }
    choose(index);
  }

  function toggleMute(key: keyof MuteFlags, current: boolean, setter: (v: boolean) => void) {
    const next = !current;
    setter(next);
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    }).catch(() => {
      // Best-effort — the audio engine already reflects the new state
      // locally; a failed PATCH just means it won't persist.
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <div className="flex justify-end gap-2 bg-zinc-950 px-4 pt-3">
        <button
          onClick={() => toggleMute("narrationMuted", narrationMuted, setNarrationMuted)}
          className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          Voice: {narrationMuted ? "off" : "on"}
        </button>
        <button
          onClick={() => toggleMute("ambienceMuted", ambienceMuted, setAmbienceMuted)}
          className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          Music: {ambienceMuted ? "off" : "on"}
        </button>
        <button
          onClick={() => toggleMute("effectsMuted", effectsMuted, setEffectsMuted)}
          className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          Sounds: {effectsMuted ? "off" : "on"}
        </button>
      </div>

      {scene.imagePath && (
        <div className="relative aspect-video w-full">
          <Image
            src={publicImageUrl(scene.imagePath)}
            alt=""
            fill
            priority
            className={`object-cover ${loading ? "image-breathe" : ""}`}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-10 text-center">
        <p className="max-w-3xl text-2xl leading-relaxed sm:text-4xl">{scene.prose}</p>

        {loading ? (
          <div className="flex items-center gap-3 text-lg text-amber-200/80">
            <span className="lantern-glow h-3 w-3 rounded-full bg-amber-300" aria-hidden="true" />
            <span>The story continues&hellip;</span>
          </div>
        ) : scene.isEnding ? (
          <p className="text-xl text-amber-300">The End</p>
        ) : pendingChoiceIndex !== null ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-2xl">What did your die show?</p>
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => choose(pendingChoiceIndex, n)}
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-50 text-xl font-semibold text-zinc-950 hover:bg-zinc-200"
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingChoiceIndex(null)}
              className="text-sm text-zinc-500 underline hover:text-zinc-300"
            >
              never mind
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {scene.choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => tapChoice(i)}
                className="rounded-2xl bg-zinc-50 px-8 py-6 text-xl font-medium text-zinc-950 hover:bg-zinc-200 sm:text-2xl"
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
