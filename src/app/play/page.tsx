import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

/**
 * The family single-screen mode landing page — start a new party adventure,
 * or resume one already in progress. This is the recommended entry point;
 * /dm and /story remain as the original two-device operator mode.
 */
export default async function PlayHome() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  const campaigns = await db.campaign.findMany({
    where: { status: "active", familyId: family.id },
    include: { characters: { include: { character: true } }, worldSetting: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8 text-zinc-50">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Play together</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{family.name}</span>
          <Link href="/dm" className="hover:text-zinc-200">
            Two-device mode →
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/play/campaigns/new"
          className="w-fit rounded-full bg-zinc-50 px-5 py-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
        >
          Start a new adventure
        </Link>
        <Link
          href="/play/join"
          className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-50 hover:bg-zinc-900"
        >
          Join with a room code
        </Link>
      </div>

      {campaigns.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">Continue an adventure in progress</p>
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/play/campaigns/${c.id}`}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 hover:bg-zinc-800"
            >
              <span className="font-medium">
                {c.characters.map((link) => link.character.displayName ?? link.character.name).join(" & ")}
              </span>
              <span className="text-zinc-500"> in {c.worldSetting.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
