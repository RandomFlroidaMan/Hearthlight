import { createCharacterSchema } from "@/lib/characterSchema";
import { db } from "@/server/db";
import { parseJsonBody } from "@/server/http";

export async function GET() {
  const characters = await db.character.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ characters });
}

export async function POST(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = createCharacterSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_character_data", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const character = await db.character.create({
    data: {
      name: data.name,
      displayName: data.displayName,
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

  return Response.json({ character }, { status: 201 });
}
