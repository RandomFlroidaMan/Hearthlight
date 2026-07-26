import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { rasterizeFirstPage } from "../rasterizePdf";

describe("rasterizeFirstPage", () => {
  it("renders a real PDF page to a PNG data URL", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([400, 400]);
    page.drawText("scanned sheet stand-in", { x: 20, y: 200, size: 20, font });

    const buffer = Buffer.from(await pdfDoc.save());
    const dataUrl = await rasterizeFirstPage(buffer);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    // Sanity check it's real, decodable image bytes, not an empty stub.
    const base64 = dataUrl.split(",")[1];
    const bytes = Buffer.from(base64, "base64");
    expect(bytes.length).toBeGreaterThan(500);
    // PNG magic number
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});
