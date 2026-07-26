import { z } from "zod";

const abilityScore = z.number().int().min(1).max(30);

/**
 * Shared shape for a character sheet, whether it came from the from-scratch
 * creation form or was parsed from an uploaded PDF/photo. The confirmation
 * screen edits this same shape before it's written to the Character table.
 *
 * Optional fields are `.nullable()` rather than `.optional()` on purpose:
 * OpenAI's strict Structured Outputs mode requires every property to appear
 * in the schema's `required` list, so "optional" has to be modeled as
 * nullable rather than absent. Keeping one shape everywhere (LLM output,
 * form state, DB write) avoids a translation layer between them.
 */
export const characterSheetSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1).nullable(),
  race: z.string().min(1),
  className: z.string().min(1),
  level: z.number().int().min(1).max(20),
  strength: abilityScore,
  dexterity: abilityScore,
  constitution: abilityScore,
  intelligence: abilityScore,
  wisdom: abilityScore,
  charisma: abilityScore,
  proficiencies: z.array(z.string()),
  equipment: z.array(z.string()),
  spells: z.array(z.string()),
  background: z.string().nullable(),
  personality: z.string().nullable(),
  appearance: z.string().nullable(),
});

export type CharacterSheetData = z.infer<typeof characterSheetSchema>;

export const readingAges = [3, 5, 7, 10] as const;
export type ReadingAge = (typeof readingAges)[number];

/** What the client sends to POST /api/characters: sheet data plus the
 * Hearthlight-specific settings that aren't part of a 5e sheet. */
export const createCharacterSchema = characterSheetSchema.extend({
  readingAge: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(10)]),
  sourceSheet: z.string().nullable(),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
