import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/server/openaiClient";
import { modelConfig } from "@/server/config/models";
import { generateSceneImage } from "@/server/art/generateSceneImage";
import { generateNarration } from "@/server/audio/generateNarration";
import { deriveSkills } from "@/lib/deriveSkills";
import { findClass } from "@/lib/dnd";
import { toStringArray } from "@/lib/json";
import { validateBeat } from "@/server/contentPolicy/validator";
import { FALLBACK_BEATS } from "@/server/contentPolicy/fallbackBeats";
import { beatSchema, type Beat } from "./beatSchema";
import type { Act } from "./actPlanner";
import type { Character, Scene, WorldSetting } from "@/generated/prisma/client";

/**
 * Pure beat *content* generation — the LLM call, content-policy validation,
 * and the resulting art/narration. No DB writes, no game-state mutation
 * (campaign.act, digest, items, broadcast — all of that lives in
 * generateBeat.ts). Split out so the same content pipeline can be reused
 * by both the real advance-the-story path and the speculative prefetch
 * path (src/server/storyEngine/prefetch.ts) without duplicating it.
 */

const MAX_GENERATION_ATTEMPTS = 3;

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

export interface BeatContext {
  character: Character;
  worldSetting: WorldSetting;
  act: Act;
  digestSummary: string | null;
  npcsMet: string[];
  recentScenes: Scene[];
  chosenChoiceText?: string;
  /** Whether the chosen choice's check succeeded — only meaningful when chosenChoiceText is set. */
  chosenChoiceSucceeded?: boolean;
  chosenChoiceOutcomeHint?: string | null;
  direction?: string | null;
  forceEnding: boolean;
  priorViolations?: string[];
}

export interface BeatContent {
  beat: Beat;
  imageFilename: string;
  narrationFilename: string | null;
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

  if (ctx.npcsMet.length > 0) {
    parts.push(`CHARACTERS ALREADY MET (keep them consistent if they reappear): ${ctx.npcsMet.join("; ")}`);
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

/** The full content pipeline for one beat: validated text, then art and
 * narration in parallel (independent of each other, so this halves the
 * added latency versus running them sequentially). */
export async function generateBeatContent(ctx: BeatContext, campaignId: string): Promise<BeatContent> {
  const beat = await generateValidatedBeat(ctx);

  const [{ filename: imageFilename }, narrationFilename] = await Promise.all([
    generateSceneImage({
      character: ctx.character,
      worldSetting: ctx.worldSetting,
      sceneDescription: beat.imagePrompt,
      campaignId,
    }),
    generateNarration({ prose: beat.prose, campaignId }),
  ]);

  return { beat, imageFilename, narrationFilename };
}
