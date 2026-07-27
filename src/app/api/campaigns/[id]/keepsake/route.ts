import { db } from "@/server/db";
import { buildKeepsake } from "@/server/keepsake/buildKeepsake";

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || "adventure";
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      character: true,
      worldSetting: true,
      scenes: { orderBy: { order: "asc" } },
      items: { orderBy: { earnedAtScene: "asc" } },
    },
  });

  if (!campaign) {
    return Response.json({ error: "campaign_not_found" }, { status: 404 });
  }

  const pdfBytes = await buildKeepsake(campaign);
  const heroName = campaign.character.displayName ?? campaign.character.name;
  const filename = `${safeFilenamePart(heroName)}-keepsake.pdf`;

  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
