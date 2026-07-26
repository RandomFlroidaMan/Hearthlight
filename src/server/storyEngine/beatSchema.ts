import { z } from "zod";

/**
 * One generated story beat: prose, 2-3 choices, private DM notes, an image
 * prompt, an ambient-audio tag, an optional item reward, and an ending
 * flag — matches the brief's §10 structured-output spec exactly.
 *
 * Nullable rather than optional throughout, for the same reason as
 * characterSchema.ts: OpenAI's strict Structured Outputs mode requires
 * every property in `required`, so "optional" has to mean nullable.
 */

export const skillNames = ["might", "magic", "cunning", "heart"] as const;
export type SkillName = (typeof skillNames)[number];

export const ambientTracks = ["forest", "cave", "coast", "night", "village", "none"] as const;

export const choiceSchema = z.object({
  text: z.string().min(1),
  /** null if this choice doesn't need a roll at all. */
  skill: z.enum(skillNames).nullable(),
  dc: z.number().int().min(1).max(30).nullable(),
  /** Brief DM-facing note on what happens on success — never shown to the story screen. */
  successHint: z.string().nullable(),
  /** Brief DM-facing note on what happens on failure — always a gentle, funny setback. */
  failureHint: z.string().nullable(),
});

export const itemRewardSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export const beatSchema = z.object({
  /** 2-4 simple sentences, read aloud. */
  prose: z.string().min(1),
  choices: z.array(choiceSchema).min(2).max(3),
  /** Private DM guidance — never shown to the story screen. */
  dmNotes: z.string(),
  /** Fed directly into generateSceneImage as the scene description. */
  imagePrompt: z.string().min(1),
  ambientTrack: z.enum(ambientTracks).nullable(),
  itemReward: itemRewardSchema.nullable(),
  isEnding: z.boolean(),
});

export type Choice = z.infer<typeof choiceSchema>;
export type Beat = z.infer<typeof beatSchema>;
