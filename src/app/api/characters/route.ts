import { z } from "zod";
import { createCharacterSchema } from "@/lib/characterSchema";
import { db } from "@/server/db";
import { parseJsonBody } from "@/server/http";
import { requireFamilyId } from "@/server/auth/session";
import { generateCharacterPortrait } from "@/server/art/generatePortrait";

// A transient request flag, not part of the persisted character shape —
// kept as a route-local extension of the shared schema rather than
// touching createCharacterSchema itself, which other callers (the sheet
// import flow) also use.
const createCharacterRequestSchema = createCharacterSchema.extend({
  /** Set when the client is about to upload a photo for this character
   * right after creating it — skips the automatic text-description
   * portrait so the photo-derived one isn't immediately overwritten by a
   * slower background generation finishing after it. */
  skipAutoPortrait: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const characters = await db.character.findMany({
    where: { familyId: auth.familyId },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ characters });
}

export async function POST(request: Request) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = createCharacterRequestSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_character_data", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const character = await db.character.create({
    data: {
      familyId: auth.familyId,
      name: data.name,
      displayName: data.displayName,
      universe: data.universe,
      race: data.race,
      className: data.className,
      level: data.level,
      strength: data.strength,
      dexterity: data.dexterity,
      constitution: data.constitution,
      intelligence: data.intelligence,
      wisdom: data.wisdom,
      charisma: data.charisma,
      proficiencies: data.proficiencies,
      equipment: data.equipment,
      spells: data.spells,
      background: data.background,
      personality: data.personality,
      appearance: data.appearance,
      readingAge: data.readingAge,
      sourceSheet: data.sourceSheet,
    },
  });

  // A from-scratch character otherwise never gets a reference portrait at
  // all (nothing else in the ordinary creation flow triggers one), which
  // silently drops that character out of every scene's art-consistency
  // references. Runs in the background — same reasoning as beat
  // generation: a 10-20s image call has no business blocking this
  // response. Skipped when the client is about to upload its own photo
  // right after, so the two generations can't race and overwrite one
  // another.
  if (!data.skipAutoPortrait) {
    void generateCharacterPortrait(character.id).catch((err) => {
      console.error(`Background portrait generation failed for character ${character.id}:`, err);
    });
  }

  return Response.json({ character }, { status: 201 });
}
