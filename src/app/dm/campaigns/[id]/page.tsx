import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { CampaignPlayView } from "@/components/CampaignPlayView";
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

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      character: true,
      worldSetting: true,
      scenes: { orderBy: { order: "desc" }, take: 1 },
    },
  });

  if (!campaign) notFound();

  const latestScene = campaign.scenes[0];
  if (!latestScene) {
    // Shouldn't happen — campaign creation always generates the first beat
    // synchronously — but fail loudly rather than rendering a blank page.
    throw new Error(`Campaign ${id} has no scenes.`);
  }

  const skills = deriveSkills({
    className: campaign.character.className,
    level: campaign.character.level,
    strength: campaign.character.strength,
    dexterity: campaign.character.dexterity,
    constitution: campaign.character.constitution,
    intelligence: campaign.character.intelligence,
    wisdom: campaign.character.wisdom,
    charisma: campaign.character.charisma,
    proficiencies: toStringArray(campaign.character.proficiencies),
  });

  // No settings-management UI exists yet — this just reads the singleton
  // row the schema already defines, defaulting false if it's never been created.
  const settings = await db.settings.findUnique({ where: { id: "default" } });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <div className="flex items-center justify-between">
        <Link href="/dm" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← DM screen
        </Link>
        <Link
          href={`/story/campaigns/${campaign.id}`}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          Open story screen →
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-zinc-50">
        {campaign.character.name} in {campaign.worldSetting.name}
      </h1>
      <CampaignPlayView
        campaignId={campaign.id}
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
        readingAge={campaign.character.readingAge}
        skills={skills}
        dmFudgeEnabled={settings?.dmFudgeEnabled ?? false}
      />
    </div>
  );
}
