import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfText } from "../textLayerParser";

/**
 * Only the deterministic text-extraction half is tested here. The LLM
 * mapping half (parseTextLayerPdf) needs a live OpenAI call and this
 * account currently has no billing set up (insufficient_quota) — see the
 * comment on parseTextLayerPdf. Testing extraction alone still proves the
 * PDF text layer actually gets read correctly, which is the deterministic
 * building block that step depends on.
 */
describe("extractPdfText", () => {
  it("extracts drawn text from a non-form PDF", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([400, 400]);
    page.drawText("Character Name: Quinn", { x: 20, y: 360, size: 14, font });
    page.drawText("Race: Halfling", { x: 20, y: 340, size: 14, font });
    page.drawText("Class: Rogue, Level 3", { x: 20, y: 320, size: 14, font });

    const buffer = Buffer.from(await pdfDoc.save());
    const text = await extractPdfText(buffer);

    expect(text).toContain("Character Name: Quinn");
    expect(text).toContain("Race: Halfling");
    expect(text).toContain("Class: Rogue, Level 3");
  });
});
