import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { NewCampaignForm } from "@/components/NewCampaignForm";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
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
      <h1 className="text-xl font-semibold text-zinc-50">Start an adventure</h1>

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
        <NewCampaignForm characters={characters} worldSettings={worldSettings} />
      )}
    </div>
  );
}
