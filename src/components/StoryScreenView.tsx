"use client";

import { useState } from "react";
import Image from "next/image";
import { useCampaignSync } from "@/lib/useCampaignSync";
import type { Choice } from "@/server/storyEngine/beatSchema";

function publicImageUrl(filename: string): string {
  return `/api/images/${filename}`;
}

type SceneData = {
  id: string;
  prose: string;
  imagePath: string | null;
  choices: Choice[];
  isEnding: boolean;
};

/**
 * The public story screen: full-bleed art, prose, and tappable choices only
 * — no mechanics, no DM notes, no DC/skill labels. Stays live with the DM
 * screen via useCampaignSync — either screen can drive, per the brief.
 */
export function StoryScreenView({
  campaignId,
  roomCode,
  initialScene,
}: {
  campaignId: string;
  roomCode: string;
  initialScene: SceneData;
}) {
  const [scene, setScene] = useState(initialScene);
  const [loading, setLoading] = useState(false);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(null);

  function applySceneUpdate(newScene: SceneData) {
    setScene((prev) => {
      if (newScene.id !== prev.id) {
        setPendingChoiceIndex(null);
      }
      return newScene;
    });
  }

  useCampaignSync<SceneData>({ campaignId, roomCode, onScene: applySceneUpdate });

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
      applySceneUpdate(json.scene);
    }
  }

  function tapChoice(index: number) {
    const choice = scene.choices[index];
    if (choice.skill) {
      setPendingChoiceIndex(index);
      return;
    }
    choose(index);
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {scene.imagePath && (
        <div className="relative aspect-video w-full">
          <Image
            src={publicImageUrl(scene.imagePath)}
            alt=""
            fill
            priority
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-10 text-center">
        <p className="max-w-3xl text-2xl leading-relaxed sm:text-4xl">{scene.prose}</p>

        {loading ? (
          <p className="text-lg text-zinc-400">…</p>
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
