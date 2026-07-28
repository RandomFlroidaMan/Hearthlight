import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { ArtConsistencyTest } from "@/components/ArtConsistencyTest";

export const dynamic = "force-dynamic";

export default async function ArtTestPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  const [characters, worldSettings] = await Promise.all([
    db.character.findMany({
      where: { familyId: family.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    db.worldSetting.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <Link href="/dm" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← DM screen
      </Link>
      <h1 className="text-xl font-semibold text-zinc-50">Art consistency test</h1>
      <p className="max-w-lg text-sm text-zinc-400">
        A manual verification tool, not the real game loop (that&apos;s Phase 4).
        Generates several scenes with the same character portrait and world
        setting references so you can eyeball whether the art pipeline
        actually holds a consistent look — this is the brief&apos;s own gate
        before anything else gets built on top of it.
      </p>

      {characters.length === 0 || worldSettings.length === 0 ? (
        <p className="text-sm text-amber-400">
          You need at least one character and one world setting first —{" "}
          <Link href="/dm/characters/new" className="underline">
            create a character
          </Link>{" "}
          and{" "}
          <Link href="/dm/settings/new" className="underline">
            a world setting
          </Link>
          .
        </p>
      ) : (
        <ArtConsistencyTest characters={characters} worldSettings={worldSettings} />
      )}
    </div>
  );
}
