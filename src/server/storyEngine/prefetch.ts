import { generateBeatContent, type BeatContext } from "./generateBeatContent";
import { planNextAct, type Act } from "./actPlanner";
import { KEEP_RECENT_SCENES } from "./digest";
import { setPrefetch, clearPrefetchForScene } from "./prefetchCache";
import { isMonthlyCapExceeded } from "@/server/spendCap";
import { toStringArray } from "@/lib/json";
import type { Campaign, Character, Scene, WorldSetting } from "@/generated/prisma/client";
import type { Choice } from "./beatSchema";

/**
 * "Prefetch aggressively: as soon as a scene renders, generate the art for
 * every available choice's likely next scene in the background" (brief
 * §9). For each choice, speculatively runs the full content pipeline
 * (LLM text + art, in parallel with narration) assuming the *likely*
 * outcome — success, since this app's DCs are kept low/kid-friendly, so
 * success is the statistically common case — and caches the result. When
 * the player actually picks a choice, generateBeat.ts checks this cache
 * first; a hit skips straight to writing the result instead of waiting on
 * a fresh generation.
 *
 * Only the single likely branch is prefetched, not both success and
 * failure — prefetching every choice already roughly doubles/triples
 * spend per scene transition (most of it discarded), so speculating both
 * outcomes of every skill check on top of that isn't worth the cost. A
 * failed roll just falls back to normal on-demand generation.
 *
 * Fire-and-forget by design: callers never await this, and a failure here
 * (logged, not thrown) only means the next real advance falls back to
 * fresh generation — it must never affect the scene that's actually being
 * shown right now.
 */
export async function triggerPrefetch(params: {
  campaign: Campaign & { worldSetting: WorldSetting };
  characters: Character[];
  matureCombatAllowed: boolean;
  /** The scene that was just created/updated — prefetch guesses what
   * comes after it. */
  scene: Scene;
  /** Every scene before it, ascending by order. */
  priorScenes: Scene[];
}): Promise<void> {
  const { campaign, characters, matureCombatAllowed, scene, priorScenes } = params;

  clearPrefetchForScene(scene.id);

  if (scene.isEnding) return;

  // A background nice-to-have must never itself blow through a cap the DM
  // set on purpose — skip silently rather than spend past it.
  if (await isMonthlyCapExceeded()) return;

  const choices = scene.choices as unknown as Choice[];
  const scenesIncludingCurrent = [...priorScenes, scene];
  const scenesInCurrentAct = scenesIncludingCurrent.filter((s) => s.act === campaign.act).length;
  const act: Act = planNextAct(campaign.act as Act, scenesInCurrentAct, campaign.readingAge);
  const recentScenes = scenesIncludingCurrent.slice(-KEEP_RECENT_SCENES);
  const npcsMet = toStringArray(campaign.npcsMet);
  const characterIds = characters.map((c) => c.id);

  choices.forEach((choice, choiceIndex) => {
    const ctx: BeatContext = {
      characters,
      readingAge: campaign.readingAge,
      matureCombatAllowed,
      worldSetting: campaign.worldSetting,
      act,
      digestSummary: campaign.digestSummary,
      npcsMet,
      recentScenes,
      chosenChoiceText: choice.text,
      chosenChoiceSucceeded: true,
      chosenChoiceOutcomeHint: choice.skill ? choice.successHint : null,
      direction: null,
      forceEnding: false,
    };

    const promise = generateBeatContent(ctx, campaign.id).catch((err) => {
      console.error(`Prefetch failed for scene ${scene.id} choice ${choiceIndex}:`, err);
      return null;
    });

    setPrefetch(scene.id, choiceIndex, true, characterIds, promise);
  });
}
