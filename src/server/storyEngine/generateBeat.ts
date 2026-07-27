import { zodTextFormat } from "openai/helpers/zod";
import { db } from "@/server/db";
import { openai } from "@/server/openaiClient";
import { modelConfig } from "@/server/config/models";
import { generateSceneImage } from "@/server/art/generateSceneImage";
import { generateNarration } from "@/server/audio/generateNarration";
import { deriveSkills } from "@/lib/deriveSkills";
import { findClass } from "@/lib/dnd";
import { toStringArray } from "@/lib/json";
import { validateBeat } from "@/server/contentPolicy/validator";
import { FALLBACK_BEATS } from "@/server/contentPolicy/fallbackBeats";
import { beatSchema, type Beat, type Choice } from "./beatSchema";
import { planNextAct, type Act } from "./actPlanner";
import { updateDigestIfNeeded, KEEP_RECENT_SCENES } from "./digest";
import { complexityForAge, resolveRoll, type RollMode } from "@/server/dice/rollResolution";
import { transport } from "@/server/sync/transport";
import type { Campaign, Character, Scene, WorldSetting } from "@/generated/prisma/client";

const MAX_GENERATION_ATTEMPTS = 3;

/** A skill-check choice was picked without a roll or a DM-fudge override —
 * a 400, not a generation failure, so the route reports it distinctly. */
export class RollRequiredError extends Error {}

/** campaignId didn't match any row — a 404, not a 502. Thrown instead of
 * letting Prisma's findUniqueOrThrow reject with its own error (which
 * includes internal file paths and query details unsuitable to hand back
 * to a client). */
export class CampaignNotFoundError extends Error {}

/** Just enough about what happened to cue a sound effect on the story
 * screen — never the DC/skill/modifier numbers themselves, which stay
 * DM-only per the "no mechanics on the story screen" rule. */
export interface BeatOutcome {
  hadCheck: boolean;
  success: boolean;
  isNatural20: boolean;
  itemAwarded: boolean;
}

const READING_AGE_GUIDANCE: Record<number, string> = {
  3: "Write for a 3-year-old: very short sentences (5-8 words), concrete nouns, only words a 3-year-old knows. One clear choice matters more than nuance.",
  5: "Write for a 5-year-old: simple sentences, everyday vocabulary, slightly more detail than for a 3-year-old.",
  7: "Write for a 7-year-old: richer vocabulary and sentence structure, mild suspense is fine, choices can have more nuanced consequences.",
  10: "Write for a 10-year-old: closer to a real chapter-book adventure — fuller sentences, more nuance, choices can have layered consequences.",
};

const SAFETY_RULES = `SAFETY RULES — follow these exactly, no exceptions:
- Conflict is ONLY ever with fantastical monsters (goblins, trolls, slimes, imps, grumpy dragons, and similar). NEVER with humans, people, children, or any humanoid person.
- NEVER use or imply: kill, die, dead, hurt, blood, wound, weapon injury, cruelty, or abandonment. Nothing frightening at bedtime.
- Use only these kinds of outcomes: defeated, out-smarted, out-run, out-sung, shooed away, sent home, chased off, routed, tucked in for a nap, befriended, calmed, cheered up.
- Monsters are never harmed — they give up, wander off, or become friends.
- A failed choice is always a gentle, funny setback — never harm, never the end of the adventure.
- No character death, no permanent loss, no "game over."`;

const ACT_GUIDANCE: Record<Act, string> = {
  setup: "This is the opening beat. Introduce the world and give a low-stakes first choice.",
  journey: "Middle of the adventure. Exploration, meeting friendly or silly characters, building toward something.",
  complication: "A small fantastical obstacle appears (a silly monster, a puzzle). Raise stakes gently, not scarily. The \"danger\" ambient track usually fits here.",
  climax: "The biggest moment of the adventure — a bigger (but still friendly-at-heart) fantastical creature or challenge to overcome. The \"danger\" ambient track usually fits here.",
  resolution: "Wrap up warmly. This should be (or lead directly to) the ending — set isEnding to true.",
};

interface BeatContext {
  character: Character;
  worldSetting: WorldSetting;
  act: Act;
  digestSummary: string | null;
  recentScenes: Scene[];
  chosenChoiceText?: string;
  /** Whether the chosen choice's check succeeded — only meaningful when chosenChoiceText is set. */
  chosenChoiceSucceeded?: boolean;
  chosenChoiceOutcomeHint?: string | null;
  direction?: string | null;
  forceEnding: boolean;
  priorViolations?: string[];
}

function characterSummary(character: Character): string {
  const classInfo = findClass(character.className);
  const skills = deriveSkills({
    className: character.className,
    level: character.level,
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
    proficiencies: toStringArray(character.proficiencies),
  });
  return [
    `${character.name}, a ${character.race} ${classInfo?.kidName ?? character.className}.`,
    character.appearance ? `Appearance: ${character.appearance}.` : null,
    character.personality ? `Personality: ${character.personality}.` : null,
    `Kid stats — Might ${skills.might}, Magic ${skills.magic}, Cunning ${skills.cunning}, Heart ${skills.heart}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildUserPrompt(ctx: BeatContext): string {
  const parts: string[] = [
    `WORLD: ${ctx.worldSetting.name} — ${ctx.worldSetting.description}`,
    `CHARACTER: ${characterSummary(ctx.character)}`,
    `CURRENT ACT: ${ctx.act}. ${ACT_GUIDANCE[ctx.act]}`,
  ];

  if (ctx.digestSummary) {
    parts.push(`STORY SO FAR: ${ctx.digestSummary}`);
  }

  if (ctx.recentScenes.length > 0) {
    const recent = ctx.recentScenes
      .map((s) => `Scene ${s.order}: ${s.prose}`)
      .join("\n");
    parts.push(`MOST RECENT SCENES:\n${recent}`);
  }

  if (ctx.chosenChoiceText) {
    const outcome = ctx.chosenChoiceSucceeded ? "succeeded" : "failed";
    const hint = ctx.chosenChoiceOutcomeHint ? ` ${ctx.chosenChoiceOutcomeHint}` : "";
    parts.push(
      `The player just chose: "${ctx.chosenChoiceText}", and it ${outcome}.${hint} Continue from there.` +
        (ctx.chosenChoiceSucceeded
          ? ""
          : " Remember: a failure must be a gentle, funny setback — never harm, never the end of the adventure."),
    );
  }

  if (ctx.direction) {
    parts.push(`DM DIRECTION (follow this): ${ctx.direction}`);
  }

  if (ctx.forceEnding) {
    parts.push("This must be the final beat. Wrap up the adventure warmly and set isEnding to true.");
  }

  if (ctx.priorViolations?.length) {
    parts.push(
      `Your previous attempt violated the safety rules: ${ctx.priorViolations.join("; ")}. Try again, fully respecting every safety rule above.`,
    );
  }

  parts.push(
    ctx.recentScenes.length === 0 && !ctx.chosenChoiceText
      ? "Generate the opening beat of this adventure."
      : "Generate the next beat of this adventure.",
  );

  return parts.join("\n\n");
}

async function callModel(ctx: BeatContext): Promise<Beat> {
  const readingAgeGuidance = READING_AGE_GUIDANCE[ctx.character.readingAge] ?? READING_AGE_GUIDANCE[5];

  const response = await openai.responses.create({
    model: modelConfig.text.model,
    input: [
      {
        role: "system",
        content: `You are the Dungeon Master for a gentle, wondrous bedtime adventure.\n\n${SAFETY_RULES}\n\n${readingAgeGuidance}`,
      },
      { role: "user", content: buildUserPrompt(ctx) },
    ],
    text: { format: zodTextFormat(beatSchema, "story_beat") },
  });

  return beatSchema.parse(JSON.parse(response.output_text));
}

/** Generates a beat, validates it against content policy, retries with the
 * violation fed back into the prompt (max 3 attempts), and falls back to a
 * hand-authored safe beat for the act if every attempt still fails. */
async function generateValidatedBeat(ctx: BeatContext): Promise<Beat> {
  let violations: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const beat = await callModel({ ...ctx, priorViolations: violations.length > 0 ? violations : undefined });
    const result = validateBeat(beat);
    if (result.valid) {
      return beat;
    }
    violations = result.violations;
  }

  return FALLBACK_BEATS[ctx.act];
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

  const beat = await generateValidatedBeat({
    character: campaign.character,
    worldSetting: campaign.worldSetting,
    act,
    digestSummary: campaign.digestSummary,
    recentScenes: priorScenes.slice(-KEEP_RECENT_SCENES),
    chosenChoiceText: chosenChoice?.text,
    chosenChoiceSucceeded,
    chosenChoiceOutcomeHint,
    direction: params.direction,
    forceEnding: params.forceEnding ?? false,
  });

  // Independent of each other — both only depend on the already-validated
  // beat text — so they run concurrently rather than adding their latency
  // sequentially.
  const [{ filename: imageFilename }, narrationFilename] = await Promise.all([
    generateSceneImage({
      character: campaign.character,
      worldSetting: campaign.worldSetting,
      sceneDescription: beat.imagePrompt,
      campaignId: campaign.id,
    }),
    generateNarration({ prose: beat.prose, campaignId: campaign.id }),
  ]);

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

  await db.campaign.update({
    where: { id: campaign.id },
    data: { act, status: beat.isEnding ? "ended" : "active" },
  });

  await updateDigestIfNeeded(campaign.id);

  transport.broadcast(campaign.roomCode, { type: "scene", scene });

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
