import Link from "next/link";
import { db } from "@/server/db";
import { deriveSkills } from "@/lib/deriveSkills";
import { findClass } from "@/lib/dnd";

// Reads live from the DB on every request. Without this, Next statically
// prerenders the list at build time and a production run (`next build &&
// next start`) would show a frozen snapshot instead of newly saved characters.
export const dynamic = "force-dynamic";

export default async function CharacterLibraryPage() {
  const characters = await db.character.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8 text-zinc-50">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Character library</h1>
        <div className="flex gap-3">
          <Link
            href="/dm/characters/import"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900"
          >
            Import sheet
          </Link>
          <Link
            href="/dm/characters/new"
            className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
          >
            New character
          </Link>
        </div>
      </div>

      {characters.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No characters yet. Portraits will show up here once the art
          pipeline (Phase 3) lands.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {characters.map((character) => {
            const proficiencies = Array.isArray(character.proficiencies)
              ? (character.proficiencies as unknown[]).filter(
                  (p): p is string => typeof p === "string",
                )
              : [];
            const skills = deriveSkills({
              className: character.className,
              level: character.level,
              strength: character.strength,
              dexterity: character.dexterity,
              constitution: character.constitution,
              intelligence: character.intelligence,
              wisdom: character.wisdom,
              charisma: character.charisma,
              proficiencies,
            });
            const classInfo = findClass(character.className);

            return (
              <li
                key={character.id}
                className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {character.name}{" "}
                    <span className="text-sm text-zinc-400">
                      — {character.displayName ?? classInfo?.kidName ?? character.className}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {character.race} {character.className}, level {character.level} · reading age{" "}
                    {character.readingAge}
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-zinc-400">
                  <span>Might {skills.might >= 0 ? `+${skills.might}` : skills.might}</span>
                  <span>Magic {skills.magic >= 0 ? `+${skills.magic}` : skills.magic}</span>
                  <span>Cunning {skills.cunning >= 0 ? `+${skills.cunning}` : skills.cunning}</span>
                  <span>Heart {skills.heart >= 0 ? `+${skills.heart}` : skills.heart}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
