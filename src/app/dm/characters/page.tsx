import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { deriveSkills } from "@/lib/deriveSkills";
import { findClassInfo } from "@/lib/startrek";
import { toStringArray } from "@/lib/json";
import { publicImageUrl } from "@/server/art/imageStore";
import { PortraitPhotoUpload } from "@/components/PortraitPhotoUpload";

// Reads live from the DB on every request. Without this, Next statically
// prerenders the list at build time and a production run (`next build &&
// next start`) would show a frozen snapshot instead of newly saved characters.
export const dynamic = "force-dynamic";

export default async function CharacterLibraryPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  const characters = await db.character.findMany({
    where: { familyId: family.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8 text-zinc-50">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Home
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Character library</h1>
        <div className="flex gap-3">
          <Link
            href="/dm/characters/shared"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900"
          >
            Shared vault
          </Link>
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

      {characters.length > 0 && (
        <Link
          href="/play/campaigns/new"
          className="w-fit rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Play together →
        </Link>
      )}

      {characters.length === 0 ? (
        <p className="text-sm text-zinc-400">No characters yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {characters.map((character) => {
            const proficiencies = toStringArray(character.proficiencies);
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
            const classInfo = findClassInfo(character.className);

            return (
              <li
                key={character.id}
                className="flex items-center justify-between gap-4 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {character.portraitPath ? (
                    <Image
                      src={publicImageUrl(character.portraitPath)}
                      alt={`${character.name}'s portrait`}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-500">
                      no art
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {character.name}{" "}
                      <span className="text-sm text-zinc-400">
                        — {character.displayName ?? classInfo?.kidName ?? character.className}
                      </span>
                      {character.universe === "star-trek" && <span className="ml-2">🖖</span>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {character.race} {character.className}, level {character.level} · reading age{" "}
                      {character.readingAge}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span>Might {skills.might >= 0 ? `+${skills.might}` : skills.might}</span>
                  <span>Magic {skills.magic >= 0 ? `+${skills.magic}` : skills.magic}</span>
                  <span>Cunning {skills.cunning >= 0 ? `+${skills.cunning}` : skills.cunning}</span>
                  <span>Heart {skills.heart >= 0 ? `+${skills.heart}` : skills.heart}</span>
                  <PortraitPhotoUpload characterId={character.id} hasPortrait={Boolean(character.portraitPath)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
