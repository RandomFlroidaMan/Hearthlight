import { db } from "@/server/db";
import { requireFamilyId } from "@/server/auth/session";
import type { Prisma } from "@/generated/prisma/client";

// Lets any logged-in family pull a character from the shared vault into
// their own library — a real duplicate row, not a shared reference, so
// each family can level up / reuse it independently afterward.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const source = await db.character.findUnique({ where: { id } });
  if (!source) {
    return Response.json({ error: "character_not_found" }, { status: 404 });
  }

  const character = await db.character.create({
    data: {
      familyId: auth.familyId,
      name: source.name,
      displayName: source.displayName,
      universe: source.universe,
      race: source.race,
      className: source.className,
      level: source.level,
      strength: source.strength,
      dexterity: source.dexterity,
      constitution: source.constitution,
      intelligence: source.intelligence,
      wisdom: source.wisdom,
      charisma: source.charisma,
      proficiencies: source.proficiencies as unknown as Prisma.InputJsonValue,
      equipment: source.equipment as unknown as Prisma.InputJsonValue,
      spells: source.spells as unknown as Prisma.InputJsonValue,
      background: source.background,
      personality: source.personality,
      appearance: source.appearance,
      readingAge: source.readingAge,
      portraitPath: source.portraitPath,
      sourceSheet: source.sourceSheet,
    },
  });

  return Response.json({ character }, { status: 201 });
}
