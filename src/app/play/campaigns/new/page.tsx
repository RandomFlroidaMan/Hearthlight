import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { PartyCampaignForm } from "@/components/PartyCampaignForm";
import { ADVENTURES } from "@/lib/adventures";

export const dynamic = "force-dynamic";

export default async function NewPartyCampaignPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  const [characters, worldSettings] = await Promise.all([
    db.character.findMany({
      where: { familyId: family.id },
      select: { id: true, name: true, displayName: true },
      orderBy: { createdAt: "desc" },
    }),
    db.worldSetting.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <Link href="/play" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Play together
      </Link>
      <h1 className="text-xl font-semibold text-zinc-50">Start an adventure</h1>

      {characters.length === 0 ? (
        <p className="text-sm text-amber-400">
          You need at least one character first —{" "}
          <Link href="/dm/characters/new" className="underline">
            create a character
          </Link>
          .
        </p>
      ) : (
        <PartyCampaignForm characters={characters} adventures={ADVENTURES} worldSettings={worldSettings} />
      )}
    </div>
  );
}
