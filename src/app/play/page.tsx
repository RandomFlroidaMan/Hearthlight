import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { LogoutButton } from "@/components/LogoutButton";
import { DeleteCampaignButton } from "@/components/DeleteCampaignButton";
import { publicImageUrl } from "@/server/art/imageStore";

export const dynamic = "force-dynamic";

/**
 * The family single-screen mode landing page — start a new party adventure,
 * resume one already in progress, browse past adventures, or jump to the
 * character library and DM tools. This is the recommended entry point;
 * /dm and /story remain as the original two-device operator mode.
 */
export default async function PlayHome() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  const [activeCampaigns, endedCampaigns, characters] = await Promise.all([
    db.campaign.findMany({
      where: { status: "active", familyId: family.id },
      include: { characters: { include: { character: true } }, worldSetting: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.campaign.findMany({
      where: { status: "ended", familyId: family.id },
      include: { characters: { include: { character: true } }, worldSetting: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.character.findMany({
      where: { familyId: family.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-950 p-8 text-zinc-50">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Play together</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{family.name}</span>
          <Link href="/dm" className="hover:text-zinc-200">
            DM tools →
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

      {activeCampaigns.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">Continue an adventure in progress</p>
          {activeCampaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 hover:bg-zinc-800"
            >
              <Link href={`/play/campaigns/${c.id}`} className="flex-1">
                <span className="font-medium">
                  {c.characters.map((link) => link.character.displayName ?? link.character.name).join(" & ")}
                </span>
                <span className="text-zinc-500"> in {c.worldSetting.name}</span>
              </Link>
              <DeleteCampaignButton campaignId={c.id} label="this adventure" />
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Your characters</p>
          <Link href="/dm/characters" className="text-sm text-zinc-400 hover:text-zinc-200">
            Character library →
          </Link>
        </div>
        {characters.length === 0 ? (
          <Link
            href="/dm/characters/new"
            className="w-fit rounded-md border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            No characters yet — create your first one →
          </Link>
        ) : (
          <div className="flex flex-wrap gap-3">
            {characters.map((character) => (
              <Link
                key={character.id}
                href="/dm/characters"
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-1 pr-4 hover:bg-zinc-800"
              >
                {character.portraitPath ? (
                  <Image
                    src={publicImageUrl(character.portraitPath)}
                    alt={`${character.name}'s portrait`}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-500">
                    ?
                  </span>
                )}
                <span className="text-sm">{character.displayName ?? character.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {endedCampaigns.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">Past adventures</p>
          {endedCampaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:bg-zinc-800"
            >
              <Link href={`/play/campaigns/${c.id}`} className="flex-1">
                <span className="font-medium text-zinc-300">
                  {c.characters.map((link) => link.character.displayName ?? link.character.name).join(" & ")}
                </span>
                <span className="text-zinc-500"> in {c.worldSetting.name}</span>
                <span className="ml-2 text-xs text-zinc-600">— finished</span>
              </Link>
              <DeleteCampaignButton campaignId={c.id} label="this adventure" />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
