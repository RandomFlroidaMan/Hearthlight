import { db } from "@/server/db";
import { deriveSkills } from "@/lib/deriveSkills";
import { toStringArray } from "@/lib/json";
import { generateBeatContent, type BeatContent } from "./generateBeatContent";
import { type Choice } from "./beatSchema";
import { planNextAct, type Act } from "./actPlanner";
import { updateDigestIfNeeded, KEEP_RECENT_SCENES } from "./digest";
import { getPrefetch } from "./prefetchCache";
import { triggerPrefetch } from "./prefetch";
import { complexityForAge, resolveRoll, type RollMode } from "@/server/dice/rollResolution";
import { transport } from "@/server/sync/transport";
import { isMonthlyCapExceeded } from "@/server/spendCap";
import type { Campaign, Character, Scene, WorldSetting } from "@/generated/prisma/client";

/** A skill-check choice was picked without a roll or a DM-fudge override —
 * a 400, not a generation failure, so the route reports it distinctly. */
export class RollRequiredError extends Error {}

/** campaignId didn't match any row — a 404, not a 502. Thrown instead of
 * letting Prisma's findUniqueOrThrow reject with its own error (which
 * includes internal file paths and query details unsuitable to hand back
 * to a client). */
export class CampaignNotFoundError extends Error {}

/** The DM's configured monthly spend cap (Settings.monthlyCapUsd) has been
 * reached — a 402, not a generation failure. Never blocks reusing an
 * already-generated (already-paid-for) prefetched beat, only new spend. */
export class MonthlyCapExceededError extends Error {}

/** Just enough about what happened to cue a sound effect on the story
 * screen — never the DC/skill/modifier numbers themselves, which stay
 * DM-only per the "no mechanics on the story screen" rule. */
export interface BeatOutcome {
  hadCheck: boolean;
  success: boolean;
  isNatural20: boolean;
  itemAwarded: boolean;
}

export async function generateBeat(params: {
  campaignId: string;
  choiceIndex?: number;
  roll?: { raw: number; raw2?: number; mode?: RollMode };
  fudge?: "success" | "failure";
  direction?: string | null;
  forceEnding?: boolean;
  regenerate?: boolean;
}): Promise<{ scene: Scene; outcome: BeatOutcome }> {
  const campaign: (Campaign & { character: Character; worldSetting: WorldSetting }) | null =
    await db.campaign.findUnique({
      where: { id: params.campaignId },
      include: { character: true, worldSetting: true },
    });
  if (!campaign) {
    throw new CampaignNotFoundError(`No campaign found with id "${params.campaignId}".`);
  }

  const scenes = await db.scene.findMany({
    where: { campaignId: params.campaignId },
    orderBy: { order: "asc" },
  });

  const latestScene = scenes[scenes.length - 1] as Scene | undefined;
  const priorScenes = params.regenerate ? scenes.slice(0, -1) : scenes;

  const scenesInCurrentAct = priorScenes.filter((s) => s.act === campaign.act).length;
  const act: Act = params.forceEnding
    ? "resolution"
    : planNextAct(campaign.act as Act, scenesInCurrentAct, campaign.character.readingAge);

  const chosenChoice =
    params.choiceIndex !== undefined && latestScene
      ? (latestScene.choices as unknown as Choice[])[params.choiceIndex]
      : undefined;

  let chosenChoiceSucceeded = true;
  let chosenChoiceOutcomeHint: string | null = null;
  let hadCheck = false;
  let isNatural20 = false;

  if (chosenChoice?.skill && chosenChoice.dc !== null) {
    hadCheck = true;
    if (params.fudge) {
      chosenChoiceSucceeded = params.fudge === "success";

      if (latestScene) {
        await db.scene.update({
          where: { id: latestScene.id },
          data: {
            rollResult: { skill: chosenChoice.skill, fudged: true, success: chosenChoiceSucceeded },
          },
        });
      }
    } else if (params.roll) {
      const complexity = complexityForAge(campaign.character.readingAge);
      const modifier = deriveSkills({
        className: campaign.character.className,
        level: campaign.character.level,
        strength: campaign.character.strength,
        dexterity: campaign.character.dexterity,
        constitution: campaign.character.constitution,
        intelligence: campaign.character.intelligence,
        wisdom: campaign.character.wisdom,
        charisma: campaign.character.charisma,
        proficiencies: toStringArray(campaign.character.proficiencies),
      })[chosenChoice.skill];

      const rollResult = resolveRoll({
        raw: params.roll.raw,
        raw2: params.roll.raw2,
        mode: params.roll.mode,
        modifier,
        dc: chosenChoice.dc,
        useModifier: complexity.useModifier,
      });

      chosenChoiceSucceeded = rollResult.success;
      isNatural20 = rollResult.isNatural20;

      if (latestScene) {
        await db.scene.update({
          where: { id: latestScene.id },
          data: { rollResult: { skill: chosenChoice.skill, ...rollResult } },
        });
      }
    } else {
      throw new RollRequiredError(
        `Choice "${chosenChoice.text}" needs a roll (skill: ${chosenChoice.skill}, DC: ${chosenChoice.dc}) or a DM-fudge override.`,
      );
    }

    chosenChoiceOutcomeHint = chosenChoiceSucceeded
      ? chosenChoice.successHint
      : chosenChoice.failureHint;
  }

  // A background prefetch (triggered when the current scene was created)
  // may already have this exact choice+outcome ready — reuse it instead of
  // generating fresh. Only applies to a real choice pick, never to
  // regenerate/direction/forceEnding, which have no matching cache entry.
  let content: BeatContent | null = null;
  if (
    latestScene &&
    params.choiceIndex !== undefined &&
    !params.regenerate &&
    !params.direction &&
    !params.forceEnding
  ) {
    const cached = getPrefetch(latestScene.id, params.choiceIndex, chosenChoiceSucceeded);
    if (cached) {
      content = await cached;
    }
  }

  if (!content) {
    if (await isMonthlyCapExceeded()) {
      throw new MonthlyCapExceededError(
        "This month's spending cap has been reached — raise it in Preferences to keep generating.",
      );
    }
    content = await generateBeatContent(
      {
        character: campaign.character,
        worldSetting: campaign.worldSetting,
        act,
        digestSummary: campaign.digestSummary,
        npcsMet: toStringArray(campaign.npcsMet),
        recentScenes: priorScenes.slice(-KEEP_RECENT_SCENES),
        chosenChoiceText: chosenChoice?.text,
        chosenChoiceSucceeded,
        chosenChoiceOutcomeHint,
        direction: params.direction,
        forceEnding: params.forceEnding ?? false,
      },
      campaign.id,
    );
  }

  const { beat, imageFilename, narrationFilename } = content;

  const sceneData = {
    act,
    prose: beat.prose,
    imagePath: imageFilename,
    imagePrompt: beat.imagePrompt,
    dmNotes: beat.dmNotes,
    choices: beat.choices,
    ambientTrack: beat.ambientTrack,
    narrationPath: narrationFilename,
    choiceText: chosenChoice?.text,
    isEnding: beat.isEnding,
  };

  const scene =
    params.regenerate && latestScene
      ? await db.scene.update({ where: { id: latestScene.id }, data: sceneData })
      : await db.scene.create({
          data: { campaignId: campaign.id, order: (latestScene?.order ?? 0) + 1, ...sceneData },
        });

  if (beat.itemReward) {
    await db.item.create({
      data: {
        campaignId: campaign.id,
        name: beat.itemReward.name,
        description: beat.itemReward.description,
        earnedAtScene: scene.order,
      },
    });
  }

  const npcsMet = toStringArray(campaign.npcsMet);
  const updatedNpcsMet = beat.npcIntroduced
    ? [...npcsMet, `${beat.npcIntroduced.name}: ${beat.npcIntroduced.description}`]
    : npcsMet;

  await db.campaign.update({
    where: { id: campaign.id },
    data: { act, status: beat.isEnding ? "ended" : "active", npcsMet: updatedNpcsMet },
  });

  await updateDigestIfNeeded(campaign.id);

  transport.broadcast(campaign.roomCode, { type: "scene", scene });

  // Fire-and-forget: guesses what's next for *this* scene's own choices,
  // so the next hop is fast too. Never awaited — must not add latency to
  // the response the player is waiting on right now.
  void triggerPrefetch({
    campaign: { ...campaign, act, npcsMet: updatedNpcsMet },
    scene,
    priorScenes: params.regenerate ? priorScenes : scenes,
  });

  return {
    scene,
    outcome: {
      hadCheck,
      success: chosenChoiceSucceeded,
      isNatural20,
      itemAwarded: beat.itemReward !== null,
    },
  };
}
