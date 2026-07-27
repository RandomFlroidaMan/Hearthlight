import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { CampaignPlayView } from "@/components/CampaignPlayView";
import { deriveSkills } from "@/lib/deriveSkills";
import { toStringArray } from "@/lib/json";
import type { Choice } from "@/server/storyEngine/beatSchema";

export const dynamic = "force-dynamic";

/**
 * The family single-screen mode: one shared view for the whole party, no
 * DM notes, no room code, no second device. Reuses CampaignPlayView with
 * showDmTools off — see that component for why it's shared with /dm rather
 * than duplicated.
 */
export default async function PlayCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaignRow = await db.campaign.findUnique({
    where: { id },
    include: {
      characters: { include: { character: true }, orderBy: { createdAt: "asc" } },
      worldSetting: true,
      scenes: { orderBy: { order: "desc" }, take: 1 },
    },
  });

  if (!campaignRow) notFound();
  const { characters: partyLinks, ...campaign } = campaignRow;
  const characters = partyLinks.map((link) => link.character);

  const latestScene = campaign.scenes[0];
  if (!latestScene) {
    throw new Error(`Campaign ${id} has no scenes.`);
  }

  const party = characters.map((character) => ({
    id: character.id,
    label: character.displayName ?? character.name,
    readingAge: character.readingAge,
    skills: deriveSkills({
      className: character.className,
      level: character.level,
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.constitution,
      intelligence: character.intelligence,
      wisdom: character.wisdom,
      charisma: character.charisma,
      proficiencies: toStringArray(character.proficiencies),
    }),
  }));

  const partyLabel = characters.map((c) => c.displayName ?? c.name).join(" & ");

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <Link href="/play" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Play together
      </Link>
      <h1 className="text-xl font-semibold text-zinc-50">
        {partyLabel} in {campaign.worldSetting.name}
      </h1>
      <CampaignPlayView
        campaignId={campaign.id}
        roomCode={campaign.roomCode}
        initialScene={{
          id: latestScene.id,
          order: latestScene.order,
          act: latestScene.act,
          prose: latestScene.prose,
          imagePath: latestScene.imagePath,
          dmNotes: latestScene.dmNotes,
          choices: latestScene.choices as unknown as Choice[],
          isEnding: latestScene.isEnding,
        }}
        party={party}
        dmFudgeEnabled={false}
        showDmTools={false}
      />
    </div>
  );
}
