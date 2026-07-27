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

  const campaignRow = await db.campaign.findUnique({
    where: { id },
    include: {
      characters: { include: { character: true } },
      worldSetting: true,
      scenes: { orderBy: { order: "asc" } },
      items: { orderBy: { earnedAtScene: "asc" } },
    },
  });

  if (!campaignRow) {
    return Response.json({ error: "campaign_not_found" }, { status: 404 });
  }

  const { characters: partyLinks, ...campaign } = campaignRow;
  const characters = partyLinks.map((link) => link.character);

  const pdfBytes = await buildKeepsake({ ...campaign, characters });
  const heroName = characters.map((c) => c.displayName ?? c.name).join("-and-");
  const filename = `${safeFilenamePart(heroName)}-keepsake.pdf`;

  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
