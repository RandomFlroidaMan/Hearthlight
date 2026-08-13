import "./pdfWorkerSetup";
import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import type { SheetKind } from "./types";

/** Below this many characters, a PDF's "text layer" is probably just stray
 * OCR noise or empty, not real sheet content — treat it as a scan instead. */
const MIN_TEXT_LENGTH = 40;

/** Distinguishes "we don't accept this mime type" from any other failure
 * while classifying (corrupt PDF, library error, etc.) so the API route can
 * report each honestly instead of lumping every failure under one label. */
export class UnsupportedFileTypeError extends Error {}

export async function classifySheet(buffer: Buffer, mimeType: string): Promise<SheetKind> {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType !== "application/pdf") {
    throw new UnsupportedFileTypeError(`Unsupported file type: ${mimeType}`);
  }

  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  if (pdfDoc.getForm().getFields().length > 0) {
    return "form-field-pdf";
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    if (textResult.text.trim().length >= MIN_TEXT_LENGTH) {
      return "text-layer-pdf";
    }
  } finally {
    await parser.destroy();
  }

  return "scanned-pdf";
}
