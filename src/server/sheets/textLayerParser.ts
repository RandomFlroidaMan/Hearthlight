import "./pdfWorkerSetup";
import { PDFParse } from "pdf-parse";
import { zodTextFormat } from "openai/helpers/zod";
import { characterSheetSchema } from "@/lib/characterSchema";
import { modelConfig } from "@/server/config/models";
import { openai } from "@/server/openaiClient";
import type { ParsedSheet } from "./types";

/** Deterministic — no OpenAI call, fully verifiable without billing. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

const SYSTEM_PROMPT = `You extract structured data from the raw text of a Dungeons & Dragons 5th edition character sheet. The text was pulled from a PDF and may have jumbled spacing or line breaks from the original layout.

Fill in every field of the schema as best you can from the text. If a value genuinely isn't present anywhere in the text, use a reasonable default (10 for an unknown ability score, 1 for an unknown level, an empty array for unknown lists, null for unknown optional text) rather than guessing a plausible-sounding but fabricated value.`;

/**
 * Text extraction above is verified (round-tripped in tests). This function
 * additionally calls the OpenAI Responses API to map that raw text onto our
 * schema — that part is wired to the shape confirmed against the installed
 * SDK's types and a live (billing-blocked) request, but has not actually
 * returned real data yet since this account has no billing. Don't trust the
 * accuracy of this path until it's been run for real.
 */
export async function parseTextLayerPdf(buffer: Buffer): Promise<ParsedSheet> {
  const text = await extractPdfText(buffer);

  const response = await openai.responses.create({
    model: modelConfig.text.model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    text: { format: zodTextFormat(characterSheetSchema, "character_sheet") },
  });

  const data = characterSheetSchema.parse(JSON.parse(response.output_text));

  return {
    data,
    warnings: [
      "This sheet was read by AI from a text-layer PDF — double-check every field before saving.",
    ],
  };
}
