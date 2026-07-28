import { db } from "@/server/db";
import { deriveSkills } from "@/lib/deriveSkills";
import { toStringArray } from "@/lib/json";
import { generateBeatContent, type BeatContent } from "./generateBeatContent";
import { type Choice } from "./beatSchema";
import { planNextAct, type Act } from "./actPlanner";
import { updateDigestIfNeeded, KEEP_RECENT_SCENES } from "./digest";
import { getPrefetch } from "./prefetchCache";
import { triggerPrefetch } from "./prefetch";
import { complexityForAge, resolvePartyRoll, type RollMode } from "@/server/dice/rollResolution";
import { transport } from "@/server/sync/transport";
import { isMonthlyCapExceeded } from "@/server/spendCap";
import type { Campaign, Character, Prisma, Scene, WorldSetting } from "@/generated/prisma/client";

/** One party member's physical d20 result(s) for a check — everyone present
 * rolls, per the family co-op rule (see resolvePartyRoll). */
export interface PartyRollInput {
  characterId: string;
  raw: number;
  raw2?: number;
  mode?: RollMode;
}

function skillModifierFor(character: Character, skill: NonNullable<Choice["skill"]>): number {
  return deriveSkills({
    className: character.className,
    level: character.level,
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
    proficiencies: toStringArray(character.proficiencies),
  })[skill];
}

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
 * already-generated (already-paid-for) prefetched beat, only new spend.
 * Thrown from the (backgrounded) generation phase, not the fast
 * validation phase — see resolveChoiceOutcome vs. completeBeatAdvance. */
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

export interface BeatAdvanceParams {
  campaignId: string;
  choiceIndex?: number;
  /** One entry per party member present for this check — everyone rolls. */
  roll?: PartyRollInput[];
  fudge?: "success" | "failure";
  direction?: string | null;
  forceEnding?: boolean;
  regenerate?: boolean;
}

/** Everything resolveChoiceOutcome figured out, handed to completeBeatAdvance
 * to actually generate and save the next scene. */
export interface BeatAdvanceContext {
  campaign: Campaign & { worldSetting: WorldSetting };
  characters: Character[];
  matureCombatAllowed: boolean;
  act: Act;
  chosenChoice: Choice | undefined;
  chosenChoiceSucceeded: boolean;
  chosenChoiceOutcomeHint: string | null;
  hadCheck: boolean;
  anyNatural20: boolean;
  scenes: Scene[];
  priorScenes: Scene[];
  latestScene: Scene | undefined;
  params: BeatAdvanceParams;
}

/**
 * The fast half of advancing a beat: everything that's pure DB reads/writes
 * — no OpenAI call, so this reliably finishes in well under a second and
 * is safe to await directly in a route handler. Resolves (and persists)
 * the physical dice roll or DM-fudge for the chosen choice, throwing
 * RollRequiredError/CampaignNotFoundError as real client-facing errors.
 * The slow part (actually generating the next scene) is
 * completeBeatAdvance, deliberately kept separate so a route can respond
 * to the player immediately and run that part in the background — an
 * inline 15-30 second wait was long enough to trip Railway's own proxy
 * timeout ("Application failed to respond"), a lesson learned the hard
 * way from POST /api/campaigns before this same split was applied there.
 */
export async function resolveChoiceOutcome(params: BeatAdvanceParams): Promise<BeatAdvanceContext> {
  const campaignRow = await db.campaign.findUnique({
    where: { id: params.campaignId },
    include: { characters: { include: { character: true } }, worldSetting: true },
  });
  if (!campaignRow) {
    throw new CampaignNotFoundError(`No campaign found with id "${params.campaignId}".`);
  }
  const { characters: partyLinks, ...campaign }: Campaign & { worldSetting: WorldSetting } & {
    characters: { character: Character }[];
  } = campaignRow;
  const characters = partyLinks.map((link) => link.character);

  const settings = await db.settings.findUnique({ where: { id: "default" } });
  const matureCombatAllowed = (settings?.matureCombatEnabled ?? false) && campaign.readingAge >= 10;

  const scenes = await db.scene.findMany({
    where: { campaignId: params.campaignId },
    orderBy: { order: "asc" },
  });

  const latestScene = scenes[scenes.length - 1] as Scene | undefined;
  const priorScenes = params.regenerate ? scenes.slice(0, -1) : scenes;

  const scenesInCurrentAct = priorScenes.filter((s) => s.act === campaign.act).length;
  const act: Act = params.forceEnding
    ? "resolution"
    : planNextAct(campaign.act as Act, scenesInCurrentAct, campaign.readingAge);

  const chosenChoice =
    params.choiceIndex !== undefined && latestScene
      ? (latestScene.choices as unknown as Choice[])[params.choiceIndex]
      : undefined;

  let chosenChoiceSucceeded = true;
  let chosenChoiceOutcomeHint: string | null = null;
  let hadCheck = false;
  let anyNatural20 = false;

  if (chosenChoice?.skill && chosenChoice.dc !== null) {
    hadCheck = true;
    const skill = chosenChoice.skill;
    const dc = chosenChoice.dc;

    if (params.fudge) {
      chosenChoiceSucceeded = params.fudge === "success";

      if (latestScene) {
        await db.scene.update({
          where: { id: latestScene.id },
          data: {
            rollResult: { skill, fudged: true, success: chosenChoiceSucceeded },
          },
        });
      }
    } else if (params.roll && params.roll.length > 0) {
      const rollers = params.roll.map((r) => {
        const character = characters.find((c) => c.id === r.characterId);
        if (!character) {
          throw new RollRequiredError(`No party member with id "${r.characterId}" on this campaign.`);
        }
        return {
          characterId: character.id,
          characterName: character.displayName ?? character.name,
          raw: r.raw,
          raw2: r.raw2,
          mode: r.mode,
          modifier: skillModifierFor(character, skill),
          useModifier: complexityForAge(character.readingAge).useModifier,
        };
      });

      const partyResult = resolvePartyRoll({ dc, rollers });

      chosenChoiceSucceeded = partyResult.success;
      anyNatural20 = partyResult.anyNatural20;

      if (latestScene) {
        await db.scene.update({
          where: { id: latestScene.id },
          data: { rollResult: { skill, ...partyResult } as unknown as Prisma.InputJsonValue },
        });
      }
    } else {
      throw new RollRequiredError(
        `Choice "${chosenChoice.text}" needs a roll from every party member (skill: ${chosenChoice.skill}, DC: ${chosenChoice.dc}) or a DM-fudge override.`,
      );
    }

    chosenChoiceOutcomeHint = chosenChoiceSucceeded
      ? chosenChoice.successHint
      : chosenChoice.failureHint;
  }

  return {
    campaign,
    characters,
    matureCombatAllowed,
    act,
    chosenChoice,
    chosenChoiceSucceeded,
    chosenChoiceOutcomeHint,
    hadCheck,
    anyNatural20,
    scenes,
    priorScenes,
    latestScene,
    params,
  };
}

/**
 * The slow half: reuses a ready prefetched beat if one exists, otherwise
 * calls the OpenAI-backed content pipeline, then saves everything and
 * broadcasts the new scene (with its outcome, so every connected screen —
 * not just whichever one triggered this — can react, e.g. play a sound
 * effect). Safe to run fire-and-forget in the background; failures are
 * reported via a "generation_failed" broadcast rather than a thrown error
 * reaching an already-answered HTTP request.
 */
export async function completeBeatAdvance(ctx: BeatAdvanceContext): Promise<{ scene: Scene; outcome: BeatOutcome }> {
  const { campaign, characters, matureCombatAllowed, act, chosenChoice, chosenChoiceSucceeded, chosenChoiceOutcomeHint, latestScene, priorScenes, scenes, params } = ctx;

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
        characters,
        readingAge: campaign.readingAge,
        matureCombatAllowed,
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

  const outcome: BeatOutcome = {
    hadCheck: ctx.hadCheck,
    success: chosenChoiceSucceeded,
    isNatural20: ctx.anyNatural20,
    itemAwarded: beat.itemReward !== null,
  };

  transport.broadcast(campaign.roomCode, { type: "scene", scene, outcome });

  // Fire-and-forget: guesses what's next for *this* scene's own choices,
  // so the next hop is fast too. Never awaited — must not add latency to
  // the response the player is waiting on right now.
  void triggerPrefetch({
    campaign: { ...campaign, act, npcsMet: updatedNpcsMet },
    characters,
    matureCombatAllowed,
    scene,
    priorScenes: params.regenerate ? priorScenes : scenes,
  });

  return { scene, outcome };
}

/** Convenience wrapper for callers that don't need the fast/slow split —
 * currently just POST /api/campaigns, whose "choice" is always empty (the
 * opening beat), so there's no roll validation to fast-path around. */
export async function generateBeat(params: BeatAdvanceParams): Promise<{ scene: Scene; outcome: BeatOutcome }> {
  const ctx = await resolveChoiceOutcome(params);
  return completeBeatAdvance(ctx);
}
