import { PDFDocument, type PDFField } from "pdf-lib";
import type { CharacterSheetData } from "@/lib/characterSchema";
import type { ParsedSheet } from "./types";

/**
 * Field-name candidates for the most common fillable 5e character sheet
 * layout (the official Wizards of the Coast form; several other tools'
 * exports reuse the same or similar field names). This is a best-effort
 * mapping, not a guarantee — sheets from other sources may use different
 * field names entirely, which is exactly why every parse goes through an
 * editable confirmation screen before saving rather than being trusted
 * outright.
 */
const FIELD_CANDIDATES = {
  name: ["CharacterName"],
  race: ["Race", "Race "],
  classLevel: ["ClassLevel"],
  background: ["Background"],
  personality: ["PersonalityTraits"],
  appearance: ["CharacterAppearance", "Appearance"],
  equipment: ["Equipment"],
  proficiencies: ["ProficienciesLang", "Proficiencies"],
  strength: ["STRscore", "STR score", "Strength"],
  dexterity: ["DEXscore", "DEX score", "Dexterity"],
  constitution: ["CONscore", "CON score", "Constitution"],
  intelligence: ["INTscore", "INT score", "Intelligence"],
  wisdom: ["WISscore", "WIS score", "Wisdom"],
  charisma: ["CHAscore", "CHA score", "Charisma"],
} as const;

function getFieldText(fieldsByName: Map<string, PDFField>, candidates: readonly string[]): string | undefined {
  for (const candidate of candidates) {
    const field = fieldsByName.get(candidate);
    if (field && "getText" in field && typeof field.getText === "function") {
      const text = (field.getText as () => string | undefined)();
      if (text && text.trim().length > 0) return text.trim();
    }
  }
  return undefined;
}

function splitList(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAbilityScore(text: string | undefined, warnings: string[], label: string): number {
  const n = text ? parseInt(text, 10) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 30) return n;
  warnings.push(`Couldn't read ${label} score — defaulted to 10, please check.`);
  return 10;
}

/** "Wizard 3" -> { className: "Wizard", level: 3 }. Falls back gracefully if
 * the combined field doesn't parse cleanly. */
function parseClassLevel(text: string | undefined): { className: string; level: number } {
  if (!text) return { className: "", level: 1 };
  const match = text.match(/^(.*?)\s*(\d+)\s*$/);
  if (match) {
    return { className: match[1].trim(), level: parseInt(match[2], 10) };
  }
  return { className: text.trim(), level: 1 };
}

export async function parseFormFieldPdf(buffer: Buffer): Promise<ParsedSheet> {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const fields = pdfDoc.getForm().getFields();
  const fieldsByName = new Map(fields.map((f) => [f.getName(), f] as const));

  const warnings: string[] = [];

  const name = getFieldText(fieldsByName, FIELD_CANDIDATES.name);
  if (!name) warnings.push("Couldn't find a character name field — please fill it in.");

  const { className, level } = parseClassLevel(getFieldText(fieldsByName, FIELD_CANDIDATES.classLevel));
  if (!className) warnings.push("Couldn't read class/level — please fill it in.");

  const race = getFieldText(fieldsByName, FIELD_CANDIDATES.race);
  if (!race) warnings.push("Couldn't find a race field — please fill it in.");

  // Spell fields on the official sheet are split across many auto-numbered
  // boxes with no consistent naming, so this is a coarse best-effort scan
  // rather than a mapped field: anything whose field name mentions "spell"
  // and has text in it. Expect to hand-fix this on the confirmation screen.
  const spellFields = fields.filter((f) => /spell/i.test(f.getName()));
  const spells = spellFields
    .map((f) => ("getText" in f && typeof f.getText === "function" ? (f.getText as () => string | undefined)() : undefined))
    .filter((s): s is string => Boolean(s && s.trim().length > 0))
    .map((s) => s.trim());
  if (spellFields.length > 0 && spells.length === 0) {
    warnings.push("This sheet has spell fields but none had readable text — check spells manually.");
  }

  const data: CharacterSheetData = {
    name: name ?? "",
    displayName: null,
    race: race ?? "",
    className: className || "",
    level,
    strength: parseAbilityScore(getFieldText(fieldsByName, FIELD_CANDIDATES.strength), warnings, "Strength"),
    dexterity: parseAbilityScore(getFieldText(fieldsByName, FIELD_CANDIDATES.dexterity), warnings, "Dexterity"),
    constitution: parseAbilityScore(getFieldText(fieldsByName, FIELD_CANDIDATES.constitution), warnings, "Constitution"),
    intelligence: parseAbilityScore(getFieldText(fieldsByName, FIELD_CANDIDATES.intelligence), warnings, "Intelligence"),
    wisdom: parseAbilityScore(getFieldText(fieldsByName, FIELD_CANDIDATES.wisdom), warnings, "Wisdom"),
    charisma: parseAbilityScore(getFieldText(fieldsByName, FIELD_CANDIDATES.charisma), warnings, "Charisma"),
    proficiencies: splitList(getFieldText(fieldsByName, FIELD_CANDIDATES.proficiencies)),
    equipment: splitList(getFieldText(fieldsByName, FIELD_CANDIDATES.equipment)),
    spells,
    background: getFieldText(fieldsByName, FIELD_CANDIDATES.background) ?? null,
    personality: getFieldText(fieldsByName, FIELD_CANDIDATES.personality) ?? null,
    appearance: getFieldText(fieldsByName, FIELD_CANDIDATES.appearance) ?? null,
  };

  return { data, warnings };
}
