import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { StoryScreenView } from "@/components/StoryScreenView";
import { getAudioManifest } from "@/server/audio/assetManifest";
import type { Choice } from "@/server/storyEngine/beatSchema";

export const dynamic = "force-dynamic";

export default async function StoryCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaign, settings, audioManifest] = await Promise.all([
    db.campaign.findUnique({
      where: { id },
      include: { scenes: { orderBy: { order: "desc" }, take: 1 } },
    }),
    db.settings.findUnique({ where: { id: "default" } }),
    getAudioManifest(),
  ]);

  if (!campaign) notFound();

  const latestScene = campaign.scenes[0];
  if (!latestScene) {
    throw new Error(`Campaign ${id} has no scenes.`);
  }

  return (
    <StoryScreenView
      campaignId={campaign.id}
      roomCode={campaign.roomCode}
      initialScene={{
        id: latestScene.id,
        prose: latestScene.prose,
        imagePath: latestScene.imagePath,
        narrationPath: latestScene.narrationPath,
        ambientTrack: latestScene.ambientTrack,
        choices: latestScene.choices as unknown as Choice[],
        isEnding: latestScene.isEnding,
      }}
      initialMute={{
        narrationMuted: settings?.narrationMuted ?? false,
        ambienceMuted: settings?.ambienceMuted ?? false,
        effectsMuted: settings?.effectsMuted ?? false,
      }}
      audioManifest={audioManifest}
    />
  );
}
