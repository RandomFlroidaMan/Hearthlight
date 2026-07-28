import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { CopyCharacterButton } from "@/components/CopyCharacterButton";
import { deriveSkills } from "@/lib/deriveSkills";
import { findClassInfo } from "@/lib/startrek";
import { toStringArray } from "@/lib/json";

export const dynamic = "force-dynamic";

/**
 * Every family's characters, across the whole deployment — "find other
 * family stories/characters in case they want to use them" from the brief.
 * Copying makes an independent duplicate under the current family rather
 * than sharing the row directly, so each family can freely level up or
 * bring their copy into their own campaigns without touching the original.
 */
export default async function SharedCharacterVaultPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  const characters = await db.character.findMany({
    include: { family: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8 text-zinc-50">
      <Link href="/dm/characters" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Character library
      </Link>
      <h1 className="text-xl font-semibold">Shared character vault</h1>
      <p className="max-w-lg text-sm text-zinc-400">
        Every character any family on this Hearthlight has created. Copy one
        into your own library to bring it into your adventures — a Klingon
        warrior, a wizard from across the deployment, whatever fits.
      </p>

      {characters.length === 0 ? (
        <p className="text-sm text-zinc-400">No characters yet, anywhere.</p>
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
            const isOwnFamily = character.familyId === family.id;

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
                    {character.universe === "star-trek" && <span className="ml-2">🖖</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {character.race} {character.className}, level {character.level} ·{" "}
                    <span className="text-amber-400/80">from {character.family.name}</span>
                  </p>
                  <p className="mt-1 flex gap-4 text-xs text-zinc-400">
                    <span>Might {skills.might >= 0 ? `+${skills.might}` : skills.might}</span>
                    <span>Magic {skills.magic >= 0 ? `+${skills.magic}` : skills.magic}</span>
                    <span>Cunning {skills.cunning >= 0 ? `+${skills.cunning}` : skills.cunning}</span>
                    <span>Heart {skills.heart >= 0 ? `+${skills.heart}` : skills.heart}</span>
                  </p>
                </div>
                {isOwnFamily ? (
                  <span className="text-xs text-zinc-500">Yours</span>
                ) : (
                  <CopyCharacterButton characterId={character.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
