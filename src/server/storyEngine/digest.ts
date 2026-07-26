import { db } from "@/server/db";
import { modelConfig } from "@/server/config/models";
import { openai } from "@/server/openaiClient";

/** How many of the most recent scenes stay as raw context in every prompt.
 * Everything older gets folded into the digest instead, bounding prompt
 * size for long campaigns per the brief's memory requirement. */
export const KEEP_RECENT_SCENES = 3;

/**
 * Recomputes Campaign.digestSummary from every scene except the most
 * recent KEEP_RECENT_SCENES, if there are enough older scenes to bother
 * digesting. Recomputes from scratch each time rather than appending
 * incrementally — simpler, and cheap enough for a bedtime-length campaign.
 * No-op (and no API call) if there's nothing old enough to digest yet.
 */
export async function updateDigestIfNeeded(campaignId: string): Promise<void> {
  const scenes = await db.scene.findMany({
    where: { campaignId },
    orderBy: { order: "asc" },
  });

  const olderScenes = scenes.slice(0, Math.max(0, scenes.length - KEEP_RECENT_SCENES));
  if (olderScenes.length === 0) {
    return;
  }

  const sceneText = olderScenes
    .map((s) => `Scene ${s.order}: ${s.prose}`)
    .join("\n");

  const response = await openai.responses.create({
    model: modelConfig.text.model,
    input: [
      {
        role: "system",
        content:
          "Summarize this Dungeons & Dragons style adventure so far in 3-5 short sentences, for use as background context in future prompts. Keep character names, key relationships, and any unresolved threads. Plain prose, no headers or bullet points.",
      },
      { role: "user", content: sceneText },
    ],
  });

  await db.campaign.update({
    where: { id: campaignId },
    data: { digestSummary: response.output_text },
  });
}
