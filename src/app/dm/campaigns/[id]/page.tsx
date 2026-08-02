import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { CampaignPlayView } from "@/components/CampaignPlayView";
import { FirstSceneWaiter } from "@/components/FirstSceneWaiter";
import { deriveSkills } from "@/lib/deriveSkills";
import { toStringArray } from "@/lib/json";
import type { Choice } from "@/server/storyEngine/beatSchema";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
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
  const partyLabel = characters.map((c) => c.displayName ?? c.name).join(" & ");

  if (!latestScene) {
    return (
      <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
        <Link href="/dm" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← DM screen
        </Link>
        <h1 className="text-xl font-semibold text-zinc-50">
          {partyLabel} in {campaign.worldSetting.name}
        </h1>
        <FirstSceneWaiter campaignId={campaign.id} backHref="/dm/campaigns/new" />
      </div>
    );
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

  // No settings-management UI exists yet — this just reads the singleton
  // row the schema already defines, defaulting false if it's never been created.
  const settings = await db.settings.findUnique({ where: { id: "default" } });

  // "Full DM editing power" (replace scene art, author a custom beat) is
  // owner-family-only — surfaced here only when the logged-in family is
  // the one that actually started this campaign, though the real
  // enforcement lives server-side in each route, not this UI check.
  const family = await getCurrentFamily();
  const isOwner = family?.id === campaign.familyId;
  const partyCharacterIds = new Set(characters.map((c) => c.id));
  const availableCharacters = isOwner
    ? (
        await db.character.findMany({
          where: { familyId: campaign.familyId, id: { notIn: [...partyCharacterIds] } },
          select: { id: true, name: true, displayName: true },
          orderBy: { createdAt: "desc" },
        })
      ).map((c) => ({ id: c.id, label: c.displayName ?? c.name }))
    : [];

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <div className="flex items-center justify-between">
        <Link href="/dm" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← DM screen
        </Link>
        <div className="flex gap-4">
          <Link href={`/play/campaigns/${campaign.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
            Open family screen →
          </Link>
          <Link
            href={`/story/campaigns/${campaign.id}`}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Open story screen →
          </Link>
        </div>
      </div>
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
        dmFudgeEnabled={settings?.dmFudgeEnabled ?? false}
        isOwner={isOwner}
        availableCharacters={availableCharacters}
      />
    </div>
  );
}
