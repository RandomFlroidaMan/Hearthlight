import { generateBeatContent, type BeatContext } from "./generateBeatContent";
import { planNextAct, type Act } from "./actPlanner";
import { KEEP_RECENT_SCENES } from "./digest";
import { setPrefetch, clearPrefetchForScene } from "./prefetchCache";
import { isMonthlyCapExceeded } from "@/server/spendCap";
import { toStringArray } from "@/lib/json";
import type { Campaign, Character, Scene, WorldSetting } from "@/generated/prisma/client";
import type { Choice } from "./beatSchema";

/**
 * "Preload the story ahead of time — every choice, unless the player types
 * their own idea" (family request, superseding the brief's original
 * "likely branch only" scope). For every predefined choice, speculatively
 * runs the full content pipeline (LLM text + art, in parallel with
 * narration) for BOTH outcomes when the choice has a skill check (success
 * and failure), or just once when it doesn't (no roll means no outcome
 * branching), and caches the result. When the player actually picks a
 * choice, generateBeat.ts checks this cache first; a hit skips straight to
 * writing the result instead of waiting on a fresh generation — so no
 * matter how a roll goes, the next scene is already sitting there ready.
 * A typed-in custom direction can't be predicted, so that path always
 * generates live.
 *
 * This roughly doubles spend on every checked choice versus speculating
 * only the likely branch (most of it discarded, since only one outcome is
 * ever actually used) — an explicit, deliberate tradeoff in exchange for
 * "everything is instant," not an oversight.
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
    // A choice with no skill check has only one possible outcome
    // (resolveChoiceOutcome always treats it as succeeded), so there's
    // nothing to branch on; a checked choice can go either way, and both
    // are equally worth having ready since the player won't know which
    // until the dice actually land.
    const hasCheck = Boolean(choice.skill && choice.dc !== null);
    const outcomesToPrefetch = hasCheck ? [true, false] : [true];

    for (const succeeded of outcomesToPrefetch) {
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
        chosenChoiceSucceeded: succeeded,
        chosenChoiceOutcomeHint: choice.skill ? (succeeded ? choice.successHint : choice.failureHint) : null,
        direction: null,
        forceEnding: false,
      };

      const promise = generateBeatContent(ctx, campaign.id).catch((err) => {
        console.error(
          `Prefetch failed for scene ${scene.id} choice ${choiceIndex} (succeeded=${succeeded}):`,
          err,
        );
        return null;
      });

      setPrefetch(scene.id, choiceIndex, succeeded, characterIds, promise);
    }
  });
}
