import type { CharacterSheetData } from "@/lib/characterSchema";

/** Every parser returns this: the best-effort sheet data, plus plain-English
 * notes about anything it couldn't confidently fill in. The confirmation
 * screen shows both — never silently accept a bad parse. */
export interface ParsedSheet {
  data: CharacterSheetData;
  warnings: string[];
}

export type SheetKind = "form-field-pdf" | "text-layer-pdf" | "image" | "scanned-pdf";
