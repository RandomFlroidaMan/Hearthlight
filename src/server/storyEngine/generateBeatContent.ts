import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/server/openaiClient";
import { modelConfig } from "@/server/config/models";
import { generateSceneImage } from "@/server/art/generateSceneImage";
import { generateNarration } from "@/server/audio/generateNarration";
import { deriveSkills } from "@/lib/deriveSkills";
import { findClassInfo } from "@/lib/startrek";
import { toStringArray } from "@/lib/json";
import { GENRE_FLAVOR, crossoverGuidance, type Genre } from "./genreFlavor";
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

const GENTLE_SAFETY_RULES = `SAFETY RULES — follow these exactly, no exceptions:
- Conflict is ONLY ever with fantastical monsters (goblins, trolls, slimes, imps, grumpy dragons, and similar). NEVER with humans, people, children, or any humanoid person.
- NEVER use or imply: kill, die, dead, hurt, blood, wound, weapon injury, cruelty, or abandonment. Nothing frightening at bedtime.
- Use only these kinds of outcomes: defeated, bonked, booped, out-smarted, out-run, out-sung, shooed away, sent home, chased off, routed, tucked in for a nap, befriended, calmed, cheered up.
- Monsters are never harmed — they give up, wander off, or become friends.
- A failed choice is always a gentle, funny setback — never harm, never the end of the adventure.
- No character death, no permanent loss, no "game over."`;

/** The family's parent-controlled mature-combat setting (Settings.matureCombatEnabled),
 * age-gated to a party where every member is 10+. Still keeps the human-conflict
 * rule absolute and still bans gore/distress vocabulary — this only allows the
 * story to be honest that a monster fight has real stakes, plainly stated,
 * never graphic. */
const MATURE_SAFETY_RULES = `SAFETY RULES — follow these exactly, no exceptions:
- Conflict is ONLY ever with fantastical monsters (goblins, trolls, orcs, dragons, undead, and similar). NEVER with humans, people, children, or any humanoid person — this rule is absolute regardless of anything else below.
- Combat can be real: a monster can be killed or destroyed in combat, stated plainly and briefly. This is allowed, but never required — outsmarting, driving off, or befriending a monster is just as valid an outcome as defeating it.
- NEVER include graphic detail: no blood, no gore, no described wounds, no lingering suffering, no cruelty, no torture. State an outcome plainly ("the dragon is defeated") and move on — do not dwell on it.
- A failed choice is a real setback with stakes, but never permanent for the party's own characters in a way that ends the adventure — a party member is never killed. Danger is real; the ending is never grim.
- No graphic violence, no cruelty, no torture, no abandonment, no content beyond a PG adventure-movie level of intensity.`;

/** Left to itself the model leans heavily on "talk to the monster" —
 * charming, tickling, singing. Not every monster wants to chat, and a
 * kid should get to be the hero who just whacks the slime, not only the
 * diplomat. This nudges real variety into the 2-3 choices per beat. */
const CHOICE_VARIETY_GUIDANCE = `CHOICE VARIETY — vary how the party can act, beat to beat:
- Not every monster is up for a conversation. At least some beats should offer a direct, physical, silly-brave option — bonk it with a shield, boop its nose, chase it off yelling "get outta here!" — usually a Might check, not always talking/charming/out-smarting it.
- Across a whole adventure, mix it up: sometimes the answer is talking it out (Heart/Cunning), sometimes it's a clever trick (Cunning/Magic), sometimes it's just directly, bravely dealing with it (Might). Don't make every single obstacle a diplomacy puzzle.
- A "bonk"/chase-off/direct-action choice is still gentle per the safety rules above — it's silly and cartoonish (think bonking a cartoon slime on the head), never violent or scary.`;

const ACT_GUIDANCE: Record<Act, string> = {
  setup: "This is the opening beat. Introduce the world and give a low-stakes first choice.",
  journey: "Middle of the adventure. Exploration, meeting friendly or silly characters, building toward something.",
  complication: "A small fantastical obstacle appears (a silly monster, a puzzle). Raise stakes gently, not scarily. The \"danger\" ambient track usually fits here.",
  climax: "The biggest moment of the adventure — a bigger (but still friendly-at-heart) fantastical creature or challenge to overcome. The \"danger\" ambient track usually fits here.",
  resolution: "Wrap up warmly. This should be (or lead directly to) the ending — set isEnding to true.",
};

export interface BeatContext {
  /** The whole party — one or more characters. */
  characters: Character[];
  /** Snapshotted at campaign creation (the youngest party member's age),
   * so prose difficulty and roll complexity never shift mid-campaign. */
  readingAge: number;
  /** Settings.matureCombatEnabled, already gated by the caller to only be
   * true when every party member is 10+. */
  matureCombatAllowed: boolean;
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
  const classInfo = findClassInfo(character.className);
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

/** Every member of the party, so the story treats this as a group
 * adventure rather than one hero with silent companions. */
function partySummary(characters: Character[]): string {
  if (characters.length === 1) {
    return characterSummary(characters[0]);
  }
  return characters.map((c, i) => `(${i + 1}) ${characterSummary(c)}`).join(" ");
}

function buildUserPrompt(ctx: BeatContext): string {
  const partyLabel = ctx.characters.length > 1 ? "PARTY" : "CHARACTER";
  const parts: string[] = [
    `WORLD: ${ctx.worldSetting.name} — ${ctx.worldSetting.description}`,
    `${partyLabel}: ${partySummary(ctx.characters)}`,
    ...(ctx.characters.length > 1
      ? ["The whole party adventures and decides together — every choice is a group choice, not one character acting alone."]
      : []),
    `CURRENT ACT: ${ctx.act}. ${ACT_GUIDANCE[ctx.act]}`,
  ];

  const crossover = crossoverGuidance((ctx.worldSetting.genre as Genre) ?? "fantasy", ctx.characters);
  if (crossover) {
    parts.push(crossover);
  }

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
  const readingAgeGuidance = READING_AGE_GUIDANCE[ctx.readingAge] ?? READING_AGE_GUIDANCE[5];
  const safetyRules = ctx.matureCombatAllowed ? MATURE_SAFETY_RULES : GENTLE_SAFETY_RULES;
  const genreFlavor = GENRE_FLAVOR[(ctx.worldSetting.genre as Genre) ?? "fantasy"];

  const response = await openai.responses.create({
    model: modelConfig.text.model,
    input: [
      {
        role: "system",
        content: [
          "You are the Dungeon Master for a wondrous family adventure.",
          safetyRules,
          readingAgeGuidance,
          CHOICE_VARIETY_GUIDANCE,
          genreFlavor,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      { role: "user", content: buildUserPrompt(ctx) },
    ],
    text: { format: zodTextFormat(beatSchema, "story_beat") },
    // Writing 2-4 kid-friendly sentences and 2-3 choices from a heavily
    // scaffolded prompt doesn't need heavy multi-step reasoning — left
    // unset this defaults to a much slower effort tier, and reasoning time
    // was the single biggest contributor to "over a minute to load a
    // story." Structured Outputs still enforces the schema regardless of
    // effort, so this doesn't risk malformed output, just less internal
    // deliberation before writing.
    reasoning: { effort: "low" },
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
    const result = validateBeat(beat, { matureCombatAllowed: ctx.matureCombatAllowed });
    if (result.valid) {
      return beat;
    }
    violations = result.violations;
  }

  return FALLBACK_BEATS[ctx.act];
}

export interface BeatMedia {
  imageFilename: string;
  narrationFilename: string | null;
}

/** The text half of a beat — the LLM call and content-policy validation.
 * Split out from art/narration so a caller can show the prose and choices
 * the moment they're ready instead of waiting on the slower art call too
 * (art generation is the dominant cost in "how long until the next beat
 * shows up," easily 10-20+ seconds even at medium quality — there's no
 * reason a family should stare at a blank screen for that on top of the
 * few seconds text takes). */
export async function generateBeatText(ctx: BeatContext): Promise<Beat> {
  return generateValidatedBeat(ctx);
}

/** The art+narration half, run once the beat's text (and therefore its
 * image prompt and prose) is known. Independent of each other, so this
 * halves the added latency versus running them sequentially. */
export async function generateBeatMedia(
  beat: Beat,
  ctx: { characters: Character[]; worldSetting: WorldSetting },
  campaignId: string,
): Promise<BeatMedia> {
  const [{ filename: imageFilename }, narrationFilename] = await Promise.all([
    generateSceneImage({
      characters: ctx.characters,
      worldSetting: ctx.worldSetting,
      sceneDescription: beat.imagePrompt,
      campaignId,
    }),
    generateNarration({ prose: beat.prose, campaignId }),
  ]);

  return { imageFilename, narrationFilename };
}

/** The full content pipeline for one beat, text then media — a
 * convenience for callers that don't need the progressive text-then-media
 * reveal (see generateBeatText/generateBeatMedia for that). */
export async function generateBeatContent(ctx: BeatContext, campaignId: string): Promise<BeatContent> {
  const beat = await generateBeatText(ctx);
  const media = await generateBeatMedia(beat, ctx, campaignId);
  return { beat, ...media };
}
