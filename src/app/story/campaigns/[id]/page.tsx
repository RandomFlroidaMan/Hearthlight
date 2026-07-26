import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { StoryScreenView } from "@/components/StoryScreenView";
import type { Choice } from "@/server/storyEngine/beatSchema";

export const dynamic = "force-dynamic";

export default async function StoryCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: { scenes: { orderBy: { order: "desc" }, take: 1 } },
  });

  if (!campaign) notFound();

  const latestScene = campaign.scenes[0];
  if (!latestScene) {
    throw new Error(`Campaign ${id} has no scenes.`);
  }

  return (
    <StoryScreenView
      campaignId={campaign.id}
      initialScene={{
        id: latestScene.id,
        prose: latestScene.prose,
        imagePath: latestScene.imagePath,
        choices: latestScene.choices as unknown as Choice[],
        isEnding: latestScene.isEnding,
      }}
    />
  );
}
