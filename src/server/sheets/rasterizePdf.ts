import "./pdfWorkerSetup";
import { PDFParse } from "pdf-parse";

/** Renders a PDF's first page to a PNG data URL — used for scanned sheets
 * with no text layer, so they can go through the same vision path as a
 * direct photo upload. Deterministic, no OpenAI call. */
export async function rasterizeFirstPage(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getScreenshot({ first: 1, imageDataUrl: true, imageBuffer: false });
    const page = result.pages[0];
    if (!page) {
      throw new Error("Could not render any page from this PDF.");
    }
    return page.dataUrl;
  } finally {
    await parser.destroy();
  }
}
